import { AsyncResult } from "@joyful/result";

interface BaseResult<T, E = unknown> {
  isOk(): this is Ok<T, E>;
  isErr(): this is Err<T, E>;
  unwrapOr(defaultValue: T): T;
  expect(message: string): T;
  expectErr(message: string): E;
  map<U>(f: (value: T) => U): BaseResult<U, E>;
  mapErr<F>(f: (err: E) => F): BaseResult<T, F>;
  andThen<U, F>(f: (value: T) => BaseResult<U, F>): BaseResult<U, E | F>;
  orElse<U, F>(f: (err: E) => BaseResult<U, F>): BaseResult<T | U, F>;
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
  map<U>(f: (value: T) => U): BaseResult<U, E> {
    return new Ok(f(this.value));
  }

  /**
   * Returns this result unchanged because there is no error to map.
   *
   * @param f Function that would map an error value.
   * @returns This result with the same success value.
   */
  mapErr<F>(f: (err: E) => F): BaseResult<T, F> {
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
  andThen<U, F>(f: (value: T) => BaseResult<U, F>): BaseResult<U, E | F> {
    return f(this.value);
  }

  /**
   * Returns this result unchanged because it is already successful.
   *
   * @param f Function that would recover from an error.
   * @returns This result with the same success value.
   */
  orElse<U, F>(f: (err: E) => BaseResult<U, F>): BaseResult<T | U, F> {
    void f;
    // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
    return this as Ok<T | U, F>;
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
  map<U>(f: (value: T) => U): BaseResult<U, E> {
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
  mapErr<F>(f: (err: E) => F): BaseResult<T, F> {
    return new Err(f(this.error));
  }

  /**
   * Returns this result unchanged because the success path is skipped.
   *
   * @param f Function that would produce the next result from a success value.
   * @returns This result with the same error value.
   */
  andThen<U, F>(f: (value: T) => BaseResult<U, F>): BaseResult<U, E | F> {
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
  orElse<U, F>(f: (err: E) => BaseResult<U, F>): BaseResult<T | U, F> {
    return f(this.error);
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
}

/**
 * A value that is either a successful {@link Ok} or a failed {@link Err}.
 *
 * `Result` makes failure explicit in the type system. Callers can branch with
 * `isOk()` and `isErr()`, transform values with `map()` and `mapErr()`, and
 * chain operations with `andThen()` and `orElse()`.
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
}
