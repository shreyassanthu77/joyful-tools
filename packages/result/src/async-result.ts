import type {
  MatchAsyncResultError,
  MatchAsyncResultHandlers,
  MatchAsyncResultValue,
  MatchSomeAsyncResultHandlers,
  MatchableError,
  RemainingMatchErrors,
} from "./errors.ts";
import type { Result } from "./main.ts";
import { Err, Ok } from "./result.ts";

/**
 * Promise-like wrapper around a {@link Result}.
 *
 * `AsyncResult` lets you keep using result-style composition when the
 * underlying computation is asynchronous. You can `await` it directly to get
 * the wrapped {@link Result}, or call methods like `map`, `andThen`, `orElse`,
 * `orElseMatch`, `orElseMatchSome`, and `unwrapOr` without leaving the result
 * model.
 *
 * @example
 * ```typescript
 * import { AsyncResult, Result } from "@joyful/result";
 *
 * function fetchUserName(): AsyncResult<string, string> {
 *   return new AsyncResult(
 *     fetch("/api/user")
 *       .then(async (response) => {
 *         if (!response.ok) {
 *           return Result.err(`request failed: ${response.status}`);
 *         }
 *
 *         const user = await response.json() as { name: string };
 *         return Result.ok(user.name);
 *       })
 *       .catch((error) =>
 *         Result.err(error instanceof Error ? error.message : String(error))
 *       )
 *   );
 * }
 * ```
 */
export class AsyncResult<T, E = unknown> implements PromiseLike<Result<T, E>> {
  /** The underlying promise that resolves to a {@link Result}. */
  promise: Promise<Result<T, E>>;

  /**
   * Creates an async wrapper around a result-bearing promise.
   *
   * @param promise A promise that resolves to a {@link Result}.
   */
  constructor(promise: Promise<Result<T, E>>) {
    this.promise = promise;
  }

  /**
   * Wraps a promise and converts rejections into an error result.
   *
   * @param promise Promise for the success value.
   * @param catcher Function that maps a rejection reason to the error type.
   * @returns An async result that resolves to `Ok` on success or `Err` on rejection.
   *
   * @example
   * ```typescript
   * const result = await AsyncResult.wrap(
   *   fetch("/api/user").then((response) => response.json()),
   *   (error) => error instanceof Error ? error.message : String(error),
   * );
   * ```
   */
  static wrap<T, E>(
    promise: Promise<T>,
    catcher: (e: unknown) => E,
  ): AsyncResult<T, E> {
    return new AsyncResult(
      promise.then((value) => new Ok(value)).catch((e) => new Err(catcher(e))),
    );
  }

  /**
   * Makes `AsyncResult` awaitable and compatible with promise chains.
   *
   * @param onfulfilled Called when the underlying promise resolves.
   * @param onrejected Called when the underlying promise rejects.
   * @returns A promise-like value for the chained computation.
   */
  then<P, Q>(
    onfulfilled?: (value: Result<T, E>) => P | PromiseLike<P>,
    onrejected?: (reason: unknown) => Q | PromiseLike<Q>,
  ): PromiseLike<P | Q> {
    return this.promise.then(onfulfilled, onrejected);
  }

  /** Resolves to `true` when the wrapped result is successful. */
  async isOk(): Promise<boolean> {
    const result = await this;
    return result.isOk();
  }

  /** Resolves to `true` when the wrapped result is an error. */
  async isErr(): Promise<boolean> {
    const result = await this;
    return result.isErr();
  }

  /**
   * Resolves to the success value or a fallback value.
   *
   * @param defaultValue Value to use when the wrapped result is an error.
   * @returns The success value or `defaultValue`.
   */
  async unwrapOr(defaultValue: T): Promise<T> {
    const result = await this;
    return result.unwrapOr(defaultValue);
  }

  /**
   * Resolves to the success value or throws an `Error`.
   *
   * @param message Error message to use if the wrapped result is an error.
   * @returns The success value.
   * @throws {Error}
   */
  async expect(message: string): Promise<T> {
    const result = await this;
    return result.expect(message);
  }

  /**
   * Resolves to the error value or throws an `Error`.
   *
   * @param message Error message to use if the wrapped result is successful.
   * @returns The error value.
   * @throws {Error}
   */
  async expectErr(message: string): Promise<E> {
    const result = await this;
    return result.expectErr(message);
  }

  /**
   * Maps the success value with a synchronous or asynchronous callback.
   *
   * @param f Function that transforms the success value.
   * @returns A new async result containing the mapped value.
   */
  map<U>(f: (value: T) => U | Promise<U>): AsyncResult<U, E> {
    return new AsyncResult(
      this.promise.then(async (result) => {
        // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
        if (result instanceof Err) return result as Err<U, E>;
        const mapped = f((result as Ok<T, never>).value);
        if (mapped instanceof Promise) {
          return new Ok(await mapped);
        }
        return new Ok(mapped);
      }),
    );
  }

  /**
   * Maps the error value with a synchronous or asynchronous callback.
   *
   * @param f Function that transforms the error value.
   * @returns A new async result containing the mapped error.
   */
  mapErr<F>(f: (err: E) => F | Promise<F>): AsyncResult<T, F> {
    return new AsyncResult(
      this.promise.then(async (result) => {
        // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
        if (result instanceof Ok) return result as Ok<T, F>;
        const mapped = f((result as Err<T, never>).error);
        if (mapped instanceof Promise) {
          return new Err(await mapped);
        }
        return new Err(mapped);
      }),
    );
  }

  /**
   * Chains another result-returning operation onto the success path.
   *
   * The callback may return a synchronous {@link Result}, an {@link AsyncResult},
   * or a promise of a `Result`.
   *
   * @param f Function that receives the success value and returns the next result.
   * @returns A new async result for the chained computation.
   */
  andThen<U, F>(
    f: (value: T) => Result<U, F> | AsyncResult<U, F> | Promise<Result<U, F>>,
  ): AsyncResult<U, E | F> {
    return new AsyncResult(
      this.promise.then(async (result) => {
        // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
        if (result instanceof Err) return result as Err<U, E | F>;
        const mapped = f((result as Ok<T, never>).value);
        if ("then" in mapped) {
          return await mapped;
        }
        return mapped;
      }),
    );
  }

  /**
   * Chains another result-returning operation onto the error path.
   *
   * The callback may return a synchronous {@link Result}, an {@link AsyncResult},
   * or a promise of a `Result`.
   *
   * @param f Function that receives the error value and returns a recovery result.
   * @returns A new async result for the recovery computation.
   */
  orElse<U, F>(
    f: (err: E) => Result<U, F> | AsyncResult<U, F> | Promise<Result<U, F>>,
  ): AsyncResult<T | U, F> {
    return new AsyncResult(
      this.promise.then(async (result) => {
        // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
        if (result instanceof Ok) return result as Ok<T | U, F>;
        const mapped = f((result as Err<T, never>).error);
        if ("then" in mapped) {
          return await mapped;
        }
        return mapped;
      }),
    );
  }

  /**
   * Recovers from a tagged error with an exhaustive set of result-returning handlers.
   *
   * Handlers may return a synchronous {@link Result}, an {@link AsyncResult},
   * or a promise of a `Result`.
   *
   * @param handlers Mapping from `_tag` values to handler functions.
   * @returns A new async result for the recovery computation.
   *
   * @example
   * ```typescript
   * class ValidationError extends Result.taggedError("ValidationError")<{
   *   field: string;
   * }> {}
   * class NetworkError extends Result.taggedError("NetworkError")<{
   *   status: number;
   * }> {}
   *
   * const result = new AsyncResult(
   *   Promise.resolve(
   *     Result.err<number, ValidationError | NetworkError>(
   *       new ValidationError({ field: "email" }),
   *     ),
   *   ),
   * );
   *
   * const recovered = result.orElseMatch({
   *   ValidationError: (error) => Result.ok(error.field.length),
   *   NetworkError: (error) => Result.err(`retry:${error.status}`),
   * });
   * ```
   */
  orElseMatch<
    const Handlers extends E extends MatchableError
      ? MatchAsyncResultHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): AsyncResult<
    T | MatchAsyncResultValue<Handlers>,
    MatchAsyncResultError<Handlers>
  > {
    return new AsyncResult(
      this.promise.then(async (result) => {
        if (result instanceof Ok) {
          return result as Ok<
            T | MatchAsyncResultValue<Handlers>,
            MatchAsyncResultError<Handlers>
          >;
        }

        const error = (result as Err<T, E>).error as E & MatchableError;
        const handler = handlers[error._tag as keyof Handlers] as unknown as (
          error: E,
        ) =>
          | Result<MatchAsyncResultValue<Handlers>, MatchAsyncResultError<Handlers>>
          | AsyncResult<
            MatchAsyncResultValue<Handlers>,
            MatchAsyncResultError<Handlers>
          >
          | Promise<
            Result<
              MatchAsyncResultValue<Handlers>,
              MatchAsyncResultError<Handlers>
            >
          >;
        const mapped = handler(error);

        if ("then" in mapped) {
          return await mapped;
        }

        return mapped;
      }),
    );
  }

  /**
   * Recovers from matching tagged errors and leaves unhandled ones unchanged.
   *
   * Handlers may return a synchronous {@link Result}, an {@link AsyncResult},
   * or a promise of a `Result`.
   *
   * @param handlers Partial mapping from `_tag` values to result-returning handlers.
   * @returns A new async result for the recovery computation.
   *
   * @example
   * ```typescript
   * class ValidationError extends Result.taggedError("ValidationError")<{
   *   field: string;
   * }> {}
   * class NetworkError extends Result.taggedError("NetworkError")<{
   *   status: number;
   * }> {}
   *
   * const result = new AsyncResult(
   *   Promise.resolve(
   *     Result.err<number, ValidationError | NetworkError>(
   *       new NetworkError({ status: 503 }),
   *     ),
   *   ),
   * );
   *
   * const recovered = result.orElseMatchSome({
   *   ValidationError: (error) => Result.ok(error.field.length),
   * });
   * // AsyncResult<number, NetworkError>
   * ```
   */
  orElseMatchSome<
    const Handlers extends E extends MatchableError
      ? MatchSomeAsyncResultHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): AsyncResult<
    T | MatchAsyncResultValue<Handlers>,
    | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
    | MatchAsyncResultError<Handlers>
  > {
    return new AsyncResult(
      this.promise.then(async (result) => {
        if (result instanceof Ok) {
          return result as Ok<
            T | MatchAsyncResultValue<Handlers>,
            | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
            | MatchAsyncResultError<Handlers>
          >;
        }

        const error = (result as Err<T, E>).error as E & MatchableError;
        const handler = handlers[error._tag as keyof Handlers] as
          | ((error: E) =>
            | Result<
              MatchAsyncResultValue<Handlers>,
              MatchAsyncResultError<Handlers>
            >
            | AsyncResult<
              MatchAsyncResultValue<Handlers>,
              MatchAsyncResultError<Handlers>
            >
            | Promise<
              Result<
                MatchAsyncResultValue<Handlers>,
                MatchAsyncResultError<Handlers>
              >
            >)
          | undefined;

        if (!handler) {
          return result as Err<
            T | MatchAsyncResultValue<Handlers>,
            | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
            | MatchAsyncResultError<Handlers>
          >;
        }

        const mapped = handler(error);

        if ("then" in mapped) {
          return await mapped;
        }

        return mapped;
      }),
    );
  }

  /**
   * Schedules a side effect for the success value and returns this result.
   *
   * @param f Function to call with the success value.
   * @returns This async result.
   */
  inspect(f: (value: T) => void): this {
    this.promise.then((result) => result.inspect(f));
    return this;
  }

  /**
   * Schedules a side effect for the error value and returns this result.
   *
   * @param f Function to call with the error value.
   * @returns This async result.
   */
  inspectErr(f: (err: E) => void): AsyncResult<T, E> {
    this.promise.then((result) => result.inspectErr(f));
    return this;
  }

  /**
   * Supports `yield*` inside async {@link Result.run} generator workflows.
   *
   * Successful results return their contained value to the async generator.
   * Failed results yield their error result so `Result.run` can stop early.
   *
   * @returns An async-generator-compatible representation of this result.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<Err<never, E>, T, unknown> {
    const result = await this.promise;
    if (result instanceof Ok) return result.value;
    // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
    yield result;
    throw "unreachable";
  }
}
