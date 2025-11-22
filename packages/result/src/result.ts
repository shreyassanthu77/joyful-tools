import { Option, Some, None, fromNullable } from "@joyful/option";

/**
 * A TypeScript implementation of the Result type for error handling.
 *
 * This module provides a robust way to handle operations that might fail
 * without throwing exceptions. The Result type represents either success
 * (Ok) or failure (Err) and forces explicit handling of both cases.
 *
 * Inspired by Rust's Result type, this implementation provides:
 * - Type-safe error handling
 * - Functional composition utilities (map, andThen, etc.)
 * - Pattern matching capabilities
 * - Integration with functional programming patterns
 *
 * @example
 * ```typescript
 * import { Result } from "@joyful/result";
 *
 * // Function that might fail
 * function parseJson(json: string): Result<object, string> {
 *   try {
 *     return new Ok(JSON.parse(json));
 *   } catch (e) {
 *     return new Err(`Invalid JSON: ${e.message}`);
 *   }
 * }
 *
 * // Using the Result
 * const result = parseJson('{"name": "Alice"}');
 *
 * if (result.ok()) {
 *   console.log("Parsed:", result.unwrap());
 * } else {
 *   console.log("Error:", result.unwrapErr());
 * }
 *
 * // Functional composition (works great with @joyful/pipe)
 * import { pipe } from "@joyful/pipe";
 * const processed = pipe(
 *   parseJson('{"age": 25}'),
 *   Result.map((obj: any) => obj.age),
 *   Result.map((age: number) => age + 1)
 * );
 * ```
 *
 * @module
 */

/**
 * Base interface for Result types that provides common methods for handling
 * success and error states.
 *
 * This interface defines the contract that both Ok and Err classes must implement,
 * ensuring consistent behavior across all Result variants.
 */

/**
 * Base interface for Result types that provides common methods for handling
 * success and error states.
 *
 * This interface defines the contract that both Ok and Err classes must implement,
 * ensuring consistent behavior across all Result variants.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 */
interface BaseResult<T, E> {
  /**
   * Type guard that returns true if this is an Ok (success) value.
   * @returns true for Ok instances, false for Err instances
   */
  ok(): boolean;
  
  /**
   * Type guard that returns true if this is an Err (error) value.
   * @returns true for Err instances, false for Ok instances
   */
  err(): boolean;
  
  /**
   * Returns the contained success value.
   * @throws Error if called on an Err value
   * @returns The success value of type T
   */
  unwrap(): T;
  
  /**
   * Returns the contained error value.
   * @throws Error if called on an Ok value
   * @returns The error value of type E
   */
  unwrapErr(): E;
  
  /**
   * Returns the success value or the provided default if this is an Err.
   * @param defaultValue - The default value to return if this is an Err
   * @returns The success value or the default value
   */
  unwrapOr(defaultValue: T): T;

  /**
   * Converts from `Result<T, E>` to `Option<T>`.
   *
   * @returns `Some(value)` if the result is Ok, otherwise `None`.
   */
  toOption(): Option<NonNullable<T>>;

  /**
   * Converts from `Result<T, E>` to `Option<E>`.
   *
   * @returns `Some(error)` if the result is Err, otherwise `None`.
   */
  errToOption(): Option<NonNullable<E>>;
}

/**
 * Represents a successful result containing a value of type T.
 *
 * Ok is used to indicate that an operation succeeded and contains the
 * successful result. It implements the BaseResult interface to provide
 * consistent error handling behavior.
 *
 * @example
 * ```typescript
 * const result = new Ok(42);
 * console.log(result.ok()); // true
 * console.log(result.unwrap()); // 42
 * ```
 */
export class Ok<T, E = never> implements BaseResult<T, E> {
  /** The success value contained in this Ok */
  constructor(public value: T) {}
  ok(): this is Ok<T, E> {
    return true;
  }

  /**
   * Type guard that returns false for Ok instances.
   * @returns false (always, since this is an Ok)
   */
  err(): this is Err<E, T> {
    return false;
  }

  /**
   * Returns the contained success value.
   * @returns The success value
   */
  unwrap(): T {
    return this.value;
  }

  /**
   * Throws an error since this is an Ok, not an Err.
   * @throws Error with message "called `unwrapErr` on an `Ok` value"
   */
  unwrapErr(): E {
    throw new Error("called `unwrapErr` on an `Ok` value");
  }

  /**
   * Returns the contained success value, ignoring the default parameter.
   * @param _ - Default value (ignored for Ok)
   * @returns The success value
   */
  unwrapOr(_: T): T {
    return this.value;
  }

  /**
   * Converts the Ok value into an Option.
   * @returns Some(value) if value is not null/undefined, otherwise None
   */
  toOption(): Option<NonNullable<T>> {
    return fromNullable(this.value);
  }

  /**
   * Converts the Ok value into None (since we're looking for an error).
   * @returns None
   */
  errToOption(): Option<NonNullable<E>> {
    return None;
  }
}

/**
 * Represents an error result containing an error of type E.
 *
 * Err is used to indicate that an operation failed and contains the
 * error information. It implements the BaseResult interface to provide
 * consistent error handling behavior.
 *
 * @example
 * ```typescript
 * const result = new Err("Something went wrong");
 * console.log(result.err()); // true
 * console.log(result.unwrapErr()); // "Something went wrong"
 * ```
 */
export class Err<E, T = never> implements BaseResult<T, E> {
  /** The error value contained in this Err */
  constructor(public error: E) {}

  /**
   * Type guard that returns false for Err instances.
   * @returns false (always, since this is an Err)
   */
  ok(): this is Ok<T, E> {
    return false;
  }

  /**
   * Type guard that returns true for Err instances.
   * @returns true (always, since this is an Err)
   */
  err(): this is Err<E, T> {
    return true;
  }

  /**
   * Throws an error since this is an Err, not an Ok.
   * @throws Error with message "called `unwrap` on an `Err` value"
   */
  unwrap(): T {
    throw new Error("called `unwrap` on an `Err` value");
  }

  /**
   * Returns the contained error value.
   * @returns The error value
   */
  unwrapErr(): E {
    return this.error;
  }

  /**
   * Returns the provided default value since this is an Err.
   * @param defaultValue - The default value to return
   * @returns The default value
   */
  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Converts the Err value into None.
   * @returns None
   */
  toOption(): Option<NonNullable<T>> {
    return None;
  }

  /**
   * Converts the Err value into a Some.
   * @returns Some(error)
   */
  errToOption(): Option<NonNullable<E>> {
    return fromNullable(this.error);
  }
}

/**
 * A Result type that represents either success (Ok) or failure (Err).
 *
 * Result is a powerful way to handle operations that might fail without
 * throwing exceptions. It forces the caller to handle both success and error
 * cases explicitly, leading to more robust and predictable code.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 *
 * @example
 * ```typescript
 * function parseNumber(str: string): Result<number, string> {
 *   const num = parseFloat(str);
 *   if (isNaN(num)) {
 *     return new Err("Invalid number");
 *   }
 *   return new Ok(num);
 * }
 *
 * const result = parseNumber("42");
 * if (result.ok()) {
 *   console.log("Success:", result.unwrap()); // 42
 * } else {
 *   console.log("Error:", result.unwrapErr());
 * }
 * ```
 */
export type Result<T, E> = Ok<T, E> | Err<E, T>;

/**
 * Wraps a throwable function in a Result.
 *
 * This function executes the provided function and returns an Ok containing
 * the result if successful, or an Err containing the transformed error if
 * an exception is thrown.
 *
 * @param fn - The function that might throw an exception
 * @param onError - Function to transform the caught error into an error value
 * @returns A Result containing either the success value or the transformed error
 *
 * @example
 * ```typescript
 * const parseJson = (json: string) => fromThrowable(
 *   () => JSON.parse(json),
 *   (e) => `Invalid JSON: ${e.message}`
 * );
 *
 * const result = parseJson('{"name": "Alice"}');
 * // Returns: Ok({name: "Alice"})
 *
 * const badResult = parseJson('invalid json');
 * // Returns: Err("Invalid JSON: Unexpected token...")
 * ```
 */
export function fromThrowable<T, E>(
  fn: () => T,
  onError: (error: unknown) => E,
): Result<T, E> {
  try {
    const result = fn();
    return new Ok(result);
  } catch (e) {
    return new Err(onError(e));
  }
}

/**
 * Maps the success value of a Result.
 *
 * This function supports two calling patterns:
 * 1. Curried: `map(fn)(result)` - perfect for pipe composition
 * 2. Binary: `map(result, fn)` - more intuitive for direct calls
 *
 * If the Result is Ok, the mapping function is applied to the contained value.
 * If the Result is Err, it is passed through unchanged.
 *
 * @example
 * ```typescript
 * const result = new Ok(5);
 *
 * // Curried form (great for pipes)
 * const doubled = map((x: number) => x * 2)(result);
 * console.log(doubled.unwrap()); // 10
 *
 * // Binary form (more direct)
 * const doubled2 = map(result, (x: number) => x * 2);
 * console.log(doubled2.unwrap()); // 10
 *
 * const error = new Err("failed");
 * const unchanged = map(error, (x: number) => x * 2);
 * console.log(unchanged.unwrapErr()); // "failed"
 * ```
 */
export function map<T, U, E>(
  result: Result<T, E>,
  f: (value: T) => U,
): Result<U, E>;
export function map<T, U, E>(
  f: (value: T) => U,
): (result: Result<T, E>) => Result<U, E>;
export function map<T, U, E>(
  resultOrFn: Result<T, E> | ((value: T) => U),
  maybeFn?: (value: T) => U,
): Result<U, E> | ((result: Result<T, E>) => Result<U, E>) {
  // Binary form: map(result, fn)
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T, E>;
    const f = maybeFn;
    return result instanceof Ok
      ? new Ok(f(result.value))
      : (result as Err<E, never>);
  }

  // Curried form: map(fn)(result)
  const f = resultOrFn as (value: T) => U;
  return (result: Result<T, E>): Result<U, E> => {
    return result instanceof Ok
      ? new Ok(f(result.value))
      : (result as Err<E, never>);
  };
}

/**
 * Maps the error value of a Result.
 *
 * This function supports two calling patterns:
 * 1. Curried: `mapErr(fn)(result)` - perfect for pipe composition
 * 2. Binary: `mapErr(result, fn)` - more intuitive for direct calls
 *
 * If the Result is Err, the mapping function is applied to the contained error.
 * If the Result is Ok, it is passed through unchanged.
 *
 * @example
 * ```typescript
 * const result = new Err("network error");
 *
 * // Curried form (great for pipes)
 * const withCode = mapErr((msg: string) => `ERROR: ${msg}`)(result);
 * console.log(withCode.unwrapErr()); // "ERROR: network error"
 *
 * // Binary form (more direct)
 * const withCode2 = mapErr(result, (msg: string) => `ERROR: ${msg}`);
 * console.log(withCode2.unwrapErr()); // "ERROR: network error"
 *
 * const success = new Ok(42);
 * const unchanged = mapErr(success, (msg: string) => `ERROR: ${msg}`);
 * console.log(unchanged.unwrap()); // 42
 * ```
 */
export function mapErr<T, U, E>(
  result: Result<T, E>,
  f: (error: E) => U,
): Result<T, U>;
export function mapErr<T, U, E>(
  f: (error: E) => U,
): (result: Result<T, E>) => Result<T, U>;
export function mapErr<T, U, E>(
  resultOrFn: Result<T, E> | ((error: E) => U),
  maybeFn?: (error: E) => U,
): Result<T, U> | ((result: Result<T, E>) => Result<T, U>) {
  // Binary form: mapErr(result, fn)
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T, E>;
    const f = maybeFn;
    return result instanceof Err
      ? new Err(f(result.error))
      : (result as Ok<T, never>);
  }

  // Curried form: mapErr(fn)(result)
  const f = resultOrFn as (error: E) => U;
  return (result: Result<T, E>): Result<T, U> => {
    return result instanceof Err
      ? new Err(f(result.error))
      : (result as Ok<T, never>);
  };
}

/**
 * Chains operations that return Results.
 *
 * This function supports two calling patterns:
 * 1. Curried: `andThen(fn)(result)` - perfect for pipe composition
 * 2. Binary: `andThen(result, fn)` - more intuitive for direct calls
 *
 * If the input Result is Ok, the provided function is applied to the contained
 * value and its Result is returned. If the input Result is Err, it is
 * passed through unchanged (short-circuiting the chain).
 *
 * This is equivalent to the "bind" or "flatMap" operation in functional
 * programming.
 *
 * @example
 * ```typescript
 * const parseAge = (str: string): Result<number, string> => {
 *   const age = parseInt(str, 10);
 *   if (isNaN(age)) return new Err("Invalid number");
 *   if (age < 0) return new Err("Age cannot be negative");
 *   if (age > 150) return new Err("Age too high");
 *   return new Ok(age);
 * };
 *
 * const result = new Ok("25");
 *
 * // Curried form (great for pipes)
 * const final = andThen(parseAge)(result);
 * console.log(final.unwrap()); // 25
 *
 * // Binary form (more direct)
 * const final2 = andThen(result, parseAge);
 * console.log(final2.unwrap()); // 25
 * ```
 */
export function andThen<T1, T2, E1, E2>(
  result: Result<T1, E1>,
  f: (value: T1) => Result<T2, E2>,
): Result<T2, E1 | E2>;
export function andThen<T1, T2, E1, E2>(
  f: (value: T1) => Result<T2, E2>,
): (result: Result<T1, E1>) => Result<T2, E1 | E2>;
export function andThen<T1, T2, E1, E2>(
  resultOrFn: Result<T1, E1> | ((value: T1) => Result<T2, E2>),
  maybeFn?: (value: T1) => Result<T2, E2>,
): Result<T2, E1 | E2> | ((result: Result<T1, E1>) => Result<T2, E1 | E2>) {
  // Binary form: andThen(result, fn)
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T1, E1>;
    const f = maybeFn;
    return result instanceof Ok ? f(result.value) : (result as Err<E1, never>);
  }

  // Curried form: andThen(fn)(result)
  const f = resultOrFn as (value: T1) => Result<T2, E2>;
  return (result: Result<T1, E1>): Result<T2, E1 | E2> => {
    return result instanceof Ok ? f(result.value) : (result as Err<E1, never>);
  };
}

/**
 * Provides fallback behavior for Results.
 *
 * This function supports two calling patterns:
 * 1. Curried: `orElse(fn)(result)` - perfect for pipe composition
 * 2. Binary: `orElse(result, fn)` - more intuitive for direct calls
 *
 * If the input Result is Err, the provided function is applied
 * to the error value and its Result is returned. If the input Result is
 * Ok, it is passed through unchanged.
 *
 * This is useful for providing default values or alternative recovery
 * strategies when operations fail.
 *
 * @example
 * ```typescript
 * const fetchFromCache = (id: string): Result<string, string> => {
 *   // Simulate cache miss
 *   return new Err("Not found in cache");
 * };
 *
 * const fetchFromDB = (id: string): Result<string, string> => {
 *   // Simulate database fetch
 *   return new Ok(`Data for ${id}`);
 * };
 *
 * const result = new Err("Not found in cache");
 *
 * // Curried form (great for pipes)
 * const fallback = orElse(fetchFromDB)(result);
 * console.log(fallback.unwrap()); // "Data for [id]"
 *
 * // Binary form (more direct)
 * const fallback2 = orElse(result, fetchFromDB);
 * console.log(fallback2.unwrap()); // "Data for [id]"
 *
 * const success = new Ok("Already have data");
 * const unchanged = orElse(success, fetchFromDB);
 * console.log(unchanged.unwrap()); // "Already have data"
 * ```
 */
export function orElse<T1, T2, E1, E2>(
  result: Result<T1, E1>,
  f: (error: E1) => Result<T2, E2>,
): Result<T1 | T2, E2>;
export function orElse<T1, T2, E1, E2>(
  f: (error: E1) => Result<T2, E2>,
): (result: Result<T1, E1>) => Result<T1 | T2, E2>;
export function orElse<T1, T2, E1, E2>(
  resultOrFn: Result<T1, E1> | ((error: E1) => Result<T2, E2>),
  maybeFn?: (error: E1) => Result<T2, E2>,
): Result<T1 | T2, E2> | ((result: Result<T1, E1>) => Result<T1 | T2, E2>) {
  // Binary form: orElse(result, fn)
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T1, E1>;
    const f = maybeFn;
    return result instanceof Err ? f(result.error) : (result as Ok<T1, never>);
  }

  // Curried form: orElse(fn)(result)
  const f = resultOrFn as (error: E1) => Result<T2, E2>;
  return (result: Result<T1, E1>): Result<T1 | T2, E2> => {
    return result instanceof Err ? f(result.error) : (result as Ok<T1, never>);
  };
}

/**
 * Pattern matches on a Result.
 *
 * This function supports two calling patterns:
 * 1. Curried: `match(okFn, errFn)(result)` - perfect for pipe composition
 * 2. Binary: `match(result, okFn, errFn)` - more intuitive for direct calls
 *
 * This function provides a way to handle both success and error cases
 * in a single expression. It takes two handler functions - one for Ok
 * values and one for Err values - and applies the appropriate handler
 * based on the Result variant.
 *
 * This is similar to pattern matching in languages like Rust or Haskell.
 *
 * @example
 * ```typescript
 * const result = new Ok(42);
 *
 * // Curried form (great for pipes)
 * const message = match(
 *   (value: number) => `Success: ${value}`,
 *   (error: string) => `Error: ${error}`
 * )(result);
 * console.log(message); // "Success: 42"
 *
 * // Binary form (more direct)
 * const message2 = match(
 *   result,
 *   (value: number) => `Success: ${value}`,
 *   (error: string) => `Error: ${error}`
 * );
 * console.log(message2); // "Success: 42"
 *
 * const error = new Err("Something went wrong");
 * const errorMsg = match(
 *   error,
 *   (value: number) => `Success: ${value}`,
 *   (error: string) => `Error: ${error}`
 * );
 * console.log(errorMsg); // "Error: Something went wrong"
 * ```
 */
export function match<T, E, U>(
  result: Result<T, E>,
  ok: (value: T) => U,
  err: (error: E) => U,
): U;
export function match<T, E, U>(
  ok: (value: T) => U,
  err: (error: E) => U,
): (result: Result<T, E>) => U;
export function match<T, E, U>(
  okOrResult: ((value: T) => U) | Result<T, E>,
  errOrOk?: ((error: E) => U) | ((value: T) => U),
  maybeErr?: (error: E) => U,
): U | ((result: Result<T, E>) => U) {
  // Binary form: match(result, okFn, errFn)
  if (maybeErr !== undefined) {
    const result = okOrResult as Result<T, E>;
    const ok = errOrOk as (value: T) => U;
    const err = maybeErr;
    return result instanceof Ok ? ok(result.value) : err(result.error);
  }

  // Curried form: match(okFn, errFn)(result)
  const ok = okOrResult as (value: T) => U;
  const err = errOrOk as (error: E) => U;
  return (result: Result<T, E>): U => {
    return result instanceof Ok ? ok(result.value) : err(result.error);
  };
}

/**
 * Converts an Option<T> to a Result<T, E>.
 *
 * This function supports two calling patterns:
 * 1. Curried: `okOr(error)(option)` - perfect for pipe composition
 * 2. Binary: `okOr(option, error)` - more intuitive for direct calls
 *
 * Transforms `Option<T>` into `Result<T, E>`, mapping `Some(v)` to
 * `Ok(v)` and `None` to `Err(error)`.
 *
 * @example
 * ```typescript
 * import { Some, None } from "@joyful/option";
 *
 * const x = new Some("foo");
 * const r = okOr(x, 0); // Ok("foo")
 *
 * const y = None;
 * const r2 = okOr(y, 0); // Err(0)
 * ```
 */
export function okOr<T, E>(
  option: Option<T>,
  error: E,
): Result<T, E>;
export function okOr<T, E>(
  error: E,
): (option: Option<T>) => Result<T, E>;
export function okOr<T, E>(
  optionOrError: Option<T> | E,
  maybeError?: E,
): Result<T, E> | ((option: Option<T>) => Result<T, E>) {
  // Binary form: okOr(option, error)
  if (arguments.length === 2) {
    const option = optionOrError as Option<T>;
    const error = maybeError as E;
    return option.isSome() ? new Ok(option.unwrap()) : new Err(error);
  }

  // Curried form: okOr(error)(option)
  const error = optionOrError as E;
  return (option: Option<T>): Result<T, E> => {
    return option.isSome() ? new Ok(option.unwrap()) : new Err(error);
  };
}

/**
 * Converts an Option<T> to a Result<T, E>.
 *
 * This function supports two calling patterns:
 * 1. Curried: `okOrElse(errFn)(option)` - perfect for pipe composition
 * 2. Binary: `okOrElse(option, errFn)` - more intuitive for direct calls
 *
 * Transforms `Option<T>` into `Result<T, E>`, mapping `Some(v)` to
 * `Ok(v)` and `None` to `Err(errFn())`.
 *
 * @example
 * ```typescript
 * import { Some, None } from "@joyful/option";
 *
 * const x = new Some("foo");
 * const r = okOrElse(x, () => 0); // Ok("foo")
 *
 * const y = None;
 * const r2 = okOrElse(y, () => 0); // Err(0)
 * ```
 */
export function okOrElse<T, E>(
  option: Option<T>,
  errFn: () => E,
): Result<T, E>;
export function okOrElse<T, E>(
  errFn: () => E,
): (option: Option<T>) => Result<T, E>;
export function okOrElse<T, E>(
  optionOrFn: Option<T> | (() => E),
  maybeFn?: () => E,
): Result<T, E> | ((option: Option<T>) => Result<T, E>) {
  // Binary form: okOrElse(option, errFn)
  if (arguments.length === 2) {
    const option = optionOrFn as Option<T>;
    const errFn = maybeFn as () => E;
    return option.isSome() ? new Ok(option.unwrap()) : new Err(errFn());
  }

  // Curried form: okOrElse(errFn)(option)
  const errFn = optionOrFn as () => E;
  return (option: Option<T>): Result<T, E> => {
    return option.isSome() ? new Ok(option.unwrap()) : new Err(errFn());
  };
}
