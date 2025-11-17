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

export * as Result from "./result.ts";
