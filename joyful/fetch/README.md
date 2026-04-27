# @joyful/fetch

A fetch-like wrapper that returns typed `Result` values instead of throwing for
expected request, response, and body parsing failures.

`jfetch(...)` starts immediately like native `fetch`. The returned
`JoyfulResponse` is awaitable for the raw response result and has body methods
that return awaitable/yieldable `TaskRun` values.

## Install

```sh
deno add jsr:@joyful/fetch
npm install @joyful-tools/fetch
```

## Quick Start

```ts
import { jfetch } from "@joyful/fetch";

interface User {
  id: number;
  name: string;
}

const result = await jfetch("/api/users/1").json<User>();

if (result.isOk()) {
  console.log(result.value.name);
} else {
  console.error(result.error._tag, result.error.message);
}
```

## Reading Responses

```ts
const response = await jfetch("/api/users/1");

if (response.isOk()) {
  console.log(response.value.status);
  console.log(response.value.headers.get("content-type"));
}
```

Body methods mirror native `Response` methods:

```ts
const json = await jfetch("/api/data").json<{ count: number }>();
const text = await jfetch("/api/health").text();
const bytes = await jfetch("/api/image.png").bytes();
const buffer = await jfetch("/api/file").arrayBuffer();
const blob = await jfetch("/api/file").blob();
const form = await jfetch("/api/form").formData();
```

If the request failed or returned a non-2xx status, body methods return the
request error without attempting to read the body.

## Errors

| Error          | `_tag`           | When                                                  |
| -------------- | ---------------- | ----------------------------------------------------- |
| `NetworkError` | `"NetworkError"` | `fetch` itself throws: DNS, CORS, network unreachable |
| `Cancelled`    | `"Cancelled"`    | The request or body read was cancelled                |
| `HttpError`    | `"HttpError"`    | The server responded with a non-2xx status code       |
| `ParseError`   | `"ParseError"`   | Body parsing or reading failed                        |

All errors extend `Error` and have a stable `_tag`.

```ts
const result = await jfetch("/api/config").json<Config>();

if (result.isErr()) {
  switch (result.error._tag) {
    case "NetworkError":
      break;
    case "Cancelled":
      break;
    case "HttpError":
      console.error(result.error.status);
      break;
    case "ParseError":
      break;
  }
}
```

Use `Result` matching after awaiting:

```ts
import { Result } from "@joyful/result";

const result = await jfetch("/api/config").json<Config>();
const config = result.orElseMatch({
  NetworkError: () => Result.ok(DEFAULT_CONFIG),
  Cancelled: () => Result.ok(DEFAULT_CONFIG),
  HttpError: (error) =>
    error.status === 404 ? Result.ok(DEFAULT_CONFIG) : Result.err(error),
  ParseError: () => Result.ok(DEFAULT_CONFIG),
});
```

## Task.do Workflows

`JoyfulResponse` and body `TaskRun`s are yieldable in async generator workflows
such as `Task.do`.

```ts
import { jfetch } from "@joyful/fetch";
import { Task } from "@joyful/task";

const program = Task.do(async function* () {
  const user = yield* jfetch("/api/me").json<User>();
  const posts = yield* jfetch(`/api/users/${user.id}/posts`).json<Post[]>();
  return { user, posts };
});

const result = await program.run();
```

Yield the raw response when you need headers before reading the body:

```ts
const program = Task.do(async function* () {
  const response = yield* jfetch("/api/items");
  const total = Number(response.headers.get("x-total-count") ?? "0");
  const items = yield* response.json<Item[]>();
  return { total, items };
});
```

## Custom Fetch

```ts
import { createFetch } from "@joyful/fetch";

const apiFetch = createFetch((input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
});
```

## API

- `jfetch`: default fetch wrapper using `globalThis.fetch`.
- `createFetch(fetchFn)`: create a custom `jfetch`.
- `JoyfulResponse`: awaitable/yieldable request result with body methods.
- `FetchedResponse`: response wrapper with native `Response` accessors and body
  methods.
- `TaskRun<T, E>`: awaitable/yieldable task execution from `@joyful/task`.
- `NetworkError`, `Cancelled`, `HttpError`, `ParseError`: tagged errors.
- `ResponseError`: `NetworkError | Cancelled | HttpError`.

## License

MIT
