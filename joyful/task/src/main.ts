import {
  Err,
  Ok,
  type Result,
  taggedError,
  type TaggedErrorFactory,
} from "@joyful/result";
import type {
  MatchableError,
  MatchHandlers,
  MatchResultError,
  MatchResultValue,
  MatchSomeHandlers,
  MatchSomeResultError,
  MaybeResult,
  Taskish,
  TaskResultArray,
  TaskResultRecord,
  WorkflowError,
} from "./types.ts";

export type {
  MaybeResult,
  Taskish,
  TaskResultArray,
  TaskResultRecord,
} from "./types.ts";

const CancelledBase = taggedError(
  "Cancelled",
) as TaggedErrorFactory<"Cancelled">;

/** Cancellation outcome used by signal-aware task helpers. */
export class Cancelled extends CancelledBase {}

const RetriesExhaustedBase = taggedError(
  "RetriesExhausted",
) as TaggedErrorFactory<"RetriesExhausted">;

/** Error returned when all retry attempts have been exhausted. */
export class RetriesExhausted<E> extends RetriesExhaustedBase<{
  attempts: number;
  lastError: E;
}> {}

/** Context passed to task factories when a task is run. */
export interface TaskContext {
  signal?: AbortSignal;
  attempt?: number;
}

/** Retry behavior used by {@link Task.runWith}. */
export interface RetryOptions<E> {
  schedule?: number[];
  while?: (error: E | Cancelled, attempt: number) => boolean | Promise<boolean>;
}

/** Options accepted by {@link Task.runWith}. */
export interface TaskRunOptions {
  signal?: AbortSignal;
}

/** Options accepted by {@link Task.runWith} when retrying a run. */
export interface TaskRetryRunOptions<E> extends TaskRunOptions {
  retry: RetryOptions<E>;
}

/** Lazy reusable work that produces a {@link Result}. */
export class Task<Args extends unknown[] = [], T = unknown, E = unknown> {
  #factory: (ctx: TaskContext, ...args: Args) => MaybeResult<T, E>;

  constructor(factory: (ctx: TaskContext, ...args: Args) => MaybeResult<T, E>) {
    this.#factory = factory;
  }

  /** Starts the task with the given arguments. */
  run(...args: Args): TaskRun<T, E> {
    return new TaskRun(this.#factory({}, ...args));
  }

  /** Starts the task with options such as an abort signal or retry policy. */
  runWith(
    options: TaskRetryRunOptions<E>,
    ...args: Args
  ): TaskRun<T, E | RetriesExhausted<E> | Cancelled>;
  runWith(options: TaskRunOptions, ...args: Args): TaskRun<T, E>;
  runWith(
    options: TaskRunOptions | TaskRetryRunOptions<E>,
    ...args: Args
  ): TaskRun<T, E | RetriesExhausted<E> | Cancelled> {
    if ("retry" in options) {
      return new TaskRun(
        retryRun((ctx) => this.#factory(ctx, ...args), options),
      );
    }

    return new TaskRun(this.#factory({ signal: options.signal }, ...args));
  }

  /** Wraps normal sync or async code as a task. */
  static wrap<Args extends unknown[], T, E>(
    factory: (ctx: TaskContext, ...args: Args) => T | Promise<T>,
    catcher: (error: unknown) => E,
  ): Task<Args, T, E | Cancelled> {
    return new Task<Args, T, E | Cancelled>((ctx, ...args) => {
      if (ctx.signal?.aborted) {
        return new Err(cancelledFrom(ctx.signal.reason));
      }

      try {
        const value = factory(ctx, ...args);
        if (value instanceof Promise) {
          return value.then(
            (resolved) => new Ok(resolved),
            (error) =>
              new Err(
                isAbortError(error) ? cancelledFrom(error) : catcher(error),
              ),
          );
        }
        return new Ok(value);
      } catch (error) {
        return new Err(
          isAbortError(error) ? cancelledFrom(error) : catcher(error),
        );
      }
    });
  }

  /** Builds a lazy task from an async generator workflow. */
  static do<Args extends unknown[], E extends Err<never, unknown>, R>(
    workflow: (...args: Args) => AsyncGenerator<E, R, unknown>,
  ): Task<Args, R, WorkflowError<E> | Cancelled> {
    return new Task<Args, R, WorkflowError<E> | Cancelled>(
      async (_ctx, ...args) => {
        const iterator = workflow(...args);
        let result: IteratorResult<E, R>;
        try {
          result = await iterator.next();
        } catch (error) {
          throw new Error(`Error in Task.do generator: ${error}`);
        }

        if (result.done === false) {
          try {
            await iterator.return?.(undefined as R);
          } catch (error) {
            throw new Error(`Error in Task.do generator: ${error}`);
          }
          return new Err(result.value.error as WorkflowError<E>);
        }

        return new Ok(result.value);
      },
    );
  }

  /** Maps a successful value. */
  map<U>(f: (value: T) => U | Promise<U>): Task<Args, Awaited<U>, E> {
    return new Task<Args, Awaited<U>, E>((ctx, ...args) => {
      const result = this.#factory(ctx, ...args);
      if ("then" in result) {
        return result.then((resolved) => mapOk(resolved, f));
      }
      return mapOk(result, f);
    });
  }

  /** Maps an error value. */
  mapErr<F>(f: (error: E) => F | Promise<F>): Task<Args, T, Awaited<F>> {
    return new Task<Args, T, Awaited<F>>((ctx, ...args) => {
      const result = this.#factory(ctx, ...args);
      if ("then" in result) {
        return result.then((resolved) => mapErrResult(resolved, f));
      }
      return mapErrResult(result, f);
    });
  }

  /** Chains another task run or result-producing operation on success. */
  andThen<U, F>(f: (value: T) => Taskish<U, F>): Task<Args, U, E | F> {
    return new Task<Args, U, E | F>((ctx, ...args) => {
      const result = this.#factory(ctx, ...args);
      if ("then" in result) {
        return result.then((resolved) => {
          if (resolved instanceof Err) return new Err(resolved.error);
          return runTaskish(f(resolved.value));
        });
      }
      if (result instanceof Err) return new Err(result.error);
      return runTaskish(f(result.value));
    });
  }

  /** Chains another task run or result-producing operation on failure. */
  orElse<U, F>(f: (error: E) => Taskish<T | U, F>): Task<Args, T | U, F> {
    return new Task<Args, T | U, F>((ctx, ...args) => {
      const result = this.#factory(ctx, ...args);
      if ("then" in result) {
        return result.then((resolved) => {
          if (resolved instanceof Ok) return new Ok(resolved.value);
          return runTaskish(f(resolved.error));
        });
      }
      if (result instanceof Ok) return new Ok(result.value);
      return runTaskish(f(result.error));
    });
  }

  /** Recovers from tagged errors with exhaustive handlers. */
  orElseMatch<
    const Handlers extends E extends MatchableError ? MatchHandlers<E> : never,
  >(
    handlers: Handlers,
  ): Task<Args, T | MatchResultValue<Handlers>, MatchResultError<Handlers>> {
    return new Task<
      Args,
      T | MatchResultValue<Handlers>,
      MatchResultError<Handlers>
    >((ctx, ...args) => {
      const result = this.#factory(ctx, ...args);
      if ("then" in result) {
        return result.then((resolved) => matchResult(resolved, handlers));
      }
      return matchResult(result, handlers);
    });
  }

  /** Recovers from matching tagged errors and leaves unhandled errors unchanged. */
  orElseMatchSome<
    const Handlers extends E extends MatchableError ? MatchSomeHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): Task<
    Args,
    T | MatchResultValue<Handlers>,
    MatchSomeResultError<E, Handlers>
  > {
    return new Task<
      Args,
      T | MatchResultValue<Handlers>,
      MatchSomeResultError<E, Handlers>
    >((ctx, ...args) => {
      const result = this.#factory(ctx, ...args);
      if ("then" in result) {
        return result.then((resolved) => matchResultSome(resolved, handlers));
      }
      return matchResultSome(result, handlers);
    });
  }

  /** Runs a side effect for successful values. */
  inspect(f: (value: T) => void | Promise<void>): Task<Args, T, E> {
    return this.map((value) => {
      const inspected = f(value);
      if (inspected instanceof Promise) return inspected.then(() => value);
      return value;
    });
  }

  /** Runs a side effect for error values. */
  inspectErr(f: (error: E) => void | Promise<void>): Task<Args, T, E> {
    return new Task<Args, T, E>((ctx, ...args) => {
      const result = this.#factory(ctx, ...args);

      if ("then" in result) {
        return result.then((resolved) => {
          if (resolved instanceof Err) {
            const inspected = f(resolved.error);
            if (inspected instanceof Promise) {
              return inspected.then(() => resolved);
            }
          }
          return resolved;
        });
      }

      if (result instanceof Err) {
        const inspected = f(result.error);
        if (inspected instanceof Promise) return inspected.then(() => result);
      }
      return result;
    });
  }

  /** Awaits every task run and returns all of their results. */
  static all<const Tasks extends readonly TaskRun<unknown, unknown>[]>(
    tasks: Tasks,
  ): TaskRun<TaskResultArray<Tasks>, never>;
  static all<
    const Tasks extends Record<string, TaskRun<unknown, unknown>>,
  >(tasks: Tasks): TaskRun<TaskResultRecord<Tasks>, never>;
  static all<
    const Tasks extends
      | readonly TaskRun<unknown, unknown>[]
      | Record<string, TaskRun<unknown, unknown>>,
  >(
    tasks: Tasks,
  ): TaskRun<
    Tasks extends readonly TaskRun<unknown, unknown>[] ? TaskResultArray<Tasks>
      : Tasks extends Record<string, TaskRun<unknown, unknown>>
        ? TaskResultRecord<Tasks>
      : never,
    never
  > {
    if (Array.isArray(tasks)) {
      return new TaskRun((async () => {
        const results = await Promise.all(tasks);
        return new Ok(
          results as TaskResultArray<
            Extract<Tasks, readonly TaskRun<unknown, unknown>[]>
          >,
        );
      })()) as never;
    }

    return new TaskRun((async () => {
      const taskRecord = tasks as Record<
        string,
        TaskRun<unknown, unknown>
      >;
      const keys = Object.keys(taskRecord);
      const results = await Promise.all(keys.map((key) => taskRecord[key]));
      const record = {} as TaskResultRecord<
        Extract<Tasks, Record<string, TaskRun<unknown, unknown>>>
      >;
      for (let i = 0; i < keys.length; i++) {
        record[keys[i] as keyof typeof record] = results[i] as never;
      }
      return new Ok(record);
    })()) as never;
  }
}

/** A single hot task execution that can be awaited or yielded from workflows. */
export class TaskRun<T, E = unknown>
  implements
    PromiseLike<Result<T, E>>,
    AsyncIterable<Err<never, E>, T, unknown> {
  #result: MaybeResult<T, E>;

  constructor(result: MaybeResult<T, E>) {
    this.#result = result;
  }

  then<TResult1 = Result<T, E>, TResult2 = never>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    if ("then" in this.#result) {
      return this.#result.then(onfulfilled, onrejected);
    }

    return Promise.resolve(this.#result).then(onfulfilled, onrejected);
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Err<never, E>, T, unknown> {
    const result = "then" in this.#result ? await this.#result : this.#result;
    if (result instanceof Ok) return result.value;

    yield result as Err<never, E>;
    throw "unreachable";
  }
}

const DEFAULT_SCHEDULE = [1000, 5000, 10000];

function runTaskish<T, E>(value: Taskish<T, E>): MaybeResult<T, E> {
  if (value instanceof Ok || value instanceof Err) return value;
  return value;
}

function matchResult<
  T,
  E,
  const Handlers extends E extends MatchableError ? MatchHandlers<E> : never,
>(
  result: Result<T, E>,
  handlers: Handlers,
): MaybeResult<T | MatchResultValue<Handlers>, MatchResultError<Handlers>> {
  if (result instanceof Ok) return new Ok(result.value);

  const error = result.error as E & MatchableError;
  const handler = handlers[error._tag as keyof Handlers] as (
    error: E & MatchableError,
  ) => Taskish<MatchResultValue<Handlers>, MatchResultError<Handlers>>;

  return runTaskish(handler(error));
}

function matchResultSome<
  T,
  E,
  const Handlers extends E extends MatchableError ? MatchSomeHandlers<E>
    : never,
>(
  result: Result<T, E>,
  handlers: Handlers,
): MaybeResult<
  T | MatchResultValue<Handlers>,
  MatchSomeResultError<E, Handlers>
> {
  if (result instanceof Ok) return new Ok(result.value);

  const error = result.error as E & MatchableError;
  const handler = handlers[error._tag as keyof Handlers] as
    | ((
      error: E & MatchableError,
    ) => Taskish<MatchResultValue<Handlers>, MatchResultError<Handlers>>)
    | undefined;

  if (!handler) {
    return new Err(result.error as MatchSomeResultError<E, Handlers>);
  }

  return runTaskish(handler(error));
}

function mapOk<T, E, U>(
  result: Result<T, E>,
  f: (value: T) => U | Promise<U>,
): MaybeResult<Awaited<U>, E> {
  if (result instanceof Err) return new Err(result.error);

  const value = f(result.value);
  if (value instanceof Promise) {
    return value.then((resolved) => new Ok(resolved as Awaited<U>));
  }
  return new Ok(value as Awaited<U>);
}

function mapErrResult<T, E, F>(
  result: Result<T, E>,
  f: (error: E) => F | Promise<F>,
): MaybeResult<T, Awaited<F>> {
  if (result instanceof Ok) return new Ok(result.value);

  const error = f(result.error);
  if (error instanceof Promise) {
    return error.then((resolved) => new Err(resolved as Awaited<F>));
  }
  return new Err(error as Awaited<F>);
}

async function retryRun<T, E>(
  run: (ctx: TaskContext) => MaybeResult<T, E>,
  options: TaskRetryRunOptions<E>,
): Promise<Result<T, E | RetriesExhausted<E> | Cancelled>> {
  const schedule = options.retry.schedule ?? DEFAULT_SCHEDULE;
  const shouldRetry = options.retry.while ?? (() => true);

  for (let attempt = 0; attempt <= schedule.length; attempt++) {
    if (options.signal?.aborted) {
      return new Err(cancelledFrom(options.signal.reason));
    }

    const result = await run({ signal: options.signal, attempt });
    if (result instanceof Ok) return new Ok(result.value);
    if (result.error instanceof Cancelled) return new Err(result.error);
    if (!(await shouldRetry(result.error, attempt))) {
      return new Err(result.error);
    }

    if (attempt < schedule.length) {
      const wait = await delay(schedule[attempt], options.signal);
      if (wait instanceof Err) return new Err(wait.error);
    } else {
      return new Err(
        new RetriesExhausted<E>({
          attempts: attempt + 1,
          lastError: result.error as E,
        }),
      );
    }
  }

  throw new Error("unreachable");
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function cancelledFrom(reason: unknown): Cancelled {
  return new Cancelled({
    message: reason instanceof Error
      ? `Cancelled: ${reason.message}`
      : typeof reason === "string"
      ? `Cancelled: ${reason}`
      : "Cancelled",
    cause: reason,
  });
}

function delay(
  ms: number,
  signal?: AbortSignal,
): Promise<Result<void, Cancelled>> {
  if (signal?.aborted) {
    return Promise.resolve(new Err(cancelledFrom(signal.reason)));
  }

  return new Promise((resolve) => {
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve(new Ok(undefined));
    }, ms);

    function abort() {
      clearTimeout(id);
      resolve(new Err(cancelledFrom(signal?.reason)));
    }

    signal?.addEventListener("abort", abort, { once: true });
  });
}
