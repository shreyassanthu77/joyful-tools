# @joyful/result

Typed result values for explicit error handling in synchronous and asynchronous
code.

`@joyful/result` gives you a small Rust-inspired `Result` API for representing
success as data with `Ok<T>` and failure as data with `Err<E>`. Instead of
throwing and catching exceptions throughout your code, you can make failure part
of the function signature and compose both paths directly.

## Installation

```bash
# npm
npm install @joyful-tools/result

# pnpm
pnpm add @joyful-tools/result

# bun
bun add @joyful-tools/result

# npm (from JSR)
npx jsr add @joyful/result

# pnpm 10.9+ (from JSR)
pnpm add jsr:@joyful/result

# yarn 4.9+ (from JSR)
yarn add jsr:@joyful/result

# deno
deno add jsr:@joyful/result
```

> The examples below use `@joyful/result` (the JSR name) in imports. If you
> installed from npm, use `@joyful-tools/result` instead.

## Why Result?

- Make failure explicit in your types with `Result<T, E>`.
- Avoid exception-heavy control flow for expected failures.
- Transform success and error values with `map()` and `mapErr()`.
- Chain dependent operations with `andThen()` and recover with `orElse()`.
- Recover tagged errors with `orElseMatch()` and `orElseMatchSome()`.
- Model domain failures with `Result.taggedError()`.
- Wrap throwing or rejecting code with `Result.wrap()`.
- Compose complex flows with `Result.run()` and `yield*`.
- Use the same model for async code with `AsyncResult`.

## Quick Start

```typescript
import { Result } from "@joyful/result";

function parsePort(input: string): Result<number, string> {
  const port = Number(input);
  return Number.isInteger(port) && port > 0
    ? Result.ok(port)
    : Result.err("PORT must be a positive integer");
}

const parsed = parsePort("3000");

if (parsed.isOk()) {
  console.log(parsed.value);
} else {
  console.log(parsed.error);
}

const port = parsePort("invalid").unwrapOr(8080);
// 8080
```

## Creating Results

The most convenient constructors are the `Result` namespace helpers:

```typescript
import { Result } from "@joyful/result";

const ok = Result.ok("ready");
const err = Result.err("missing configuration");
```

The `Ok` and `Err` classes are also exported when you want to instantiate them
directly:

```typescript
import { Err, Ok } from "@joyful/result";

const ok = new Ok(123);
const err = new Err("boom");
```

## Tagged Errors

Use `Result.taggedError()` when you want rich `Error` objects with a stable
`_tag` that can be matched later.

```typescript
import { Result } from "@joyful/result";

class ValidationError extends Result.taggedError("ValidationError")<{
  field: string;
}> {}

class NetworkError extends Result.taggedError("NetworkError")<{
  status: number;
}> {}

const error = new ValidationError({
  field: "email",
  message: "Email is required",
});

console.log(error._tag);
// "ValidationError"
```

Tagged errors are normal `Error` instances, so they still work well with logs,
stack traces, and `cause`.

## Working With Success And Error Paths

### Narrowing with `isOk()` and `isErr()`

Use the type guards to branch safely and access `.value` or `.error`.

```typescript
import { Result } from "@joyful/result";

function parseNumber(input: string): Result<number, string> {
  const value = Number(input);
  return Number.isNaN(value) ? Result.err("invalid number") : Result.ok(value);
}

const result = parseNumber("42");

if (result.isOk()) {
  console.log(result.value);
}

if (result.isErr()) {
  console.log(result.error);
}
```

### Mapping values with `map()` and `mapErr()`

```typescript
import { Result } from "@joyful/result";

const value = Result.ok(2)
  .map((number) => number + 1)
  .map((number) => number * 10);
// Ok(30)

const error = Result.err("timeout")
  .mapErr((message) => message.toUpperCase());
// Err("TIMEOUT")
```

### Chaining with `andThen()`

Use `andThen()` when the next step can also fail and already returns a `Result`.

```typescript
import { Result } from "@joyful/result";

function parseNumber(input: string): Result<number, string> {
  const value = Number(input);
  return Number.isNaN(value) ? Result.err("invalid number") : Result.ok(value);
}

function requirePositive(value: number): Result<number, string> {
  return value > 0 ? Result.ok(value) : Result.err("value must be positive");
}

const result = parseNumber("42").andThen(requirePositive);
// Ok(42)
```

### Recovering with `orElse()`

Use `orElse()` when you want to turn an error into another `Result`.

```typescript
import { Result } from "@joyful/result";

const value = Result.err("missing value").orElse((error) =>
  error === "missing value" ? Result.ok("default") : Result.err(error)
);
// Ok("default")
```

### Recovering tagged errors with `orElseMatch()`

Use `orElseMatch()` when your error type is a tagged error union and you want an
exhaustive recovery map.

```typescript
import { Result } from "@joyful/result";

class ValidationError extends Result.taggedError("ValidationError")<{
  field: string;
}> {}

class NetworkError extends Result.taggedError("NetworkError")<{
  status: number;
}> {}

const result: Result<string, ValidationError | NetworkError> = Result.err(
  new ValidationError({ field: "email" }),
);

const recovered = result.orElseMatch({
  ValidationError: (error) => Result.ok(`guest:${error.field}`),
  NetworkError: (error) => Result.err(`retry:${error.status}`),
});
// Ok("guest:email") | Err("retry:...")
```

Each handler must return a `Result`, so `orElseMatch()` fits naturally when you
want to recover, remap, or continue composing in the result model.

### Recovering some tagged errors with `orElseMatchSome()`

Use `orElseMatchSome()` when you only want to handle part of a tagged error
union and leave the rest untouched.

```typescript
import { Result } from "@joyful/result";

class ValidationError extends Result.taggedError("ValidationError")<{
  field: string;
}> {}

class NetworkError extends Result.taggedError("NetworkError")<{
  status: number;
}> {}

const result: Result<string, ValidationError | NetworkError> = Result.err(
  new NetworkError({ status: 503 }),
);

const recovered = result.orElseMatchSome({
  ValidationError: (error) => Result.ok(`fixed:${error.field}`),
});

if (recovered.isErr()) {
  console.log(recovered.error._tag);
  // "NetworkError"
}
```

This is useful when some errors can be recovered locally and others should keep
flowing upward.

### Wrapping throwing code with `Result.wrap()`

`Result.wrap()` is useful when you need to integrate exception-based code into a
result flow. It runs a callback, returns `Ok` for success, and maps thrown
errors with your `catch` function.

```typescript
import { Result } from "@joyful/result";

const parsed = Result.wrap({
  try: () => JSON.parse('{"port":3000}') as { port: number },
  catch: () => "invalid json",
});

// Ok({ port: 3000 })
```

Thrown values become `Err` results:

```typescript
const parsed = Result.wrap({
  try: () => JSON.parse("not json"),
  catch: (error) => error instanceof Error ? error.message : String(error),
});

// Err("Unexpected token 'o', \"not json\" is not valid JSON")
```

## Generator Composition With `Result.run`

`Result.run()` lets you write sequential result logic with `yield*` instead of
nesting `andThen()` calls. `Ok` values continue the generator with their
unwrapped value, and `Err` values stop the generator early and become the final
result.

### Synchronous generators

```typescript
import { Result } from "@joyful/result";

function parseNumber(input: string): Result<number, string> {
  const value = Number(input);
  return Number.isNaN(value) ? Result.err("invalid number") : Result.ok(value);
}

function requirePositive(value: number): Result<number, string> {
  return value > 0 ? Result.ok(value) : Result.err("value must be positive");
}

const result = Result.run(function* () {
  const parsed = yield* parseNumber("42");
  const positive = yield* requirePositive(parsed);
  return Result.ok(positive * 2);
});

// Ok(84)
```

If any yielded result is an error, execution stops immediately:

```typescript
const result = Result.run(function* () {
  const parsed = yield* parseNumber("nope");
  return Result.ok(parsed * 2);
});

// Err("invalid number")
```

### Defaults, assertions, and side effects

- `unwrapOr(defaultValue)` returns the success value or a fallback.
- `expect(message)` returns the success value or throws an `Error`.
- `expectErr(message)` returns the error value or throws an `Error`.
- `inspect(fn)` runs `fn` on the success value and returns the same result.
- `inspectErr(fn)` runs `fn` on the error value and returns the same result.

`expect()` and `expectErr()` are best reserved for tests or states that should
be impossible in normal execution.

## AsyncResult

`AsyncResult<T, E>` is a promise-like wrapper around `Promise<Result<T, E>>`. It
lets you keep using result-style composition in async code without dropping back
to exceptions or manual branching at every step.

### Converting a sync result with `.async()`

Every `Ok` and `Err` can be converted into an `AsyncResult`.

```typescript
import { Result } from "@joyful/result";

const value = await Result.ok(2)
  .async()
  .map((number) => number + 1)
  .unwrapOr(0);
// 3
```

### Wrapping async work

When you already have a promise-producing function and want to capture
rejections as data, `Result.wrap()` can return an `AsyncResult` directly:

```typescript
import { Result } from "@joyful/result";

const config = await Result.wrap({
  try: async () => {
    const response = await fetch("https://example.com/config.json");
    if (!response.ok) {
      throw new Error(`request failed: ${response.status}`);
    }

    return response.json();
  },
  catch: (error) => error instanceof Error ? error.message : String(error),
});
```

You can still build an `AsyncResult` manually when you need to work at the
`Promise<Result<T, E>>` level:

```typescript
import { AsyncResult, Result } from "@joyful/result";

function fetchJson(url: string): AsyncResult<unknown, string> {
  return new AsyncResult(
    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          return Result.err(`request failed: ${response.status}`);
        }

        return Result.ok(await response.json());
      })
      .catch((error) =>
        Result.err(error instanceof Error ? error.message : String(error))
      ),
  );
}

const json = await fetchJson("https://example.com/api/user").unwrapOr(null);
```

### Async composition

`AsyncResult` supports the same core operations as `Result`, and its callbacks
may be synchronous or asynchronous.

```typescript
import { Result } from "@joyful/result";

const value = await Result.ok(2)
  .async()
  .map(async (number) => number + 1)
  .andThen((number) => Result.ok(number * 10).async())
  .unwrapOr(0);
// 30
```

`orElseMatch()` and `orElseMatchSome()` are available on `AsyncResult` too.
Handlers may return a `Result`, an `AsyncResult`, or a `Promise<Result>`.

```typescript
import { Result } from "@joyful/result";

class ValidationError extends Result.taggedError("ValidationError")<{
  field: string;
}> {}

class NetworkError extends Result.taggedError("NetworkError")<{
  status: number;
}> {}

const result = Result.err<string, ValidationError | NetworkError>(
  new ValidationError({ field: "email" }),
).async();

const recovered = await result.orElseMatchSome({
  ValidationError: async (error) => Result.ok(error.field.length),
  NetworkError: (error) => Result.err(`retry:${error.status}`),
});
```

### Async generators with `Result.run`

`Result.run()` also accepts an async generator, which makes it useful when you
want the same `yield*` flow over `AsyncResult` values.

```typescript
import { AsyncResult, Result } from "@joyful/result";

function fetchScore(): AsyncResult<number, string> {
  return new AsyncResult(Promise.resolve(Result.ok(21)));
}

const result = await Result.run(async function* () {
  const score = yield* fetchScore();
  const bonus = yield* Result.ok(2).async();
  return Result.ok(score * bonus);
});

// Ok(42)
```

## API Overview

- `Result<T, E>`: union type of `Ok<T, E>` and `Err<T, E>`.
- `Result.ok(value)`: create a successful result.
- `Result.err(error)`: create a failed result.
- `Result.taggedError(tag)`: create tagged `Error` subclasses for domain errors.
- `Result.wrap(options)`: convert throwing or rejecting code into a result.
- `Ok` and `Err`: concrete classes with `.value` and `.error` fields.
- `map()` and `mapErr()`: transform success and error values.
- `andThen()` and `orElse()`: compose additional result-returning operations.
- `orElseMatch()` and `orElseMatchSome()`: recover tagged errors with handler
  maps.
- `unwrapOr()`, `expect()`, `expectErr()`: extract values.
- `inspect()` and `inspectErr()`: observe values without changing them.
- `Result.run()`: compose results with generator or async generator control
  flow.
- `async()`: convert a `Result` to `AsyncResult`.
- `AsyncResult`: async wrapper with the same composition primitives.

## Which Method Should I Use?

- `map()`: transform a successful value without changing the error type.
- `mapErr()`: transform an error value without changing the success type.
- `andThen()`: continue with another operation that already returns a `Result`.
- `orElse()`: recover from any error value with one fallback function.
- `orElseMatch()`: exhaustively recover tagged errors with one handler per
  `_tag`.
- `orElseMatchSome()`: recover only selected tagged errors and leave the rest
  unchanged.

## License

MIT
