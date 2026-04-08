# @joyful/fetch

A thin wrapper around the web standard `fetch` that returns
[`@joyful/result`](https://jsr.io/@joyful/result) types instead of throwing
exceptions. Every response — success, HTTP error, network failure, or body parse
error — is modelled as data you can inspect, transform, and recover from.

## Installation

```bash
# npm
npm install @joyful-tools/fetch

# pnpm
pnpm add @joyful-tools/fetch

# bun
bun add @joyful-tools/fetch

# npm (from JSR)
npx jsr add @joyful/fetch

# pnpm 10.9+ (from JSR)
pnpm add jsr:@joyful/fetch

# yarn 4.9+ (from JSR)
yarn add jsr:@joyful/fetch

# deno
deno add jsr:@joyful/fetch
```

> The examples below use `@joyful/fetch` and `@joyful/result` (the JSR names) in
> imports. If you installed from npm, use `@joyful-tools/fetch` and
> `@joyful-tools/result` instead.

## Quick Start

```typescript
import { jfetch } from "@joyful/fetch";

interface User {
  id: number;
  name: string;
}

const result = await jfetch("https://api.example.com/users/1").json<User>();

if (result.isOk()) {
  console.log(result.value.name);
} else {
  console.error(result.error._tag, result.error.message);
}
```

`jfetch` has the same signature as `fetch` — you pass it a URL and an optional
`RequestInit`. The difference is that it returns a `JoyfulResponse` instead of a
`Promise<Response>`.

## Reading The Body

`JoyfulResponse` exposes body methods that mirror those on `Response`, but each
one returns an `AsyncResult` instead of a raw promise.

```typescript
import { jfetch } from "@joyful/fetch";

// Parse as JSON
const json = await jfetch("/api/data").json<{ count: number }>();

// Read as text
const text = await jfetch("/api/health").text();

// Read as bytes
const bytes = await jfetch("/api/image.png").bytes();

// Other body formats
const buffer = await jfetch("/api/file").arrayBuffer();
const blob = await jfetch("/api/file").blob();
const form = await jfetch("/api/form").formData();
```

All body methods return `AsyncResult<T, ResponseError | ParseError>`. If the
request itself failed or returned a non-2xx status, the body method
short-circuits and returns the original error without attempting to read the
body.

## Reading Headers And Response Metadata

Sometimes you need access to headers, status codes, or other response metadata
from a successful request. Use the `.response` field to get the underlying
`AsyncResult<Response, ResponseError>`, then `map` over it to extract what you
need.

```typescript
import { jfetch } from "@joyful/fetch";

// Get a specific header
const contentType = await jfetch("/api/data")
  .response
  .map((res) => res.headers.get("content-type"))
  .unwrapOr(null);

// Get the status code
const status = await jfetch("/api/health")
  .response
  .map((res) => res.status)
  .unwrapOr(0);

// Read multiple pieces of metadata at once
const info = await jfetch("/api/data")
  .response
  .map((res) => ({
    status: res.status,
    etag: res.headers.get("etag"),
    contentLength: res.headers.get("content-length"),
  }))
  .unwrapOr(null);
```

### Reading Both Headers And Body

When you need headers and a parsed body together, use `andThen` on the response:

```typescript
import { jfetch } from "@joyful/fetch";
import { Result } from "@joyful/result";

interface Page<T> {
  data: T;
  total: number;
}

const page = await jfetch("/api/users")
  .response
  .andThen(async (res) => {
    const total = Number(res.headers.get("x-total-count") ?? "0");
    const data = await res.json() as User[];
    return Result.ok<Page<User[]>>({ data, total });
  })
  .unwrapOr({ data: [], total: 0 });

console.log(`${page.data.length} of ${page.total} users`);
```

## Error Handling

`@joyful/fetch` categorises every failure into one of four tagged errors:

| Error          | `_tag`           | When                                                           |
| -------------- | ---------------- | -------------------------------------------------------------- |
| `NetworkError` | `"NetworkError"` | `fetch` itself throws — DNS failure, CORS, network unreachable |
| `AbortError`   | `"AbortError"`   | The request was aborted via `AbortSignal`                      |
| `HttpError`    | `"HttpError"`    | The server responded with a non-2xx status code                |
| `ParseError`   | `"ParseError"`   | Body parsing failed (e.g. invalid JSON)                        |

All four extend `Error` and carry a `_tag` discriminator, so you can use
`@joyful/result`'s tagged error matching.

### Simple Error Checking

```typescript
import { jfetch } from "@joyful/fetch";

const result = await jfetch("/api/data").json<Data>();

if (result.isErr()) {
  const error = result.error;
  switch (error._tag) {
    case "NetworkError":
      console.error("Network issue:", error.message);
      break;
    case "AbortError":
      console.error("Request was cancelled");
      break;
    case "HttpError":
      console.error(`Server returned ${error.status}`);
      break;
    case "ParseError":
      console.error("Invalid response body:", error.message);
      break;
  }
}
```

### Exhaustive Recovery With `orElseMatch`

```typescript
import { jfetch } from "@joyful/fetch";
import { Result } from "@joyful/result";

const data = await jfetch("/api/config")
  .json<Config>()
  .orElseMatch({
    NetworkError: () => Result.ok(DEFAULT_CONFIG),
    AbortError: () => Result.ok(DEFAULT_CONFIG),
    HttpError: (e) => {
      if (e.status === 404) return Result.ok(DEFAULT_CONFIG);
      return Result.err(e);
    },
    ParseError: () => Result.ok(DEFAULT_CONFIG),
  });
```

### Partial Recovery With `orElseMatchSome`

Handle only the errors you care about and let the rest pass through:

```typescript
import { jfetch } from "@joyful/fetch";
import { Result } from "@joyful/result";

const result = await jfetch("/api/users")
  .json<User[]>()
  .orElseMatchSome({
    HttpError: (e) => {
      if (e.status === 404) return Result.ok([]);
      return Result.err(e);
    },
  });
// Other errors (NetworkError, AbortError, ParseError) pass through unchanged
```

### Reading Error Response Bodies

When you get an `HttpError`, the server still sent a response — maybe with a
JSON error body you want to read. The `HttpError` carries a `response` field
that is a fully usable `JoyfulResponse` already resolved with the raw response:

```typescript
import { jfetch } from "@joyful/fetch";
import { Result } from "@joyful/result";

interface ApiError {
  code: string;
  message: string;
}

const result = await jfetch("/api/action")
  .json<SuccessPayload>()
  .orElseMatchSome({
    HttpError: async (e) => {
      const body = await e.response.json<ApiError>();
      if (body.isOk()) {
        console.error(`API error ${e.status}: ${body.value.message}`);
      }
      return Result.err(e);
    },
  });
```

## Aborting Requests

Pass an `AbortSignal` the same way you would with `fetch`. Aborted requests
surface as `AbortError`:

```typescript
import { jfetch } from "@joyful/fetch";

// Timeout after 5 seconds
const result = await jfetch("/api/slow", {
  signal: AbortSignal.timeout(5000),
}).json<Data>();

if (result.isErr() && result.error._tag === "AbortError") {
  console.error("Request timed out");
}
```

```typescript
import { jfetch } from "@joyful/fetch";

// Manual abort
const controller = new AbortController();
const request = jfetch("/api/stream", { signal: controller.signal }).text();

// Cancel from elsewhere
controller.abort();

const result = await request;
```

## Sending Data

`jfetch` accepts the same `RequestInit` options as `fetch`:

```typescript
import { jfetch } from "@joyful/fetch";

// POST JSON
const created = await jfetch("/api/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Alice" }),
}).json<User>();

// PUT with FormData
const formData = new FormData();
formData.append("avatar", file);

const uploaded = await jfetch("/api/avatar", {
  method: "PUT",
  body: formData,
}).json<{ url: string }>();
```

## Composing With `Result.run`

Use `Result.run` with an async generator for sequential requests that depend on
each other. If any step fails, the generator short-circuits and returns the
error:

```typescript
import { jfetch } from "@joyful/fetch";
import { Result } from "@joyful/result";

const result = await Result.run(async function* () {
  const user = yield* jfetch("/api/me").json<User>();
  const posts = yield* jfetch(`/api/users/${user.id}/posts`).json<Post[]>();
  const latest = posts[0];

  if (!latest) {
    return Result.ok({ user, comments: [] });
  }

  const comments = yield* jfetch(`/api/posts/${latest.id}/comments`)
    .json<Comment[]>();

  return Result.ok({ user, comments });
});

if (result.isOk()) {
  console.log(result.value.user.name, result.value.comments.length);
}
```

### Direct yield with header inspection

You can also `yield* jfetch(...)` directly to get a `FetchedResponse` — a
response-like object that exposes synchronous property accessors (matching the
native `Response` surface) and body-reader methods that return
`AsyncResult<T, ParseError>`. Request-level errors short-circuit exactly as
they do with the body-reader style.

This is especially useful when you want to inspect headers or status before
deciding how to parse the body:

```typescript
import { jfetch } from "@joyful/fetch";
import { Result } from "@joyful/result";

const result = await Result.run(async function* () {
  // yield* jfetch(...) resolves the request, short-circuiting on any
  // NetworkError, AbortError, or HttpError.
  const res = yield* jfetch("/api/items");

  // Headers and status are available synchronously on the FetchedResponse.
  const total = Number(res.headers.get("x-total-count") ?? "0");

  if (res.status === 204) {
    return Result.ok({ items: [], total: 0 });
  }

  // Body reader methods return AsyncResult<T, ParseError> — the
  // request-error union is already narrowed away.
  const items = yield* res.json<Item[]>();

  return Result.ok({ items, total });
});
```

The two styles can be mixed freely in the same generator — use whichever is
clearest for each step.

## Custom Fetch Implementations

Use `createFetch` to build a `jfetch` backed by a different `fetch`
implementation — useful for testing, middleware, or adding default headers:

```typescript
import { createFetch } from "@joyful/fetch";

// Add auth headers to every request
const apiFetch = createFetch((input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getToken()}`);
  return fetch(input, { ...init, headers });
});

const user = await apiFetch("/api/me").json<User>();
```

```typescript
import { createFetch } from "@joyful/fetch";

// Use a stub in tests
const mockFetch = createFetch(() =>
  Promise.resolve(Response.json({ ok: true }))
);

const result = await mockFetch("/anything").json<{ ok: boolean }>();
console.log(result.isOk()); // true
```

## Using As A Plain PromiseLike

`JoyfulResponse` implements `PromiseLike`, so you can `await` it directly to get
a `Result<Response, ResponseError>` when you want full control over the raw
response:

```typescript
import { jfetch } from "@joyful/fetch";

const result = await jfetch("/api/data");

if (result.isOk()) {
  const response = result.value;
  console.log(response.status);
  console.log(response.headers.get("content-type"));
  const body = await response.json();
  console.log(body);
}
```

## API Overview

### Exports

- `jfetch` — default fetch wrapper using `globalThis.fetch`.
- `createFetch(fetchFn)` — create a custom `jfetch` from any `fetch`-compatible
  function.
- `JoyfulResponse` — response wrapper with body methods returning `AsyncResult`.
  Also supports `yield*` directly inside `Result.run` generators.
- `FetchedResponse` — the value returned when you `yield* jfetch(...)`. Exposes
  synchronous `Response` property accessors and body-reader methods that return
  `AsyncResult<T, ParseError>`.
- `NetworkError` — tagged error for network-level failures.
- `AbortError` — tagged error for aborted requests.
- `HttpError` — tagged error for non-2xx responses (has `.status` and
  `.response`).
- `ParseError` — tagged error for body parsing failures.
- `ResponseError` — union type: `NetworkError | AbortError | HttpError`.
- `FetchFn` — type alias for `typeof globalThis.fetch`.
- `JFetch` — type alias for `(...args: Parameters<FetchFn>) => JoyfulResponse`.

### `JoyfulResponse`

| Member           | Type                                                    | Description                                        |
| ---------------- | ------------------------------------------------------- | -------------------------------------------------- |
| `.response`      | `AsyncResult<Response, ResponseError>`                  | The underlying response as an `AsyncResult`        |
| `.json<T>()`     | `AsyncResult<T, ResponseError \| ParseError>`           | Parse body as JSON                                 |
| `.text()`        | `AsyncResult<string, ResponseError \| ParseError>`      | Read body as text                                  |
| `.arrayBuffer()` | `AsyncResult<ArrayBuffer, ResponseError \| ParseError>` | Read body as ArrayBuffer                           |
| `.blob()`        | `AsyncResult<Blob, ResponseError \| ParseError>`        | Read body as Blob                                  |
| `.bytes()`       | `AsyncResult<Uint8Array, ResponseError \| ParseError>`  | Read body as bytes                                 |
| `.formData()`    | `AsyncResult<FormData, ResponseError \| ParseError>`    | Read body as FormData                              |
| `.then(...)`     | `PromiseLike<Result<Response, ResponseError>>`          | Await directly for raw `Result`                    |
| `yield*`         | Returns `FetchedResponse`                               | Use inside `Result.run` to cross the error boundary |

### `FetchedResponse`

Obtained by `yield* jfetch(...)` inside a `Result.run` generator. Request-level
errors have already been handled at the `yield*` boundary.

| Member           | Type                            | Description                                 |
| ---------------- | ------------------------------- | ------------------------------------------- |
| `.headers`       | `Headers`                       | Response headers                            |
| `.status`        | `number`                        | HTTP status code                            |
| `.ok`            | `boolean`                       | `true` if status is 200–299                 |
| `.url`           | `string`                        | Final URL (after redirects)                 |
| `.redirected`    | `boolean`                       | Whether the request was redirected          |
| `.statusText`    | `string`                        | Status message                              |
| `.type`          | `ResponseType`                  | Response type                               |
| `.body`          | `ReadableStream \| null`        | Raw body stream                             |
| `.bodyUsed`      | `boolean`                       | Whether the body has been consumed          |
| `.response`      | `Response`                      | The underlying raw `Response`               |
| `.clone()`       | `FetchedResponse`               | Clone the response                          |
| `.json<T>()`     | `AsyncResult<T, ParseError>`    | Parse body as JSON                          |
| `.text()`        | `AsyncResult<string, ParseError>` | Read body as text                          |
| `.arrayBuffer()` | `AsyncResult<ArrayBuffer, ParseError>` | Read body as ArrayBuffer           |
| `.blob()`        | `AsyncResult<Blob, ParseError>` | Read body as Blob                           |
| `.bytes()`       | `AsyncResult<Uint8Array, ParseError>` | Read body as bytes                    |
| `.formData()`    | `AsyncResult<FormData, ParseError>` | Read body as FormData                  |

### Error Types

| Error          | Fields                                   | When                                    |
| -------------- | ---------------------------------------- | --------------------------------------- |
| `NetworkError` | `message`, `cause`                       | `fetch` throws (DNS, CORS, unreachable) |
| `AbortError`   | `message`, `cause`                       | Request aborted via `AbortSignal`       |
| `HttpError`    | `message`, `cause`, `status`, `response` | Non-2xx status code                     |
| `ParseError`   | `message`, `cause`                       | Body parsing fails                      |

All errors extend `Error` and have a `_tag` field matching their class name.

## License

MIT
