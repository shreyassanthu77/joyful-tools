/**
 * Result values for explicit success and error handling in synchronous and asynchronous code.
 *
 * `Result<T, E>` represents a computation that either succeeded with an `Ok<T>`
 * value or failed with an `Err<E>` value. This makes failure an explicit part
 * of the type system instead of something that only appears at runtime through
 * exceptions.
 *
 * Use the {@link Result.ok} and {@link Result.err} helpers to construct values,
 * then compose them with methods like `map`, `andThen`, `orElse`,
 * `orElseMatch`, `orElseMatchSome`, and `unwrapOr`. Use {@link Result.wrap}
 * when you want to convert throwing code into result values. Use
 * {@link AsyncResult.wrap} for async work that may reject. Use
 * {@link taggedError} when you want structured `Error`
 * values with a stable `_tag` for narrowing and logging. When the computation
 * is asynchronous, use {@link AsyncResult} or call `result.async()` to keep
 * the same style of composition. For generator-based composition, use
 * {@link Result.run} with `yield*` on `Result` and `AsyncResult` values or
 * tagged errors.
 *
 * @example
 * ```typescript
 * import { Result } from "@joyful/result";
 *
 * function parsePort(input: string): Result<number, string> {
 *   const port = Number(input);
 *   return Number.isInteger(port) && port > 0
 *     ? Result.ok(port)
 *     : Result.err("PORT must be a positive integer");
 * }
 *
 * const port = parsePort("3000")
 *   .map((value) => value + 1)
 *   .unwrapOr(8080);
 *
 * const generated = Result.run(function* () {
 *   const value = yield* parsePort("3000");
 *   return value + 1;
 * });
 * ```
 *
 * @module
 */

export * from "./result.ts";
export * from "./async-result.ts";

import { AsyncResult } from "./async-result.ts";
import {
  type MatchableError,
  taggedError,
  type TaggedErrorFactory,
} from "./errors.ts";
export {
  type TaggedError,
  taggedError,
  type TaggedErrorFactory,
} from "./errors.ts";
import { Err, Ok } from "./result.ts";

/**
 * A value that is either a successful {@link Ok} or a failed {@link Err}.
 *
 * `Result` makes failure explicit in the type system. Callers can branch with
 * `isOk()` and `isErr()`, transform values with `map()` and `mapErr()`, and
 * chain operations with `andThen()`, `orElse()`, `orElseMatch()`, and
 * `orElseMatchSome()`.
 *
 * @example
 * ```typescript
 * function parseNumber(input: string): Result<number, string> {
 *   const value = Number(input);
 *   return Number.isNaN(value)
 *     ? Result.err("invalid number")
 *     : Result.ok(value);
 * }
 *
 * const parsed = parseNumber("42");
 *
 * if (parsed.isOk()) {
 *   console.log(parsed.value);
 * } else {
 *   console.log(parsed.error);
 * }
 * ```
 */
export type Result<T, E = unknown> = Ok<T, E> | Err<T, E>;

/** Namespace helpers for constructing {@link Result} values. */
// deno-lint-ignore no-namespace
export namespace Result {
  /**
   * Creates a successful {@link Result}.
   *
   * @param value The success value to store.
   * @returns An {@link Ok} containing `value`.
   */
  export function ok<T, E = never>(value: T): Result<T, E> {
    return new Ok(value);
  }

  /**
   * Creates a failed {@link Result}.
   *
   * @param err The error value to store.
   * @returns An {@link Err} containing `err`.
   */
  export function err<E, T = never>(err: E): Result<T, E> {
    return new Err(err);
  }

  /**
   * Options for {@link Result.wrap}.
   *
   * Provide the code to run in `try`, and a `catch` mapper that converts any
   * thrown value into your desired error type.
   */
  export interface WrapOptions<T, E> {
    /** Function to execute and capture as a result. */
    try: () => T;
    /** Converts a thrown value into the result error type. */
    catch: (e: unknown) => E;
  }

  export function wrap<T, E>(options: WrapOptions<T, E>): Result<T, E>;
  export function wrap<T, E>(options: WrapOptions<T, E>): Result<T, E> {
    try {
      return new Ok(options.try());
    } catch (e) {
      return new Err(options.catch(e));
    }
  }

  /** Extracts the success type from an {@link Ok} value. */
  export type ExtractOk<T> = T extends Ok<infer U, unknown> ? U : never;

  /** Extracts the error type from an {@link Err} value. */
  export type ExtractErr<T> = T extends Err<unknown, infer E> ? E : never;

  const RetriesExhaustedBase = taggedError(
    "RetriesExhausted",
  ) as TaggedErrorFactory<"RetriesExhausted">;

  /**
   * Error returned when all retry attempts have been exhausted.
   *
   * Contains the total number of attempts and the last error encountered.
   *
   * @example
   * ```typescript
   * import { AsyncResult, Result } from "@joyful/result";
   *
   * const result = await Result.retry(
   *   () => AsyncResult.wrap({ try: () => fetch(url), catch: classifyError }),
   *   { schedule: [500, 2000] },
   * );
   *
   * if (result.isErr() && result.error._tag === "RetriesExhausted") {
   *   console.log(`Failed after ${result.error.attempts} attempts`);
   * }
   * ```
   */
  export class RetriesExhausted<E> extends RetriesExhaustedBase<{
    attempts: number;
    lastError: E;
  }> {}

  /**
   * Options for {@link Result.retry}.
   */
  export interface RetryOptions<E> {
    /**
     * Array of delay durations in milliseconds between retries.
     *
     * The length of this array determines the maximum number of retries.
     * Each element is the delay before the corresponding retry attempt.
     *
     * @default [1000, 5000, 10000]
     */
    schedule?: number[];

    /**
     * Predicate that decides whether to continue retrying.
     *
     * Called with the error from the latest failed attempt and the attempt
     * number (0-indexed). Return `false` to stop retrying early and return the
     * current error as-is (not wrapped in {@link RetriesExhausted}).
     *
     * @default () => true
     */
    while?: (error: E, attempt: number) => boolean | Promise<boolean>;
  }

  /** Default backoff schedule: 1s, 5s, 10s. */
  const DEFAULT_SCHEDULE = [1000, 5000, 10000];

  /**
   * Retries a result-returning function with configurable backoff.
   *
   * The factory function is called with an `attempt` number starting at `0`.
   * On failure, the function waits according to the `schedule` array before
   * the next attempt. If all retries are exhausted, the result is wrapped in
   * {@link RetriesExhausted}. If the `while` predicate returns `false`, the
   * current error is returned immediately without wrapping.
   *
   * @param fn Factory that produces a result for each attempt.
   * @param options Retry options including schedule and predicate.
   * @returns An async result that resolves to the first success or the final error.
   *
   * @example
   * ```typescript
   * // Retry with default schedule (1s, 5s, 10s)
   * const result = await Result.retry(
   *   (attempt) => AsyncResult.wrap({
   *     try: () => fetch("/api/data"),
   *     catch: (e) => new FetchError({ cause: e }),
   *   }),
   * );
   *
   * // Retry with custom schedule and early-exit predicate
   * const result = await Result.retry(
   *   (attempt) => AsyncResult.wrap({
   *     try: () => fetch("/api/data"),
   *     catch: classifyError,
   *   }),
   *   {
   *     schedule: [100, 200, 400],
   *     while: (err, attempt) => err._tag !== "NotFound",
   *   },
   * );
   * ```
   */
  export function retry<T, E>(
    fn: (
      attempt: number,
    ) => Result<T, E> | AsyncResult<T, E> | Promise<Result<T, E>>,
    options?: RetryOptions<E>,
  ): AsyncResult<T, E | RetriesExhausted<E>> {
    const schedule = options?.schedule ?? DEFAULT_SCHEDULE;
    const shouldRetry = options?.while ?? (() => true);

    return new AsyncResult(retryLoop(fn, schedule, shouldRetry));
  }

  async function retryLoop<T, E>(
    fn: (
      attempt: number,
    ) => Result<T, E> | AsyncResult<T, E> | Promise<Result<T, E>>,
    schedule: number[],
    shouldRetry: (error: E, attempt: number) => boolean | Promise<boolean>,
  ): Promise<Result<T, E | RetriesExhausted<E>>> {
    for (let attempt = 0; attempt <= schedule.length; attempt++) {
      const resultOrAsync = fn(attempt);
      const result: Result<T, E> = "then" in resultOrAsync
        ? await resultOrAsync
        : resultOrAsync;

      if (result instanceof Ok) return result;
      if (!(await shouldRetry(result.error, attempt))) return result;

      if (attempt < schedule.length) {
        await delay(schedule[attempt]);
      } else {
        return new Err(
          new RetriesExhausted<E>({
            attempts: attempt + 1,
            lastError: result.error,
          }),
        );
      }
    }

    throw new Error("unreachable");
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Runs a generator that uses `yield*` with {@link Result} values.
   *
   * If the generator yields an {@link Err}, the run stops and that error is
   * returned. Tagged errors created with {@link taggedError} can also be
   * yielded directly. If every yielded result is successful, the final returned
   * value becomes the successful output.
   *
   * This overload is for synchronous generators.
   *
   * @param gen Generator factory that yields from `Result` values.
   * @returns The final successful or failed result.
   *
   * @example
   * ```typescript
   * const result = Result.run(function* () {
   *   const first = yield* Result.ok(2);
   *   const second = yield* Result.ok(3);
   *   return first + second;
   * });
   * ```
   */
  export function run<E extends Err<never, unknown> | MatchableError, R>(
    gen: () => Generator<E, R, unknown>,
  ): Result<
    R,
    E extends Err<never, infer ErrValue> ? ErrValue
      : E extends MatchableError ? E
      : never
  >;

  /**
   * Runs an async generator that uses `yield*` with {@link AsyncResult} values.
   *
   * If the generator yields an {@link Err}, the run stops and that error is
   * returned. Tagged errors created with {@link taggedError} can also be
   * yielded directly. If every yielded result is successful, the final returned
   * value becomes the successful output.
   *
   * This overload is for async generators.
   *
   * @param gen Async generator factory that yields from `AsyncResult` values.
   * @returns An async result for the final successful or failed result.
   *
   * @example
   * ```typescript
   * const result = Result.run(async function* () {
   *   const first = yield* Result.ok(2).async();
   *   const second = yield* Result.ok(3).async();
   *   return first + second;
   * });
   * ```
   */
  export function run<E extends Err<never, unknown> | MatchableError, R>(
    gen: () => AsyncGenerator<E, R, unknown>,
  ): AsyncResult<
    R,
    E extends Err<never, infer ErrValue> ? ErrValue
      : E extends MatchableError ? E
      : never
  >;
  export function run<E extends Err<never, unknown> | MatchableError, R>(
    gen:
      | (() => Generator<E, R, unknown>)
      | (() => AsyncGenerator<E, R, unknown>),
  ):
    | Result<
      R,
      E extends Err<never, infer ErrValue> ? ErrValue
        : E extends MatchableError ? E
        : never
    >
    | AsyncResult<
      R,
      E extends Err<never, infer ErrValue> ? ErrValue
        : E extends MatchableError ? E
        : never
    > {
    const iterator = gen();
    if (Symbol.asyncIterator in iterator) {
      return new AsyncResult(runAsync(iterator));
    }

    let result: IteratorResult<E, R>;
    try {
      result = iterator.next();
    } catch (e) {
      throw new Error(`Error in Result.run generator: ${e}`);
    }
    if (!result.done) {
      try {
        iterator.return?.(undefined as unknown as R);
      } catch (e) {
        throw new Error(`Error in Result.run generator: ${e}`);
      }

      return result.value instanceof Err
        ? (result.value as Err<
          R,
          E extends Err<never, infer ErrValue> ? ErrValue
            : E extends MatchableError ? E
            : never
        >)
        : new Err(
          result.value as E extends Err<never, infer ErrValue> ? ErrValue
            : E extends MatchableError ? E
            : never,
        );
    }

    return new Ok(result.value);
  }

  async function runAsync<E extends Err<never, unknown> | MatchableError, R>(
    gen: AsyncGenerator<E, R, unknown>,
  ): Promise<
    Result<
      R,
      E extends Err<never, infer ErrValue> ? ErrValue
        : E extends MatchableError ? E
        : never
    >
  > {
    let result: IteratorResult<E, R>;
    try {
      result = await gen.next();
    } catch (e) {
      throw new Error(`Error in Result.run generator: ${e}`);
    }

    if (!result.done) {
      try {
        await gen.return?.(undefined as unknown as R);
      } catch (e) {
        throw new Error(`Cleanup failed in Result.run ${e}`);
      }

      return result.value instanceof Err
        ? (result.value as Err<
          R,
          E extends Err<never, infer ErrValue> ? ErrValue
            : E extends MatchableError ? E
            : never
        >)
        : new Err(
          result.value as E extends Err<never, infer ErrValue> ? ErrValue
            : E extends MatchableError ? E
            : never,
        );
    }

    return new Ok(result.value);
  }
}
