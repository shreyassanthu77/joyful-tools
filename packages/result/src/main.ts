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
 * call `result.async()` to keep the same style of composition. For
 * generator-based composition, use {@link Result.run} with `yield*` on
 * `Result` and `AsyncResult` values.
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
 *   return Result.ok(value + 1);
 * });
 * ```
 *
 * @module
 */

export * from "./result.ts";
export * from "./async-result.ts";

import { AsyncResult } from "./async-result.ts";
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

  /** Extracts the success type from an {@link Ok} value. */
  export type ExtractOk<T> = T extends Ok<infer U, unknown> ? U : never;

  /** Extracts the error type from an {@link Err} value. */
  export type ExtractErr<T> = T extends Err<unknown, infer E> ? E : never;

  /**
   * Runs a generator that uses `yield*` with {@link Result} values.
   *
   * If the generator yields an {@link Err}, the run stops and that error is
   * returned. If every yielded result is successful, the final returned result
   * becomes the output.
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
   *   return Result.ok(first + second);
   * });
   * ```
   */
  export function run<
    E extends Err<never, unknown>,
    R extends Result<unknown, unknown>,
  >(
    gen: () => Generator<E, R, unknown>,
  ): Result<ExtractOk<R>, ExtractErr<R> | ExtractErr<E>>;

  /**
   * Runs an async generator that uses `yield*` with {@link AsyncResult} values.
   *
   * If the generator yields an {@link Err}, the run stops and that error is
   * returned. If every yielded result is successful, the final returned result
   * becomes the output.
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
   *   return Result.ok(first + second);
   * });
   * ```
   */
  export function run<
    E extends Err<never, unknown>,
    R extends Result<unknown, unknown>,
  >(
    gen: () => AsyncGenerator<E, R, unknown>,
  ): AsyncResult<ExtractOk<R>, ExtractErr<R> | ExtractErr<E>>;
  export function run<
    E extends Err<never, unknown>,
    R extends Result<unknown, unknown>,
  >(
    gen:
      | (() => Generator<E, R, unknown>)
      | (() => AsyncGenerator<E, R, unknown>),
  ):
    | Result<ExtractOk<R>, ExtractErr<R> | ExtractErr<E>>
    | AsyncResult<ExtractOk<R>, ExtractErr<R> | ExtractErr<E>> {
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
    }

    return result.value as Result<ExtractOk<R>, ExtractErr<R> | ExtractErr<E>>;
  }

  async function runAsync<
    E extends Err<never, unknown>,
    R extends Result<unknown, unknown>,
  >(
    gen: AsyncGenerator<E, R, unknown>,
  ): Promise<Result<ExtractOk<R>, ExtractErr<R> | ExtractErr<E>>> {
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
        throw new Error(`Error in Result.run generator: ${e}`);
      }
    }

    return result.value as Result<ExtractOk<R>, ExtractErr<R> | ExtractErr<E>>;
  }
}
