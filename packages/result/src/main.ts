/**
 * Result values for explicit success and error handling in synchronous and asynchronous code.
 *
 * `Result<T, E>` represents a computation that either succeeded with an `Ok<T>`
 * value or failed with an `Err<E>` value. This makes failure an explicit part
 * of the type system instead of something that only appears at runtime through
 * exceptions.
 *
 * Use the {@link Result.ok} and {@link Result.err} helpers to construct values,
 * then compose them with methods like `map`, `andThen`, `orElse`, and
 * `unwrapOr`. When the computation is asynchronous, use {@link AsyncResult} or
 * call `result.async()` to keep the same style of composition.
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
 * ```
 *
 * @module
 */

export * from "./result.ts";
export * from "./async-result.ts";

import { Err, Ok } from "./result.ts";
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
