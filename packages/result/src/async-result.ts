/**
 * Async utilities for working with Result types.
 *
 * This module provides async-compatible versions of the Result utilities,
 * allowing you to work with operations that return Promises and Results.
 * It includes functions for converting promises to AsyncResults and
 * functional composition utilities that work with both sync and async operations.
 *
 * The AsyncResult type extends PromiseLike to enable seamless integration
 * with async/await syntax and Promise chaining.
 *
 * @example
 * ```typescript
 * import { AsyncResult } from "@joyful/result";
 * 
 * // Convert a promise that might throw to an AsyncResult
 * const fetchData = () => fetch("/api/data");
 * const result = AsyncResult.fromThrowable(fetchData, (e) => e.message);
 * 
 * // Use with async/await
 * const data = await result;
 * if (data.ok()) {
 *   console.log("Success:", data.unwrap());
 * } else {
 *   console.log("Error:", data.unwrapErr());
 * }
 * 
 * // Functional composition with async operations
 * import { pipe } from "@joyful/pipe";
 * const processed = await pipe(
 *   result,
 *   AsyncResult.map((response) => response.json()),
 *   AsyncResult.andThen(validateData)
 * );
 * ```
 *
 * @module
 */

import { Ok, Err, type Result } from "./result.ts";

/**
 * Represents an async Result that can be awaited or chained with Promise methods.
 *
 * AsyncResult extends PromiseLike to enable seamless integration with async/await
 * syntax and Promise chaining while maintaining the Result type safety.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 */
export interface AsyncResult<T, E = unknown> extends PromiseLike<Result<T, E>> {
  /** The underlying Promise that resolves to a Result */
  readonly promise: Promise<Result<T, E>>;
}

/**
 * Internal implementation of AsyncResult.
 *
 * This class wraps a Promise<Result<T, E>> and implements the PromiseLike
 * interface to enable async/await syntax and Promise chaining.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 */
class AsyncResultImpl<T, E = unknown> implements AsyncResult<T, E> {
  /**
   * Creates a new AsyncResultImpl from a Promise that resolves to a Result.
   * @param promise - The promise that resolves to a Result
   */
  constructor(public promise: Promise<Result<T, E>>) {}

  /**
   * Implements the PromiseLike.then method for Promise chaining.
   * @param onfulfilled - Optional callback for when the promise resolves
   * @param onrejected - Optional callback for when the promise rejects
   * @returns A new promise for the result of the callbacks
   */
  then<P, Q>(
    onfulfilled?: (value: Result<T, E>) => P | PromiseLike<P>,
    onrejected?: (reason: unknown) => Q | PromiseLike<Q>,
  ): PromiseLike<P | Q> {
    return this.promise.then(onfulfilled, onrejected);
  }
}

/**
 * Converts a synchronous Result to an AsyncResult.
 *
 * This function wraps a Result in a Promise, allowing it to be used
 * with async utilities and awaited like any other AsyncResult.
 *
 * @param result - The Result to convert to an AsyncResult
 * @returns An AsyncResult that resolves to the provided Result
 *
 * @example
 * ```typescript
 * import { AsyncResult, Result } from "@joyful/result";
 * 
 * const syncResult = new Result.Ok(42);
 * const asyncResult = AsyncResult.fromResult(syncResult);
 * 
 * // Can now be awaited
 * const result = await asyncResult;
 * console.log(result.unwrap()); // 42
 * ```
 */
export function fromResult<T, E>(result: Result<T, E>): AsyncResult<T, E> {
  return new AsyncResultImpl(Promise.resolve(result));
}

/**
 * Default error handler that simply casts the error to type E.
 * @param error - The error to cast
 * @returns The error cast to type E
 */
function onErrorNoop<E>(error: unknown): E {
  return error as E;
}

/**
 * Internal helper that converts a promise factory to a Result.
 * @param promiseFactory - Function that returns a value or Promise
 * @param onError - Function to transform caught errors
 * @returns Promise that resolves to a Result
 */
async function fromPromise<T, E>(
  promiseFactory: () => T | Promise<T>,
  onError: (error: unknown) => E = onErrorNoop,
): Promise<Result<T, E>> {
  try {
    const promise = promiseFactory();
    if (promise instanceof Promise) {
      const result = await promise;
      return new Ok(result);
    } else {
      return new Ok(promise);
    }
  } catch (e) {
    return new Err(onError(e));
  }
}

/**
 * Wraps a throwable function (sync or async) in an AsyncResult.
 *
 * This function executes the provided function and returns an AsyncResult
 * that resolves to Ok containing the result if successful, or Err containing
 * the transformed error if an exception is thrown.
 *
 * @param fn - The function that might throw an exception (sync or async)
 * @param onError - Optional function to transform the caught error into an error value
 * @returns An AsyncResult that resolves to either the success value or the transformed error
 *
 * @example
 * ```typescript
 * import { AsyncResult } from "@joyful/result";
 * 
 * // Sync function that might throw
 * const parseJson = (json: string) => AsyncResult.fromThrowable(
 *   () => JSON.parse(json),
 *   (e) => `Invalid JSON: ${e.message}`
 * );
 * 
 * // Async function that might throw
 * const fetchData = () => AsyncResult.fromThrowable(
 *   async () => {
 *     const response = await fetch("/api/data");
 *     return response.json();
 *   },
 *   (e) => `Network error: ${e.message}`
 * );
 * 
 * const result = await parseJson('{"name": "Alice"}');
 * // Returns: Ok({name: "Alice"})
 * 
 * const badResult = await parseJson('invalid json');
 * // Returns: Err("Invalid JSON: Unexpected token...")
 * ```
 */
export function fromThrowable<T, E>(
  fn: () => T | Promise<T>,
  onError?: (error: unknown) => E,
): AsyncResult<T, E> {
  return new AsyncResultImpl(fromPromise(fn, onError));
}

/**
 * Internal helper that maps the success value of a Result or AsyncResult.
 * @param result - The Result or AsyncResult to map
 * @param f - The mapping function (can be sync or async)
 * @returns Promise that resolves to a Result with the mapped value
 */
async function mapInner<T, U, E>(
  result: Result<T, E> | AsyncResult<T, E>,
  f: (value: T) => U | Promise<U>,
): Promise<Result<U, E>> {
  const value =
    result instanceof AsyncResultImpl
      ? await (result as AsyncResultImpl<T, E>).promise
      : (result as Result<T, E>);
  if (value instanceof Err) return value as Err<E, never>;
  const mapped = f(value.value);
  if (mapped instanceof Promise) {
    return new Ok(await mapped);
  }
  return new Ok(mapped);
}

/**
 * Maps the success value of an AsyncResult or Result.
 *
 * This function supports two calling patterns:
 * 1. Curried: `map(fn)(result)` - perfect for pipe composition
 * 2. Binary: `map(result, fn)` - more intuitive for direct calls
 *
 * If the Result is Ok, the mapping function is applied to the contained value.
 * The mapping function can be synchronous or asynchronous. If the Result is Err,
 * it is passed through unchanged.
 *
 * @example
 * ```typescript
 * import { AsyncResult, pipe } from "@joyful/result";
 * 
 * const result = new AsyncResultImpl(Promise.resolve(new Ok(5)));
 * 
 * // Curried form (great for pipes)
 * const doubled = pipe(
 *   result,
 *   AsyncResult.map((x: number) => x * 2)
 * );
 * console.log((await doubled).unwrap()); // 10
 * 
 * // Binary form (more direct)
 * const doubled2 = AsyncResult.map(result, (x: number) => x * 2);
 * console.log((await doubled2).unwrap()); // 10
 * 
 * // Async mapping function
 * const withAsync = await pipe(
 *   result,
 *   AsyncResult.map(async (x: number) => {
 *     await new Promise(resolve => setTimeout(resolve, 100));
 *     return x * 3;
 *   })
 * );
 * console.log(withAsync.unwrap()); // 15
 * ```
 */
export function map<T, U, E>(
  result: Result<T, E> | AsyncResult<T, E>,
  f: (value: T) => U | Promise<U>,
): AsyncResult<U, E>;
export function map<T, U, E>(
  f: (value: T) => U | Promise<U>,
): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<U, E>;
export function map<T, U, E>(
  resultOrFn: Result<T, E> | AsyncResult<T, E> | ((value: T) => U | Promise<U>),
  maybeFn?: (value: T) => U | Promise<U>,
):
  | AsyncResult<U, E>
  | ((result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<U, E>) {
  if (maybeFn !== undefined) {
    const result = resultOrFn as AsyncResult<T, E>;
    const f = maybeFn;
    return new AsyncResultImpl(mapInner(result, f));
  }

  return (result: Result<T, E> | AsyncResult<T, E>): AsyncResult<U, E> => {
    return new AsyncResultImpl(mapInner(result, resultOrFn as (value: T) => U));
  };
}

/**
 * Internal helper that maps the error value of a Result or AsyncResult.
 * @param result - The Result or AsyncResult to map
 * @param f - The error mapping function (can be sync or async)
 * @returns Promise that resolves to a Result with the mapped error
 */
async function mapErrInner<T, U, E>(
  result: Result<T, E> | AsyncResult<T, E>,
  f: (error: E) => U | Promise<U>,
): Promise<Result<T, U>> {
  const value =
    result instanceof AsyncResultImpl
      ? await (result as AsyncResultImpl<T, E>).promise
      : (result as Result<T, E>);
  if (value instanceof Ok) return value as Ok<T, never>;
  const mapped = f(value.error);
  if (mapped instanceof Promise) {
    return new Err(await mapped);
  }
  return new Err(mapped);
}

/**
 * Maps the error value of an AsyncResult or Result.
 *
 * This function supports two calling patterns:
 * 1. Curried: `mapErr(fn)(result)` - perfect for pipe composition
 * 2. Binary: `mapErr(result, fn)` - more intuitive for direct calls
 *
 * If the Result is Err, the mapping function is applied to the contained error.
 * The mapping function can be synchronous or asynchronous. If the Result is Ok,
 * it is passed through unchanged.
 *
 * @example
 * ```typescript
 * import { AsyncResult, pipe } from "@joyful/result";
 * 
 * const result = new AsyncResultImpl(Promise.resolve(new Err("network error")));
 * 
 * // Curried form (great for pipes)
 * const withCode = pipe(
 *   result,
 *   AsyncResult.mapErr((msg: string) => `ERROR: ${msg}`)
 * );
 * console.log((await withCode).unwrapErr()); // "ERROR: network error"
 * 
 * // Binary form (more direct)
 * const withCode2 = AsyncResult.mapErr(result, (msg: string) => `ERROR: ${msg}`);
 * console.log((await withCode2).unwrapErr()); // "ERROR: network error"
 * 
 * // Async error mapping
 * const withAsync = await pipe(
 *   result,
 *   AsyncResult.mapErr(async (msg: string) => {
 *     await new Promise(resolve => setTimeout(resolve, 100));
 *     return `ASYNC_ERROR: ${msg}`;
 *   })
 * );
 * console.log(withAsync.unwrapErr()); // "ASYNC_ERROR: network error"
 * ```
 */
export function mapErr<T, U, E>(
  result: Result<T, E> | AsyncResult<T, E>,
  f: (error: E) => U | Promise<U>,
): AsyncResult<T, U>;
export function mapErr<T, U, E>(
  f: (error: E) => U | Promise<U>,
): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<T, U>;
export function mapErr<T, U, E>(
  resultOrFn: Result<T, E> | AsyncResult<T, E> | ((error: E) => U | Promise<U>),
  maybeFn?: (error: E) => U | Promise<U>,
):
  | AsyncResult<T, U>
  | ((result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<T, U>) {
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T, E> | AsyncResult<T, E>;
    const f = maybeFn;
    return new AsyncResultImpl(mapErrInner(result, f));
  }

  return (result: Result<T, E> | AsyncResult<T, E>): AsyncResult<T, U> => {
    return new AsyncResultImpl(
      mapErrInner(result, resultOrFn as (error: E) => U),
    );
  };
}

/**
 * Internal helper that chains operations returning Results or AsyncResults.
 * @param result - The Result or AsyncResult to chain
 * @param f - Function that returns a Result, AsyncResult, or Promise of either
 * @returns Promise that resolves to the chained Result
 */
async function andThenInner<T1, T2, E1, E2>(
  result: Result<T1, E1> | AsyncResult<T1, E1>,
  f: (value: T1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>,
): Promise<Result<T2, E1 | E2>> {
  const value =
    result instanceof AsyncResultImpl
      ? await (result as AsyncResultImpl<T1, E1>).promise
      : (result as Result<T1, E1>);
  if (value instanceof Err) return value as Err<E1, never>;
  const mapped = f(value.value);
  const awaited = mapped instanceof Promise ? await mapped : mapped;
  
  if (awaited instanceof AsyncResultImpl) {
    return awaited.promise;
  } else {
    return Promise.resolve(awaited);
  }
}

/**
 * Chains operations that return Results or AsyncResults.
 *
 * This function supports two calling patterns:
 * 1. Curried: `andThen(fn)(result)` - perfect for pipe composition
 * 2. Binary: `andThen(result, fn)` - more intuitive for direct calls
 *
 * If the input Result is Ok, the provided function is applied to the contained
 * value and its Result/AsyncResult is returned. If the input Result is Err,
 * it is passed through unchanged (short-circuiting the chain).
 *
 * The provided function can return a Result, AsyncResult, or a Promise of either.
 * This is equivalent to the "bind" or "flatMap" operation in functional programming.
 *
 * @example
 * ```typescript
 * import { AsyncResult, Result, pipe } from "@joyful/result";
 * 
 * const parseAge = (str: string): Result<number, string> => {
 *   const age = parseInt(str, 10);
 *   if (isNaN(age)) return new Result.Err("Invalid number");
 *   if (age < 0) return new Result.Err("Age cannot be negative");
 *   return new Result.Ok(age);
 * };
 * 
 * const validateAge = async (age: number): Promise<Result<string, string>> => {
 *   if (age < 18) return new Result.Err("Too young to register");
 *   if (age > 65) return new Result.Err("Age exceeds limit");
 *   return new Result.Ok("Age is valid");
 * };
 * 
 * const result = new AsyncResultImpl(Promise.resolve(new Result.Ok("25")));
 * 
 * // Curried form (great for pipes)
 * const final = pipe(
 *   result,
 *   AsyncResult.andThen(parseAge),
 *   AsyncResult.andThen(validateAge)
 * );
 * console.log((await final).unwrap()); // "Age is valid"
 * 
 * // Binary form (more direct)
 * const final2 = AsyncResult.andThen(
 *   await AsyncResult.andThen(result, parseAge),
 *   validateAge
 * );
 * console.log((await final2).unwrap()); // "Age is valid"
 * ```
 */
export function andThen<T1, T2, E1, E2>(
  result: Result<T1, E1> | AsyncResult<T1, E1>,
  f: (value: T1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>,
): AsyncResult<T2, E1 | E2>;
export function andThen<T1, T2, E1, E2>(
  f: (value: T1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>,
): (result: Result<T1, E1> | AsyncResult<T1, E1>) => AsyncResult<T2, E1 | E2>;
export function andThen<T1, T2, E1, E2>(
  resultOrFn:
    | Result<T1, E1>
    | AsyncResult<T1, E1>
    | ((value: T1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>),
  maybeFn?: (value: T1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>,
):
  | AsyncResult<T2, E1 | E2>
  | ((
      result: Result<T1, E1> | AsyncResult<T1, E1>,
    ) => AsyncResult<T2, E1 | E2>) {
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T1, E1> | AsyncResult<T1, E1>;
    const f = maybeFn;
    return new AsyncResultImpl(andThenInner(result, f));
  }

  return (
    result: Result<T1, E1> | AsyncResult<T1, E1>,
  ): AsyncResult<T2, E1 | E2> => {
    return new AsyncResultImpl(
      andThenInner(result, resultOrFn as (value: T1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>),
    );
  };
}

/**
 * Internal helper that provides fallback behavior for Results or AsyncResults.
 * @param result - The Result or AsyncResult to provide fallback for
 * @param f - Function that returns a Result, AsyncResult, or Promise of either
 * @returns Promise that resolves to fallback Result
 */
async function orElseInner<T1, T2, E1, E2>(
  result: Result<T1, E1> | AsyncResult<T1, E1>,
  f: (error: E1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>,
): Promise<Result<T1 | T2, E2>> {
  const value =
    result instanceof AsyncResultImpl
      ? await (result as AsyncResultImpl<T1, E1>).promise
      : (result as Result<T1, E1>);
  if (value instanceof Ok) return value as Ok<T1, never>;
  const mapped = f(value.error);
  const awaited = mapped instanceof Promise ? await mapped : mapped;
  
  if (awaited instanceof AsyncResultImpl) {
    return awaited.promise;
  } else {
    return Promise.resolve(awaited);
  }
}

/**
 * Provides fallback behavior for AsyncResults or Results.
 *
 * This function supports two calling patterns:
 * 1. Curried: `orElse(fn)(result)` - perfect for pipe composition
 * 2. Binary: `orElse(result, fn)` - more intuitive for direct calls
 *
 * If the input Result is Err, the provided function is applied
 * to the error value and its Result/AsyncResult is returned. If the input
 * Result is Ok, it is passed through unchanged.
 *
 * The provided function can return a Result, AsyncResult, or a Promise of either.
 * This is useful for providing default values or alternative recovery strategies.
 *
 * @example
 * ```typescript
 * import { AsyncResult, Result, pipe } from "@joyful/result";
 * 
 * const fetchFromCache = (id: string): AsyncResult<string, string> => {
 *   // Simulate cache miss
 *   return new AsyncResultImpl(Promise.resolve(new Result.Err("Not found in cache")));
 * };
 * 
 * const fetchFromDB = async (id: string): Promise<Result<string, string>> => {
 *   // Simulate database fetch
 *   await new Promise(resolve => setTimeout(resolve, 100));
 *   return new Result.Ok(`Data for ${id} from database`);
 * };
 * 
 * const result = new AsyncResultImpl(Promise.resolve(new Result.Err("Not found in cache")));
 * 
 * // Curried form (great for pipes)
 * const fallback = pipe(
 *   result,
 *   AsyncResult.orElse(fetchFromDB)
 * );
 * console.log((await fallback).unwrap()); // "Data for [id] from database"
 * 
 * // Binary form (more direct)
 * const fallback2 = AsyncResult.orElse(result, fetchFromDB);
 * console.log((await fallback2).unwrap()); // "Data for [id] from database"
 * 
 * const success = new AsyncResultImpl(Promise.resolve(new Result.Ok("Already have data")));
 * const unchanged = await AsyncResult.orElse(success, fetchFromDB);
 * console.log(unchanged.unwrap()); // "Already have data"
 * ```
 */
export function orElse<T1, T2, E1, E2>(
  result: Result<T1, E1> | AsyncResult<T1, E1>,
  f: (error: E1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>,
): AsyncResult<T1 | T2, E2>;
export function orElse<T1, T2, E1, E2>(
  f: (error: E1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>,
): (result: Result<T1, E1> | AsyncResult<T1, E1>) => AsyncResult<T1 | T2, E2>;
export function orElse<T1, T2, E1, E2>(
  resultOrFn:
    | Result<T1, E1>
    | AsyncResult<T1, E1>
    | ((error: E1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>),
  maybeFn?: (error: E1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>,
):
  | AsyncResult<T1 | T2, E2>
  | ((
      result: Result<T1, E1> | AsyncResult<T1, E1>,
    ) => AsyncResult<T1 | T2, E2>) {
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T1, E1> | AsyncResult<T1, E1>;
    const f = maybeFn;
    return new AsyncResultImpl(orElseInner(result, f));
  }

  return (
    result: Result<T1, E1> | AsyncResult<T1, E1>,
  ): AsyncResult<T1 | T2, E2> => {
    return new AsyncResultImpl(
      orElseInner(result, resultOrFn as (error: E1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>),
    );
  };
}

/**
 * Internal helper that pattern matches on a Result or AsyncResult.
 * @param result - The Result or AsyncResult to match on
 * @param ok - Handler for Ok values (can be sync or async)
 * @param err - Handler for Err values (can be sync or async)
 * @returns Promise that resolves to the result of the appropriate handler
 */
async function matchInner<T, E, U>(
  result: Result<T, E> | AsyncResult<T, E>,
  ok: (value: T) => U | Promise<U>,
  err: (error: E) => U | Promise<U>,
): Promise<U> {
  const value =
    result instanceof AsyncResultImpl
      ? await (result as AsyncResultImpl<T, E>).promise
      : (result as Result<T, E>);
  if (value instanceof Ok) {
    const result = ok(value.value);
    return result instanceof Promise ? await result : result;
  } else {
    const result = err(value.error);
    return result instanceof Promise ? await result : result;
  }
}

/**
 * Pattern matches on an AsyncResult or Result.
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
 * The handler functions can be synchronous or asynchronous. This is similar
 * to pattern matching in languages like Rust or Haskell.
 *
 * @example
 * ```typescript
 * import { AsyncResult, Result, pipe } from "@joyful/result";
 * 
 * const result = new AsyncResultImpl(Promise.resolve(new Result.Ok(42)));
 * 
 * // Curried form (great for pipes)
 * const message = pipe(
 *   result,
 *   AsyncResult.match(
 *     (value: number) => `✅ Success: ${value}`,
 *     (error: string) => `❌ Error: ${error}`
 *   )
 * );
 * console.log(await message); // "✅ Success: 42"
 * 
 * // Binary form (more direct)
 * const message2 = AsyncResult.match(
 *   result,
 *   (value: number) => `✅ Success: ${value}`,
 *   (error: string) => `❌ Error: ${error}`
 * );
 * console.log(await message2); // "✅ Success: 42"
 * 
 * // Async handlers
 * const asyncMessage = await pipe(
 *   result,
 *   AsyncResult.match(
 *     async (value: number) => {
 *       await new Promise(resolve => setTimeout(resolve, 100));
 *       return `✅ Async Success: ${value}`;
 *     },
 *     async (error: string) => {
 *       await new Promise(resolve => setTimeout(resolve, 100));
 *       return `❌ Async Error: ${error}`;
 *     }
 *   )
 * );
 * console.log(asyncMessage); // "✅ Async Success: 42"
 * 
 * const error = new AsyncResultImpl(Promise.resolve(new Result.Err("Something went wrong")));
 * const errorMsg = await AsyncResult.match(
 *   error,
 *   (value: number) => `✅ Success: ${value}`,
 *   (error: string) => `❌ Error: ${error}`
 * );
 * console.log(errorMsg); // "❌ Error: Something went wrong"
 * ```
 */
export function match<T, E, U>(
  result: Result<T, E> | AsyncResult<T, E>,
  ok: (value: T) => U | Promise<U>,
  err: (error: E) => U | Promise<U>,
): Promise<U>;
export function match<T, E, U>(
  ok: (value: T) => U | Promise<U>,
  err: (error: E) => U | Promise<U>,
): (result: Result<T, E> | AsyncResult<T, E>) => Promise<U>;
export function match<T, E, U>(
  okOrResult: ((value: T) => U | Promise<U>) | Result<T, E> | AsyncResult<T, E>,
  errOrOk?: ((error: E) => U | Promise<U>) | ((value: T) => U | Promise<U>),
  maybeErr?: (error: E) => U | Promise<U>,
): Promise<U> | ((result: Result<T, E> | AsyncResult<T, E>) => Promise<U>) {
  if (maybeErr !== undefined) {
    const result = okOrResult as Result<T, E> | AsyncResult<T, E>;
    const ok = errOrOk as (value: T) => U | Promise<U>;
    const err = maybeErr;
    return matchInner(result, ok, err);
  }

  const ok = okOrResult as (value: T) => U | Promise<U>;
  const err = errOrOk as (error: E) => U | Promise<U>;
  return (result: Result<T, E> | AsyncResult<T, E>): Promise<U> => {
    return matchInner(result, ok, err);
  };
}
