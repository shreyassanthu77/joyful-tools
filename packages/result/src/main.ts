/**
 * Main entry point for the @joyful/result package.
 * 
 * This module re-exports all Result types and utilities for convenient
 * importing. The Result type provides a robust alternative to exceptions
 * for error handling in TypeScript/JavaScript applications.
 * 
 * @example
 * ```typescript
 * import { Result } from "@joyful/result";
 * 
 * // Create Results
 * const success = new Result.Ok("Hello, World!");
 * const failure = new Result.Err("Something went wrong");
 * 
 * // Use functional utilities (works great with @joyful/pipe)
 * import { pipe } from "@joyful/pipe";
 * const processed = pipe(
 *   success,
 *   Result.map((s: string) => s.toUpperCase()),
 *   Result.map((s: string) => s + "!")
 * );
 * ```
 * 
 * @module Result
 */

/**
 * Namespace containing all Result types and utilities for error handling.
 * 
 * The Result namespace provides:
 * - {@link Ok} - Success variant containing a value
 * - {@link Err} - Error variant containing an error
 * - {@link Result} - Union type representing either success or failure
 * - Functional utilities for composing and transforming Results
 * 
 * @example
 * ```typescript
 * import { Result } from "@joyful/result";
 * 
 * // Creating Results
 * const success = new Result.Ok(42);
 * const error = new Result.Err("Something went wrong");
 * 
 * // Using type guards
 * if (success.ok()) {
 *   console.log(success.unwrap()); // 42
 * }
 * 
 * // Functional composition with @joyful/pipe
 * import { pipe } from "@joyful/pipe";
 * const result = pipe(
 *   new Result.Ok("hello"),
 *   Result.map(s => s.toUpperCase()),
 *   Result.map(s => s + "!")
 * );
 * ```
 */
export * as Result from "./result.ts";
