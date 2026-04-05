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
