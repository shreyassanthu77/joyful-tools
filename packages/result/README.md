# @joyful/result

A TypeScript implementation of the Result type for robust error handling without exceptions.

## Installation

```bash
# deno
deno add jsr:@joyful/result

# pnpm 10.9+
pnpm add jsr:@joyful/result

# yarn 4.9+
yarn add jsr:@joyful/result

# npm, bun, and older versions of yarn or pnpm
npx jsr add @joyful/result
```

## Overview

The Result type represents either success (`Ok`) or failure (`Err`) and forces explicit handling of both cases. This approach eliminates unexpected exceptions and leads to more predictable, maintainable code.

Inspired by Rust's Result type, this implementation provides type-safe error handling with functional composition utilities.

## Basic Usage

### Creating Results

```typescript
import { Result } from "@joyful/result";

// Create a successful result
const success = new Result.Ok("Operation succeeded");
console.log(success.ok()); // true
console.log(success.unwrap()); // "Operation succeeded"

// Create an error result
const error = new Result.Err("Something went wrong");
console.log(error.err()); // true
console.log(error.unwrapErr()); // "Something went wrong"
```

### Handling Results

```typescript
import { Result } from "@joyful/result";

function parseNumber(str: string): Result<number, string> {
  const num = parseFloat(str);
  if (isNaN(num)) {
    return new Result.Err("Invalid number format");
  }
  return new Result.Ok(num);
}

const result = parseNumber("42");

// Method 1: Using type guards
if (result.ok()) {
  console.log("Success:", result.unwrap()); // 42
} else {
  console.log("Error:", result.unwrapErr());
}

// Method 2: Using unwrapOr with default
const value = result.unwrapOr(0); // 42
const fallback = parseNumber("invalid").unwrapOr(0); // 0
```

## Functional Composition

The Result type works beautifully with functional programming patterns and can be composed using the provided utilities. For the best experience, use it with [`@joyful/pipe`](https://jsr.io/@joyful/pipe).

### Mapping Success Values

```typescript
import { pipe } from "@joyful/pipe";
import { Result } from "@joyful/result";

const result = new Result.Ok(5);

// Curried form (great for pipes)
const doubled = pipe(
  result,
  Result.map((x: number) => x * 2)
);
console.log(doubled.unwrap()); // 10

// Binary form (more direct)
const doubled2 = Result.map(result, (x: number) => x * 2);
console.log(doubled2.unwrap()); // 10

// Mapping errors doesn't affect Ok values
const unchanged = pipe(
  result,
  Result.mapErr((msg: string) => `Error: ${msg}`)
);
console.log(unchanged.unwrap()); // 5
```

### Chaining Operations with `andThen`

```typescript
import { Result } from "@joyful/result";
import { pipe } from "@joyful/pipe";

const parseAge = (str: string): Result<number, string> => {
  const age = parseInt(str, 10);
  if (isNaN(age)) return new Result.Err("Invalid number");
  if (age < 0) return new Result.Err("Age cannot be negative");
  if (age > 150) return new Result.Err("Age too high");
  return new Result.Ok(age);
};

const validateAge = (age: number): Result<string, string> => {
  if (age < 18) return new Result.Err("Too young to register");
  if (age > 65) return new Result.Err("Age exceeds limit");
  return new Result.Ok("Age is valid");
};

// Curried form (great for pipes)
const processAge = pipe(
  parseAge("25"),
  Result.andThen(validateAge)
);
console.log(processAge.unwrap()); // "Age is valid"

// Binary form (more direct)
const ageResult = parseAge("25");
const processAge2 = Result.andThen(ageResult, validateAge);
console.log(processAge2.unwrap()); // "Age is valid"
```

### Providing Fallbacks with `orElse`

```typescript
import { Result } from "@joyful/result";
import { pipe } from "@joyful/pipe";

const fetchFromCache = (id: string): Result<string, string> => {
  // Simulate cache miss
  return new Result.Err("Not found in cache");
};

const fetchFromDatabase = (id: string): Result<string, string> => {
  return new Result.Ok(`Data for ${id} from database`);
};

// Curried form (great for pipes)
const result = pipe(
  fetchFromCache("user123"),
  Result.orElse(fetchFromDatabase)
);
console.log(result.unwrap()); // "Data for user123 from database"

// Binary form (more direct)
const cacheResult = fetchFromCache("user123");
const result2 = Result.orElse(cacheResult, fetchFromDatabase);
console.log(result2.unwrap()); // "Data for user123 from database"
```

### Side Effects with `inspect` and `inspectErr`

The `inspect` and `inspectErr` functions allow you to perform side effects (like logging) without changing the Result value. This is perfect for debugging, monitoring, or other operations that shouldn't affect the flow of computation.

```typescript
import { Result } from "@joyful/result";
import { pipe } from "@joyful/pipe";

const result = new Result.Ok(42);

// Inspect success values (curried form)
const withLogging = pipe(
  result,
  Result.inspect((value) => console.log("Processing:", value)),
  Result.map((n) => n * 2),
  Result.inspect((value) => console.log("Processed:", value))
);
console.log(withLogging.unwrap()); // 84 (unchanged by inspection)

// Inspect error values
const errorResult = new Result.Err("Network error");
const withErrorLogging = pipe(
  errorResult,
  Result.inspectErr((error) => console.error("Error occurred:", error)),
  Result.orElse(() => new Result.Ok("Default value"))
);
// Logs: "Error occurred: Network error"
console.log(withErrorLogging.unwrap()); // "Default value"

// Binary form (more direct)
const unchanged = Result.inspect(result, (value) => {
  console.log("Direct inspection:", value);
});
console.log(unchanged.unwrap()); // 42 (unchanged)
```

### Pattern Matching with `match`

```typescript
import { Result } from "@joyful/result";
import { pipe } from "@joyful/pipe";

const result = new Result.Err("Network timeout");

// Curried form (great for pipes)
const message = pipe(
  result,
  Result.match(
    (value: string) => `✅ Success: ${value}`,
    (error: string) => `❌ Error: ${error}`
  )
);
console.log(message); // "❌ Error: Network timeout"

// Binary form (more direct)
const message2 = Result.match(
  result,
  (value: string) => `✅ Success: ${value}`,
  (error: string) => `❌ Error: ${error}`
);
console.log(message2); // "❌ Error: Network timeout"
```

## AsyncResult

The `AsyncResult<T, E>` type provides async-compatible versions of Result utilities, allowing you to work with operations that return Promises and Results. It extends `PromiseLike<Result<T, E>>` to enable seamless integration with async/await syntax.

### Creating AsyncResults

```typescript
import { AsyncResult } from "@joyful/result";

// Convert a promise that might throw to an AsyncResult
const fetchData = () => fetch("/api/data");
const result = AsyncResult.fromThrowable(fetchData, (e) => e.message);

// Convert a sync Result to AsyncResult
import { Result } from "@joyful/result";
const syncResult = new Result.Ok(42);
const asyncResult = AsyncResult.fromResult(syncResult);
```

### Using AsyncResults

```typescript
// Use with async/await
const data = await result;
if (data.ok()) {
  console.log("Success:", data.unwrap());
} else {
  console.log("Error:", data.unwrapErr());
}

// Functional composition with async operations
import { pipe } from "@joyful/pipe";
const processed = await pipe(
  result,
  AsyncResult.map((response) => response.json()),
  AsyncResult.andThen(validateData)
);
```

### AsyncResult Utilities

AsyncResult provides same functional utilities as Result, but with async support:

- `AsyncResult.map()` - Map success values (supports async mapping functions)
- `AsyncResult.mapErr()` - Map error values (supports async mapping functions)  
- `AsyncResult.andThen()` - Chain async operations that return Results
- `AsyncResult.orElse()` - Provide async fallback behavior
- `AsyncResult.match()` - Pattern match with async handlers
- `AsyncResult.inspect()` - Perform async side effects on success values
- `AsyncResult.inspectErr()` - Perform async side effects on error values

### Async Side Effects with `inspect` and `inspectErr`

```typescript
import { AsyncResult } from "@joyful/result";
import { pipe } from "@joyful/pipe";

const result = AsyncResult.fromResult(new Result.Ok("user data"));

// Async inspection with logging
const withAsyncLogging = await pipe(
  result,
  AsyncResult.inspect(async (data) => {
    await analytics.track("data_processed", data);
    console.log("Processing:", data);
  }),
  AsyncResult.map(async (data) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return data.toUpperCase();
  }),
  AsyncResult.inspect((data) => console.log("Processed:", data))
);
console.log(withAsyncLogging.unwrap()); // "USER DATA"

// Async error inspection
const errorResult = AsyncResult.fromResult(new Result.Err("API error"));
const withAsyncErrorLogging = await pipe(
  errorResult,
  AsyncResult.inspectErr(async (error) => {
    await logger.error("API call failed", error);
    console.error("Logged error:", error);
  }),
  AsyncResult.orElse(() => new Result.Ok("Fallback data"))
);
// Logs error asynchronously
console.log(withAsyncErrorLogging.unwrap()); // "Fallback data"
```

## API Reference

### Types

#### `Result<T, E>`
A union type representing either success (`Ok<T, E>`) or failure (`Err<E, T>`).

#### `Ok<T, E>`
Class representing a successful result containing a value of type `T`.

#### `Err<E, T>`
Class representing an error result containing an error of type `E`.

#### `AsyncResult<T, E>`
Interface representing an async Result that extends PromiseLike for seamless async/await integration.

### Methods

#### BaseResult Methods (available on both Ok and Err)

- `ok(): boolean` - Returns `true` for Ok, `false` for Err
- `err(): boolean` - Returns `false` for Ok, `true` for Err
- `unwrap(): T` - Returns the success value or throws
- `unwrapErr(): E` - Returns the error value or throws
- `unwrapOr(defaultValue: T): T` - Returns success value or default

### Functional Utilities

All utility functions support two calling patterns:

1. **Curried form**: `fn(arg)(result)` - perfect for pipe composition
2. **Binary form**: `fn(result, arg)` - more intuitive for direct calls

#### `fromThrowable<T, E>(fn: () => T, onError: (error: unknown) => E): Result<T, E>`
Wraps a throwable function in a Result.

```typescript
const parseJson = (json: string) => Result.fromThrowable(
  () => JSON.parse(json),
  (e) => `Invalid JSON: ${e.message}`
);

const result = parseJson('{"name": "Alice"}');
// Returns: Ok({name: "Alice"})
```

#### `map<T, U, E>(result: Result<T, E>, f: (value: T) => U): Result<U, E>`
#### `map<T, U, E>(f: (value: T) => U): (result: Result<T, E>) => Result<U, E>`
Maps the success value of a Result.

```typescript
// Binary form (direct)
const result = Result.map(new Result.Ok(5), x => x * 2);

// Curried form (for pipes)
const result = pipe(new Result.Ok(5), Result.map(x => x * 2));
```

#### `mapErr<T, U, E>(result: Result<T, E>, f: (error: E) => U): Result<T, U>`
#### `mapErr<T, U, E>(f: (error: E) => U): (result: Result<T, E>) => Result<T, U>`
Maps the error value of a Result.

#### `andThen<T1, T2, E1, E2>(result: Result<T1, E1>, f: (value: T1) => Result<T2, E2>): Result<T2, E1 | E2>`
#### `andThen<T1, T2, E1, E2>(f: (value: T1) => Result<T2, E2>): (result: Result<T1, E1>) => Result<T2, E1 | E2>`
Chains operations that return Results (flatMap/bind).

#### `orElse<T1, T2, E1, E2>(result: Result<T1, E1>, f: (error: E1) => Result<T2, E2>): Result<T1 | T2, E2>`
#### `orElse<T1, T2, E1, E2>(f: (error: E1) => Result<T2, E2>): (result: Result<T1, E1>) => Result<T1 | T2, E2>`
Provides fallback behavior for Results.

#### `inspect<T, E>(result: Result<T, E>, f: (value: T) => void): Result<T, E>`
#### `inspect<T, E>(f: (value: T) => void): (result: Result<T, E>) => Result<T, E>`
Inspects the success value of a Result without changing it (for side effects like logging).

#### `inspectErr<T, E>(result: Result<T, E>, f: (error: E) => void): Result<T, E>`
#### `inspectErr<T, E>(f: (error: E) => void): (result: Result<T, E>) => Result<T, E>`
Inspects the error value of a Result without changing it (for error logging and monitoring).

#### `match<T, E, U>(result: Result<T, E>, ok: (value: T) => U, err: (error: E) => U): U`
#### `match<T, E, U>(ok: (value: T) => U, err: (error: E) => U): (result: Result<T, E>) => U>`
Pattern matches on a Result, applying the appropriate handler.

### AsyncResult Utilities

AsyncResult provides the same utilities as Result, but with async support:

#### `fromThrowable<T, E>(fn: () => T | Promise<T>, onError?: (error: unknown) => E): AsyncResult<T, E>`
Wraps a throwable function (sync or async) in an AsyncResult.

#### `fromResult<T, E>(result: Result<T, E>): AsyncResult<T, E>`
Converts a synchronous Result to an AsyncResult.

#### `AsyncResult.map<T, U, E>(result: Result<T, E> | AsyncResult<T, E>, f: (value: T) => U | Promise<U>): AsyncResult<U, E>`
#### `AsyncResult.map<T, U, E>(f: (value: T) => U | Promise<U>): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<U, E>`
Maps the success value of an AsyncResult or Result (supports async mapping functions).

#### `AsyncResult.mapErr<T, U, E>(result: Result<T, E> | AsyncResult<T, E>, f: (error: E) => U | Promise<U>): AsyncResult<T, U>`
#### `AsyncResult.mapErr<T, U, E>(f: (error: E) => U | Promise<U>): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<T, U>`
Maps the error value of an AsyncResult or Result (supports async mapping functions).

#### `AsyncResult.andThen<T1, T2, E1, E2>(result: Result<T1, E1> | AsyncResult<T1, E1>, f: (value: T1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>): AsyncResult<T2, E1 | E2>`
#### `AsyncResult.andThen<T1, T2, E1, E2>(f: (value: T1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>): (result: Result<T1, E1> | AsyncResult<T1, E1>) => AsyncResult<T2, E1 | E2>`
Chains async operations that return Results or AsyncResults.

#### `AsyncResult.orElse<T1, T2, E1, E2>(result: Result<T1, E1> | AsyncResult<T1, E1>, f: (error: E1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>): AsyncResult<T1 | T2, E2>`
#### `AsyncResult.orElse<T1, T2, E1, E2>(f: (error: E1) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2> | AsyncResult<T2, E2>>): (result: Result<T1, E1> | AsyncResult<T1, E1>) => AsyncResult<T1 | T2, E2>`
Provides async fallback behavior for AsyncResults or Results.

#### `AsyncResult.inspect<T, E>(result: Result<T, E> | AsyncResult<T, E>, f: (value: T) => void | Promise<void>): AsyncResult<T, E>`
#### `AsyncResult.inspect<T, E>(f: (value: T) => void | Promise<void>): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<T, E>`
Inspects success value of an AsyncResult or Result without changing it (supports async inspection functions).

#### `AsyncResult.inspectErr<T, E>(result: Result<T, E> | AsyncResult<T, E>, f: (error: E) => void | Promise<void>): AsyncResult<T, E>`
#### `AsyncResult.inspectErr<T, E>(f: (error: E) => void | Promise<void>): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<T, E>`
Inspects error value of an AsyncResult or Result without changing it (supports async inspection functions).

#### `AsyncResult.match<T, E, U>(result: Result<T, E> | AsyncResult<T, E>, ok: (value: T) => U | Promise<U>, err: (error: E) => U | Promise<U>): Promise<U>`
#### `AsyncResult.match<T, E, U>(ok: (value: T) => U | Promise<U>, err: (error: E) => U | Promise<U>): (result: Result<T, E> | AsyncResult<T, E>) => Promise<U>`
Pattern matches on an AsyncResult or Result with async handlers.

## Benefits

- **Type Safety**: Full TypeScript support with proper type inference
- **Explicit Error Handling**: Forces handling of both success and failure cases
- **Composable**: Works beautifully with functional programming patterns and [`@joyful/pipe`](https://jsr.io/@joyful/pipe)
- **No Exceptions**: Eliminates unexpected runtime errors and try/catch blocks
- **Predictable**: Control flow is clear and explicit
- **Testable**: Error paths are easily testable without mocking exceptions
- **Async Support**: AsyncResult provides seamless integration with promises and async/await
- **Unified API**: Consistent interface between sync and async operations

## Integration with @joyful/pipe

This package is designed to work seamlessly with [`@joyful/pipe`](https://jsr.io/@joyful/pipe) for clean, readable function composition:

```typescript
import { pipe } from "@joyful/pipe";
import { Result, AsyncResult } from "@joyful/result";

// Sync example with logging
const process = pipe(
  fetchData(),
  Result.inspect((data) => console.log("Fetched:", data)),
  Result.andThen(validate),
  Result.map(transform),
  Result.inspect((result) => console.log("Transformed:", result)),
  Result.orElse(handleError)
);

// Async example with async logging
const asyncProcess = await pipe(
  AsyncResult.fromThrowable(fetchData, (e) => e.message),
  AsyncResult.inspect(async (data) => {
    await analytics.track("data_fetched", data);
    console.log("Async fetched:", data);
  }),
  AsyncResult.andThen(validateAsync),
  AsyncResult.map(transformAsync),
  AsyncResult.inspectErr(async (error) => {
    await logger.error("Processing failed", error);
  }),
  AsyncResult.orElse(handleErrorAsync)
);
```

The combination of Result and pipe provides a powerful, type-safe way to handle complex operations that might fail, without the complexity of nested try-catch blocks.

## License

MIT
