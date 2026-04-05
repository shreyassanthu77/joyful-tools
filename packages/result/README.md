# @joyful/result

Typed result values for explicit error handling in synchronous and asynchronous
code.

`@joyful/result` gives you a small Rust-inspired `Result` API for representing
success as data with `Ok<T>` and failure as data with `Err<E>`. Instead of
throwing and catching exceptions throughout your code, you can make failure part
of the function signature and compose both paths directly.

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

## Why Result?

- Make failure explicit in your types with `Result<T, E>`.
- Avoid exception-heavy control flow for expected failures.
- Transform success and error values with `map()` and `mapErr()`.
- Chain dependent operations with `andThen()` and recover with `orElse()`.
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
  catch: (error) =>
    error instanceof Error ? error.message : String(error),
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
  catch: (error) =>
    error instanceof Error ? error.message : String(error),
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
- `Result.wrap(options)`: convert throwing or rejecting code into a result.
- `Ok` and `Err`: concrete classes with `.value` and `.error` fields.
- `map()` and `mapErr()`: transform success and error values.
- `andThen()` and `orElse()`: compose additional result-returning operations.
- `unwrapOr()`, `expect()`, `expectErr()`: extract values.
- `inspect()` and `inspectErr()`: observe values without changing them.
- `Result.run()`: compose results with generator or async generator control flow.
- `async()`: convert a `Result` to `AsyncResult`.
- `AsyncResult`: async wrapper with the same composition primitives.

## License

MIT
