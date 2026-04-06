import { AsyncResult } from "@joyful/result";
import type {
  MatchableError,
  MatchResultError,
  MatchResultHandlers,
  MatchResultValue,
  MatchSomeResultHandlers,
  RemainingMatchErrors,
} from "./errors.ts";
import type { Result } from "./main.ts";

interface BaseResult<T, E = unknown> {
  isOk(): this is Ok<T, E>;
  isErr(): this is Err<T, E>;
  unwrapOr(defaultValue: T): T;
  expect(message: string): T;
  expectErr(message: string): E;
  map<U>(f: (value: T) => U): Result<U, E>;
  mapErr<F>(f: (err: E) => F): Result<T, F>;
  andThen<U, F>(f: (value: T) => Result<U, F>): Result<U, E | F>;
  orElse<U, F>(f: (err: E) => Result<U, F>): Result<T | U, F>;
  orElseMatch<
    const Handlers extends E extends MatchableError
      ? MatchResultHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): Result<T | MatchResultValue<Handlers>, MatchResultError<Handlers>>;
  orElseMatchSome<
    const Handlers extends E extends MatchableError
      ? MatchSomeResultHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): Result<
    T | MatchResultValue<Handlers>,
    | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
    | MatchResultError<Handlers>
  >;
  inspect(f: (value: T) => void): this;
  inspectErr(f: (err: E) => void): this;
  async(): AsyncResult<T, E>;
}

/**
 * Successful {@link Result} variant.
 *
 * Most code should create successful results with {@link Result.ok}, but `Ok`
 * is exported for direct construction and type narrowing.
 */
export class Ok<T, E = never> implements BaseResult<T, E> {
  /** The successful value carried by this result. */
  value: T;

  /**
   * Creates a successful result.
   *
   * @param value The value to store.
   */
  constructor(value: T) {
    this.value = value;
  }

  /** Returns `true` because this result is successful. */
  isOk(): this is Ok<T, E> {
    return true;
  }

  /** Returns `false` because this result is not an error. */
  isErr(): this is Err<T, E> {
    return false;
  }

  /**
   * Returns the contained value and ignores the fallback.
   *
   * @param defaultValue Fallback value for the error case.
   * @returns The contained value.
   */
  unwrapOr(defaultValue: T): T {
    void defaultValue;
    return this.value;
  }

  /**
   * Returns the contained value.
   *
   * @param message Error message that would be used for an error result.
   * @returns The contained value.
   */
  expect(message: string): T {
    void message;
    return this.value;
  }

  /**
   * Throws an `Error` with the provided message.
   *
   * @param message Error message to throw.
   * @throws {Error}
   */
  expectErr(message: string): E {
    throw new Error(message);
  }

  /**
   * Transforms the contained value.
   *
   * @param f Function that maps the success value to a new value.
   * @returns A new successful result with the mapped value.
   *
   * @example
   * ```typescript
   * const result = Result.ok(2).map((value) => value + 1);
   * // Ok(3)
   * ```
   */
  map<U>(f: (value: T) => U): Result<U, E> {
    return new Ok(f(this.value));
  }

  /**
   * Returns this result unchanged because there is no error to map.
   *
   * @param f Function that would map an error value.
   * @returns This result with the same success value.
   */
  mapErr<F>(f: (err: E) => F): Result<T, F> {
    void f;
    // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
    return this as Ok<T, F>;
  }

  /**
   * Chains another result-returning operation.
   *
   * @param f Function that receives the success value and returns the next result.
   * @returns The result returned by `f`.
   *
   * @example
   * ```typescript
   * const parsed = Result.ok("42").andThen((value) => {
   *   const number = Number(value);
   *   return Number.isNaN(number)
   *     ? Result.err("invalid number")
   *     : Result.ok(number);
   * });
   * ```
   */
  andThen<U, F>(f: (value: T) => Result<U, F>): Result<U, E | F> {
    return f(this.value);
  }

  /**
   * Returns this result unchanged because it is already successful.
   *
   * @param f Function that would recover from an error.
   * @returns This result with the same success value.
   */
  orElse<U, F>(f: (err: E) => Result<U, F>): Result<T | U, F> {
    void f;
    // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
    return this as Ok<T | U, F>;
  }

  /**
   * Returns this result unchanged because there is no error to recover from.
   *
   * @param handlers Handler map that would be used for an error result.
   * @returns This successful result.
   *
   * @example
   * ```typescript
   * const result = Result.ok(42).orElseMatch({
   *   ValidationError: () => Result.ok(0),
   *   NetworkError: () => Result.err("retry"),
   * });
   * // Ok(42)
   * ```
   */
  orElseMatch<
    const Handlers extends E extends MatchableError
      ? MatchResultHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): Result<T | MatchResultValue<Handlers>, MatchResultError<Handlers>> {
    void handlers;
    return this as Result<T | MatchResultValue<Handlers>, MatchResultError<Handlers>>;
  }

  /**
   * Returns this result unchanged because there is no matching error to recover from.
   *
   * @param handlers Partial handler map for tagged errors.
   * @returns This successful result.
   *
   * @example
   * ```typescript
   * const result = Result.ok(42).orElseMatchSome({
   *   ValidationError: () => Result.ok(0),
   * });
   * // Ok(42)
   * ```
   */
  orElseMatchSome<
    const Handlers extends E extends MatchableError
      ? MatchSomeResultHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): Result<
    T | MatchResultValue<Handlers>,
    | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
    | MatchResultError<Handlers>
  > {
    void handlers;
    return this as Result<
      T | MatchResultValue<Handlers>,
      | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
      | MatchResultError<Handlers>
    >;
  }

  /**
   * Runs a side effect with the contained value and returns this result.
   *
   * @param f Function to call with the success value.
   * @returns This result.
   */
  inspect(f: (value: T) => void): this {
    f(this.value);
    return this;
  }

  /**
   * Returns this result unchanged without calling `f`.
   *
   * @param f Function that would observe an error value.
   * @returns This result.
   */
  inspectErr(f: (err: E) => void): this {
    void f;
    return this;
  }

  /**
   * Wraps this result in an {@link AsyncResult} for asynchronous composition.
   *
   * @returns An async wrapper that resolves to this result.
   */
  async(): AsyncResult<T, E> {
    return new AsyncResult(Promise.resolve(this));
  }

  /**
   * Supports `yield*` inside {@link Result.run} generator workflows.
   *
   * Successful results immediately return their contained value to the
   * generator, so execution continues with the unwrapped value.
   *
   * @returns A generator-compatible representation of this result.
   */
  // deno-lint-ignore require-yield
  *[Symbol.iterator](): Generator<Err<never, E>, T, unknown> {
    return this.value;
  }
}

/**
 * Failed {@link Result} variant.
 *
 * Most code should create error results with {@link Result.err}, but `Err` is
 * exported for direct construction and type narrowing.
 */
export class Err<T, E = never> implements BaseResult<T, E> {
  /** The error carried by this result. */
  error: E;

  /**
   * Creates a failed result.
   *
   * @param err The error value to store.
   */
  constructor(err: E) {
    this.error = err;
  }

  /** Returns `false` because this result is not successful. */
  isOk(): this is Ok<T, E> {
    return false;
  }

  /** Returns `true` because this result is an error. */
  isErr(): this is Err<T, E> {
    return true;
  }

  /**
   * Returns the provided fallback value.
   *
   * @param defaultValue Value to return for the error case.
   * @returns `defaultValue`.
   */
  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Throws an `Error` with the provided message.
   *
   * @param message Error message to throw.
   * @throws {Error}
   */
  expect(message: string): T {
    throw new Error(message);
  }

  /**
   * Returns the contained error.
   *
   * @param message Error message that would be used for a successful result.
   * @returns The contained error.
   */
  expectErr(message: string): E {
    void message;
    return this.error;
  }

  /**
   * Returns this result unchanged because there is no success value to map.
   *
   * @param f Function that would map a success value.
   * @returns This result with the same error value.
   */
  map<U>(f: (value: T) => U): Result<U, E> {
    void f;
    // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
    return this as Err<U, E>;
  }

  /**
   * Transforms the contained error.
   *
   * @param f Function that maps the error value to a new error.
   * @returns A new failed result with the mapped error.
   *
   * @example
   * ```typescript
   * const result = Result.err("boom").mapErr((error) => error.toUpperCase());
   * // Err("BOOM")
   * ```
   */
  mapErr<F>(f: (err: E) => F): Result<T, F> {
    return new Err(f(this.error));
  }

  /**
   * Returns this result unchanged because the success path is skipped.
   *
   * @param f Function that would produce the next result from a success value.
   * @returns This result with the same error value.
   */
  andThen<U, F>(f: (value: T) => Result<U, F>): Result<U, E | F> {
    void f;
    // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
    return this as Err<U, E | F>;
  }

  /**
   * Recovers from the error by returning another result.
   *
   * @param f Function that receives the error value and returns a recovery result.
   * @returns The result returned by `f`.
   *
   * @example
   * ```typescript
   * const result = Result.err("missing value").orElse((error) =>
   *   error === "missing value" ? Result.ok("default") : Result.err(error)
   * );
   * ```
   */
  orElse<U, F>(f: (err: E) => Result<U, F>): Result<T | U, F> {
    return f(this.error);
  }

  /**
   * Recovers from a tagged error with an exhaustive set of result-returning handlers.
   *
   * @param handlers Mapping from `_tag` values to handler functions.
   * @returns The result returned by the matching handler.
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
   * const result = Result.err<number, ValidationError | NetworkError>(
   *   new ValidationError({ field: "email" }),
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
      ? MatchResultHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): Result<T | MatchResultValue<Handlers>, MatchResultError<Handlers>> {
    const error = this.error as E & MatchableError;
    const handler = handlers[error._tag as keyof Handlers] as unknown as (
      error: E,
    ) => Result<MatchResultValue<Handlers>, MatchResultError<Handlers>>;

    return handler(error) as Result<
      T | MatchResultValue<Handlers>,
      MatchResultError<Handlers>
    >;
  }

  /**
   * Recovers from matching tagged errors and leaves unhandled ones unchanged.
   *
   * @param handlers Partial mapping from `_tag` values to result-returning handlers.
   * @returns The matching handler result or the remaining `Err`.
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
   * const result = Result.err<number, ValidationError | NetworkError>(
   *   new NetworkError({ status: 503 }),
   * );
   *
   * const recovered = result.orElseMatchSome({
   *   ValidationError: (error) => Result.ok(error.field.length),
   * });
   * // Err(NetworkError)
   * ```
   */
  orElseMatchSome<
    const Handlers extends E extends MatchableError
      ? MatchSomeResultHandlers<E>
      : never,
  >(
    handlers: Handlers,
  ): Result<
    T | MatchResultValue<Handlers>,
    | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
    | MatchResultError<Handlers>
  > {
    const error = this.error as E & MatchableError;
    const handler = handlers[error._tag as keyof Handlers] as
      | ((
        error: E,
      ) => Result<MatchResultValue<Handlers>, MatchResultError<Handlers>>)
      | undefined;

    if (!handler) {
      return this as Result<
        T | MatchResultValue<Handlers>,
        | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
        | MatchResultError<Handlers>
      >;
    }

    return handler(error) as Result<
      T | MatchResultValue<Handlers>,
      | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
      | MatchResultError<Handlers>
    >;
  }

  /**
   * Returns this result unchanged without calling `f`.
   *
   * @param f Function that would observe a success value.
   * @returns This result.
   */
  inspect(f: (value: T) => void): this {
    void f;
    return this;
  }

  /**
   * Runs a side effect with the contained error and returns this result.
   *
   * @param f Function to call with the error value.
   * @returns This result.
   */
  inspectErr(f: (err: E) => void): this {
    f(this.error);
    return this;
  }

  /**
   * Wraps this result in an {@link AsyncResult} for asynchronous composition.
   *
   * @returns An async wrapper that resolves to this result.
   */
  async(): AsyncResult<T, E> {
    return new AsyncResult(Promise.resolve(this));
  }

  /**
   * Supports `yield*` inside {@link Result.run} generator workflows.
   *
   * Failed results yield themselves so {@link Result.run} can stop early and
   * return the error.
   *
   * @returns A generator-compatible representation of this result.
   */
  *[Symbol.iterator](): Generator<Err<never, E>, T, unknown> {
    // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
    yield this;
    throw "unreachable";
  }
}
