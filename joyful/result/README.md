# @joyful/result

Sync `Result<T, E>` values for explicit success and failure handling.

`@joyful/result` is only the outcome type. Async or lazy work belongs in
`@joyful/task`; fetch-shaped async helpers live in `@joyful/fetch`.

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

## Quick Start

```ts
import { Result } from "@joyful/result";

function parsePort(input: string): Result<number, string> {
  const port = Number(input);
  return Number.isInteger(port) && port > 0
    ? Result.ok(port)
    : Result.err("PORT must be a positive integer");
}

const result = parsePort("3000")
  .map((port) => port + 1)
  .andThen((port) => port < 65536 ? Result.ok(port) : Result.err("too high"));

if (result.isOk()) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

## API

- `Result<T, E>`: `Ok<T, E> | Err<T, E>`.
- `Result.ok(value)`: create an `Ok`.
- `Result.err(error)`: create an `Err`.
- `Result.wrap({ try, catch })`: convert throwing synchronous code to a result.
- `taggedError(tag)`: create tagged `Error` subclasses for exhaustive matching.
- `Ok` and `Err`: concrete result classes.

## Composition

```ts
const value = Result.ok(2)
  .map((n) => n + 1)
  .andThen((n) => n > 0 ? Result.ok(n * 10) : Result.err("negative"));
```

Use `mapErr` to transform errors and `orElse` to recover:

```ts
const recovered = Result.err("missing")
  .mapErr((error) => error.toUpperCase())
  .orElse(() => Result.ok("default"));
```

## Tagged Errors

```ts
import { Result, taggedError } from "@joyful/result";

class ValidationError extends taggedError("ValidationError")<{
  field: string;
}> {}

class NetworkError extends taggedError("NetworkError")<{
  status: number;
}> {}

const result: Result<string, ValidationError | NetworkError> = Result.err(
  new ValidationError({ field: "email" }),
);

const recovered = result.orElseMatch({
  ValidationError: (error) => Result.ok(`guest:${error.field}`),
  NetworkError: (error) => Result.err(`retry:${error.status}`),
});
```

Use `orElseMatchSome` when you only want to recover part of a tagged error
union.

## Generator Support

`Ok` and `Err` keep iterator support so other workflow runners can use
`yield* Result.ok(...)` and `yield* Result.err(...)`. `@joyful/result` no longer
owns the workflow runner itself.

## Async Boundary

For async or lazy workflows, use [`@joyful/task`](../task).

## License

MIT
