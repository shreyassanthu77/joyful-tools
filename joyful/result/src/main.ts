/**
 * Result values for explicit success and error handling in synchronous code.
 *
 * `Result<T, E>` represents a computation that either succeeded with an `Ok<T>`
 * value or failed with an `Err<E>` value. This makes failure an explicit part
 * of the type system instead of something that only appears at runtime through
 * exceptions.
 *
 * Use the {@link Result.ok} and {@link Result.err} helpers to construct values,
 * then compose them with methods like `map`, `andThen`, `orElse`,
 * `orElseMatch`, `orElseMatchSome`, and `unwrapOr`. Use {@link Result.wrap}
 * when you want to convert throwing synchronous code into result
 * values. Use {@link taggedError} when you want structured `Error`
 * values with a stable `_tag` for narrowing and logging.
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
 * ```
 *
 * @module
 */

export * from "./result.ts";

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

  /** Extracts the success type from any {@link Result}-like value. */
  export type ExtractOkFromResult<T> = T extends Result<infer U, unknown> ? U
    : never;

  /** Extracts the error type from any {@link Result}-like value. */
  export type ExtractErrFromResult<T> = T extends Result<unknown, infer E> ? E
    : never;
}
