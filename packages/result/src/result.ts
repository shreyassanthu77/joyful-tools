/**
 * Base interface for Result types that provides common methods for handling
 * success and error states.
 * 
 * This interface defines the contract that both Ok and Err classes must implement,
 * ensuring consistent behavior across all Result variants.
 */
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

interface BaseResult<T, E> {
  /** Returns true if this is an Ok (success) value */
  ok(): boolean;
  /** Returns true if this is an Err (error) value */
  err(): boolean;
  /** Returns the success value, throws if this is an Err */
  unwrap(): T;
  /** Returns the error value, throws if this is an Ok */
  unwrapErr(): E;
  /** Returns the success value or the provided default if this is an Err */
  unwrapOr(defaultValue: T): T;
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

  /**
   * Type guard that returns true for Ok instances.
   * @returns true (always, since this is an Ok)
   */
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
 * Creates a function that maps the success value of a Result.
 * 
 * This function takes a mapping function and returns a new function that
 * can be applied to a Result. If the Result is Ok, the mapping function
 * is applied to the contained value. If the Result is Err, it is passed
 * through unchanged.
 * 
 * @param f - Function to apply to the success value
 * @returns A function that takes a Result and returns a mapped Result
 * 
 * @example
 * ```typescript
 * const result = new Ok(5);
 * const doubled = map((x: number) => x * 2)(result);
 * console.log(doubled.unwrap()); // 10
 * 
 * const error = new Err("failed");
 * const unchanged = map((x: number) => x * 2)(error);
 * console.log(unchanged.unwrapErr()); // "failed"
 * ```
 */
export function map<T, U, E>(
  f: (value: T) => U,
): (result: Result<T, E>) => Result<U, E> {
  return (result: Result<T, E>): Result<U, E> => {
    return result instanceof Ok
      ? new Ok(f(result.value))
      : (result as Err<E, never>);
  };
}

/**
 * Creates a function that maps the error value of a Result.
 * 
 * This function takes a mapping function and returns a new function that
 * can be applied to a Result. If the Result is Err, the mapping function
 * is applied to the contained error. If the Result is Ok, it is passed
 * through unchanged.
 * 
 * @param f - Function to apply to the error value
 * @returns A function that takes a Result and returns a Result with mapped error
 * 
 * @example
 * ```typescript
 * const result = new Err("network error");
 * const withCode = mapErr((msg: string) => `ERROR: ${msg}`)(result);
 * console.log(withCode.unwrapErr()); // "ERROR: network error"
 * 
 * const success = new Ok(42);
 * const unchanged = mapErr((msg: string) => `ERROR: ${msg}`)(success);
 * console.log(unchanged.unwrap()); // 42
 * ```
 */
export function mapErr<T, U, E>(
  f: (error: E) => U,
): (result: Result<T, E>) => Result<T, U> {
  return (result: Result<T, E>): Result<T, U> => {
    return result instanceof Err
      ? new Err(f(result.error))
      : (result as Ok<T, never>);
  };
}

/**
 * Creates a function that chains operations that return Results.
 * 
 * This function is used for chaining operations that might fail. If the
 * input Result is Ok, the provided function is applied to the contained
 * value and its Result is returned. If the input Result is Err, it is
 * passed through unchanged (short-circuiting the chain).
 * 
 * This is equivalent to the "bind" or "flatMap" operation in functional
 * programming.
 * 
 * @param f - Function that takes a success value and returns a new Result
 * @returns A function that chains Results together
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
 * const validate = (age: number): Result<string, string> => {
 *   if (age < 18) return new Err("Too young");
 *   return new Ok("Valid");
 * };
 * 
 * const result = new Ok("25");
 * const final = andThen(parseAge)(result);
 * const validated = andThen(validate)(final);
 * console.log(validated.unwrap()); // "Valid"
 * ```
 */
export function andThen<T1, T2, E1, E2>(
  f: (value: T1) => Result<T2, E2>,
): (result: Result<T1, E1>) => Result<T2, E1 | E2> {
  return (result: Result<T1, E1>): Result<T2, E1 | E2> => {
    return result instanceof Ok ? f(result.value) : (result as Err<E1, never>);
  };
}

/**
 * Creates a function that provides fallback behavior for Results.
 * 
 * This function is used to provide alternative operations when a Result
 * is an Err. If the input Result is Err, the provided function is applied
 * to the error value and its Result is returned. If the input Result is
 * Ok, it is passed through unchanged.
 * 
 * This is useful for providing default values or alternative recovery
 * strategies when operations fail.
 * 
 * @param f - Function that takes an error value and returns a fallback Result
 * @returns A function that provides fallback behavior for Results
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
 * const fallback = orElse(fetchFromDB)(result);
 * console.log(fallback.unwrap()); // "Data for [id]"
 * 
 * const success = new Ok("Already have data");
 * const unchanged = orElse(fetchFromDB)(success);
 * console.log(unchanged.unwrap()); // "Already have data"
 * ```
 */
export function orElse<T1, T2, E1, E2>(
  f: (error: E1) => Result<T2, E2>,
): (result: Result<T1, E1>) => Result<T1 | T2, E2> {
  return (result: Result<T1, E1>): Result<T1 | T2, E2> => {
    return result instanceof Err ? f(result.error) : (result as Ok<T1, never>);
  };
}

/**
 * Creates a function that pattern matches on a Result.
 * 
 * This function provides a way to handle both success and error cases
 * in a single expression. It takes two handler functions - one for Ok
 * values and one for Err values - and returns a function that applies
 * the appropriate handler based on the Result variant.
 * 
 * This is similar to pattern matching in languages like Rust or Haskell.
 * 
 * @param ok - Function to handle Ok (success) values
 * @param err - Function to handle Err (error) values
 * @returns A function that pattern matches on a Result
 * 
 * @example
 * ```typescript
 * const result = new Ok(42);
 * const message = match(
 *   (value: number) => `Success: ${value}`,
 *   (error: string) => `Error: ${error}`
 * )(result);
 * console.log(message); // "Success: 42"
 * 
 * const error = new Err("Something went wrong");
 * const errorMsg = match(
 *   (value: number) => `Success: ${value}`,
 *   (error: string) => `Error: ${error}`
 * )(error);
 * console.log(errorMsg); // "Error: Something went wrong"
 * ```
 */
export function match<T, E, U>(
  ok: (value: T) => U,
  err: (error: E) => U,
): (result: Result<T, E>) => U {
  return (result: Result<T, E>): U => {
    return result instanceof Ok ? ok(result.value) : err(result.error);
  };
}
