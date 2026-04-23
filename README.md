# joyful-tools

A collection of small, typed TypeScript utilities for joyful development.

Available on [JSR](https://jsr.io/@joyful) as `@joyful/*` and on
[npm](https://www.npmjs.com/org/joyful-tools) as `@joyful-tools/*`.

Source packages are grouped by family under `joyful/` and `joypack/`.

## Joyful

### [@joyful/result](./joyful/result)

Rust-inspired `Result<T, E>` type for explicit error handling. Model success and
failure as data instead of throwing exceptions.

```ts
import { Result } from "@joyful/result";

const result = Result.run(function* () {
  const parsed = yield* parseInput("42");
  const validated = yield* validate(parsed);
  return Result.ok(validated);
});
```

### [@joyful/fetch](./joyful/fetch)

Thin wrapper around `fetch` that returns `Result` types. Every outcome --
network error, HTTP error, parse failure, cancellation -- is typed data.

```ts
import { jfetch } from "@joyful/fetch";

const user = await jfetch("/api/me").json<User>();
// AsyncResult<User, NetworkError | HttpError | Cancelled | ParseError>
```

### [@joyful/pipe](./joyful/pipe)

Simple left-to-right `pipe(value, ...fns)` with full type inference up to 15
functions.

```ts
import { pipe } from "@joyful/pipe";

const result = pipe(4, double, square, addFive); // 69
```

## Joypack

### [@joypack/waba](./joypack/waba)

WhatsApp Business API tooling.

## Install

Each package is published independently. The current stable installs are the
`@joyful/*` core utilities:

```sh
# JSR
deno add @joyful/result @joyful/fetch @joyful/pipe

# npm
npx jsr add @joyful/result @joyful/fetch @joyful/pipe

# or from npm directly
npm install @joyful-tools/result @joyful-tools/fetch @joyful-tools/pipe
```

## License

MIT
