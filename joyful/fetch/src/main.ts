/**
 * @module
 *
 * Joyful fetch utilities. Wraps the web standard `fetch` with
 * `@joyful/result` for type-safe error handling.
 *
 * Every call returns a {@linkcode JoyfulResponse} — an
 * `AsyncResult<FetchedResponse, ResponseError>` with convenience body methods
 * (`.json()`, `.text()`, etc.). Non-2xx responses are automatically treated as
 * errors, and network failures, cancellations, and parse errors each get their own
 * tagged error type.
 *
 * @example Basic usage
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const result = await jfetch("/api/users/1").json<User>();
 *
 * if (result.isOk()) {
 *   console.log(result.value.name);
 * } else {
 *   console.error(result.error._tag, result.error.message);
 * }
 * ```
 *
 * @example Reading headers alongside the body
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const page = await jfetch("/api/users")
 *   .andThen((res) => {
 *     const total = Number(res.headers.get("x-total-count") ?? "0");
 *     return res.json<User[]>().map((data) => ({ data, total }));
 *   })
 *   .unwrapOr({ data: [], total: 0 });
 * ```
 *
 * @example Exhaustive error recovery
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 * import { Result } from "@joyful/result";
 *
 * const config = await jfetch("/api/config")
 *   .json<Config>()
 *   .orElseMatch({
 *     NetworkError: () => Result.ok(DEFAULT_CONFIG),
 *     Cancelled: () => Result.ok(DEFAULT_CONFIG),
 *     HttpError: (e) => {
 *       if (e.status === 404) return Result.ok(DEFAULT_CONFIG);
 *       return Result.err(e);
 *     },
 *     ParseError: () => Result.ok(DEFAULT_CONFIG),
 *   });
 * ```
 *
 * @example Sequential requests with Result.run (body-reader style)
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 * import { Result } from "@joyful/result";
 *
 * const result = await Result.run(async function* () {
 *   const user = yield* jfetch("/api/me").json<User>();
 *   const posts = yield* jfetch(`/api/users/${user.id}/posts`).json<Post[]>();
 *   return Result.ok({ user, posts });
 * });
 * ```
 *
 * @example Direct yield with header inspection (new style)
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 * import { Result } from "@joyful/result";
 *
 * const result = await Result.run(async function* () {
 *   const res = yield* jfetch("/api/me");
 *   const etag = res.headers.get("etag");
 *   const user = yield* res.json<User>();
 *   return Result.ok({ etag, user });
 * });
 * ```
 */

import {
  AsyncResult,
  Result,
  taggedError,
  type TaggedErrorFactory,
} from "@joyful/result";

/**
 * Default `jfetch` using `globalThis.fetch`.
 *
 * Has the same signature as `fetch` but returns a {@linkcode JoyfulResponse}
 * instead of `Promise<Response>`.
 *
 * @example Parse JSON
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const result = await jfetch("https://api.example.com/data").json<Data>();
 * if (result.isOk()) {
 *   console.log(result.value);
 * }
 * ```
 *
 * @example POST with JSON body
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const created = await jfetch("/api/users", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ name: "Alice" }),
 * }).json<User>();
 * ```
 *
 * @example Await directly for a raw `Result<FetchedResponse, ResponseError>`
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const result = await jfetch("/api/data");
 * if (result.isOk()) {
 *   console.log(result.value.status);
 *   console.log(result.value.headers.get("content-type"));
 * }
 * ```
 */
export const jfetch: JFetch = createFetch(globalThis.fetch);

/**
 * Create a `jfetch` function backed by the given `fetch` implementation.
 *
 * Non-2xx responses are automatically treated as {@linkcode HttpError}.
 * Useful for injecting auth headers, using test stubs, or wrapping a
 * custom fetch implementation.
 *
 * @example Add auth headers to every request
 * ```ts
 * import { createFetch } from "@joyful/fetch";
 *
 * const apiFetch = createFetch((input, init) => {
 *   const headers = new Headers(init?.headers);
 *   headers.set("Authorization", `Bearer ${getToken()}`);
 *   return fetch(input, { ...init, headers });
 * });
 *
 * const user = await apiFetch("/api/me").json<User>();
 * ```
 *
 * @example Use a stub in tests
 * ```ts
 * import { createFetch } from "@joyful/fetch";
 *
 * const mockFetch = createFetch(() =>
 *   Promise.resolve(Response.json({ ok: true }))
 * );
 *
 * const result = await mockFetch("/anything").json<{ ok: boolean }>();
 * console.log(result.isOk()); // true
 * ```
 */
export function createFetch(fetch: FetchFn): JFetch {
  async function $jfetch(
    ...args: Parameters<FetchFn>
  ): Promise<Result<FetchedResponse, ResponseError>> {
    try {
      const res = await fetch(...args);
      const wrapped = new FetchedResponse(res);
      if (!res.ok) {
        return Result.err(
          new HttpError({
            response: wrapped,
            status: res.status,
          }),
        );
      }

      return Result.ok(wrapped);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return Result.err(
          new AsyncResult.Cancelled({
            message: `Cancelled: ${e.message}`,
            cause: e,
          }),
        );
      }
      return Result.err(new NetworkError({ cause: e }));
    }
  }

  return function jfetch(...args) {
    return new JoyfulResponse($jfetch(...args));
  };
}

/** The type of a `fetch`-compatible function. */
export type FetchFn = typeof globalThis.fetch;

/** A `fetch`-like function that returns a {@linkcode JoyfulResponse}. */
export type JFetch = (...args: Parameters<FetchFn>) => JoyfulResponse;

/**
 * Union of all errors that can occur before body parsing — network failures,
 * cancelled requests, and non-2xx HTTP responses.
 */
export type ResponseError = NetworkError | AsyncResult.Cancelled | HttpError;

/**
 * Async result for a fetch request with convenience body readers.
 *
 * You don't normally construct this yourself — it's returned by `jfetch` and
 * `createFetch`. `JoyfulResponse` extends
 * `AsyncResult<FetchedResponse, ResponseError>`, so you can use `map`,
 * `andThen`, `orElseMatch`, and the rest of the `AsyncResult` API directly on
 * the request before or instead of reading the body.
 *
 * @example Await directly for the raw response
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const result = await jfetch("/api/data");
 * if (result.isOk()) {
 *   console.log(result.value.status);
 *   console.log(result.value.headers.get("content-type"));
 * }
 * ```
 *
 * @example Read response metadata without parsing the body
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const etag = await jfetch("/api/data")
 *   .map((res) => res.headers.get("etag"))
 *   .unwrapOr(null);
 * ```
 */
export class JoyfulResponse extends AsyncResult<
  FetchedResponse,
  ResponseError
> {
  /**
   * Parse the response body as JSON.
   *
   * @example
   * ```ts
   * const result = await jfetch("/api/users").json<User[]>();
   * if (result.isOk()) {
   *   console.log(result.value);
   * }
   * ```
   *
   * @example With error recovery
   * ```ts
   * const users = await jfetch("/api/users")
   *   .json<User[]>()
   *   .unwrapOr([]);
   * ```
   */
  json<T = unknown>(): AsyncResult<T, ResponseError | ParseError> {
    return this.andThen((res) => res.json());
  }

  /**
   * Read the response body as text.
   *
   * @example
   * ```ts
   * const html = await jfetch("/page")
   *   .text()
   *   .unwrapOr("");
   * ```
   */
  text(): AsyncResult<string, ResponseError | ParseError> {
    return this.andThen((res) => res.text());
  }

  /**
   * Read the response body as an ArrayBuffer.
   *
   * @example
   * ```ts
   * const buffer = await jfetch("/api/file")
   *   .arrayBuffer()
   *   .expect("failed to download file");
   * ```
   */
  arrayBuffer(): AsyncResult<ArrayBuffer, ResponseError | ParseError> {
    return this.andThen((res) => res.arrayBuffer());
  }

  /**
   * Read the response body as a Blob.
   *
   * @example
   * ```ts
   * const blob = await jfetch("/api/image.png")
   *   .blob()
   *   .expect("failed to download image");
   * ```
   */
  blob(): AsyncResult<Blob, ResponseError | ParseError> {
    return this.andThen((res) => res.blob());
  }

  /**
   * Read the response body as a Uint8Array.
   *
   * @example
   * ```ts
   * const bytes = await jfetch("/api/binary")
   *   .bytes()
   *   .expect("failed to read bytes");
   * ```
   */
  bytes(): AsyncResult<Uint8Array, ResponseError | ParseError> {
    return this.andThen((res) => res.bytes());
  }

  /**
   * Read the response body as FormData.
   *
   * @example
   * ```ts
   * const form = await jfetch("/api/form")
   *   .formData()
   *   .expect("failed to parse form data");
   * ```
   */
  formData(): AsyncResult<FormData, ResponseError | ParseError> {
    return this.andThen((res) => res.formData());
  }
}

/**
 * The successfully-obtained HTTP response returned when you `yield*` a
 * {@linkcode JoyfulResponse} inside a {@linkcode Result.run} generator.
 *
 * Property accessors mirror the native Web `Response` surface so you can
 * inspect status, headers, and other metadata without any extra unwrapping.
 * Body-reader methods return `AsyncResult<T, ParseError | Cancelled>`.
 *
 * @example Inspect headers then parse
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 * import { Result } from "@joyful/result";
 *
 * const result = await Result.run(async function* () {
 *   const res = yield* jfetch("/api/items");
 *   const total = Number(res.headers.get("x-total-count") ?? "0");
 *   const items = yield* res.json<Item[]>();
 *   return Result.ok({ items, total });
 * });
 * ```
 */
export class FetchedResponse {
  /** The underlying raw `Response`. */
  readonly response: Response;

  /** @internal */
  constructor(response: Response) {
    this.response = response;
  }

  /** The `Headers` object associated with the response. */
  get headers(): Headers {
    return this.response.headers;
  }

  /** The HTTP status code of the response. */
  get status(): number {
    return this.response.status;
  }

  /** `true` if the HTTP status is in the 200–299 range. */
  get ok(): boolean {
    return this.response.ok;
  }

  /** The URL of the response (after any redirects). */
  get url(): string {
    return this.response.url;
  }

  /** `true` if the request was redirected. */
  get redirected(): boolean {
    return this.response.redirected;
  }

  /** The status message corresponding to the status code. */
  get statusText(): string {
    return this.response.statusText;
  }

  /** The type of the response (e.g. `"basic"`, `"cors"`, `"opaque"`). */
  get type(): ResponseType {
    return this.response.type;
  }

  /** The body as a `ReadableStream`, or `null` if there is no body. */
  get body(): ReadableStream<Uint8Array> | null {
    return this.response.body;
  }

  /** `true` if the response body has already been consumed. */
  get bodyUsed(): boolean {
    return this.response.bodyUsed;
  }

  /**
   * Creates a clone of this `FetchedResponse` (and its underlying `Response`).
   *
   * @returns A new `FetchedResponse` wrapping the cloned `Response`.
   */
  clone(): FetchedResponse {
    return new FetchedResponse(this.response.clone());
  }

  /**
   * Parse the response body as JSON.
   *
   * @example
   * ```ts
   * const result = await Result.run(async function* () {
   *   const res = yield* jfetch("/api/users");
   *   const users = yield* res.json<User[]>();
   *   return Result.ok(users);
   * });
   * ```
   */
  json<T = unknown>(): AsyncResult<T, ParseError | AsyncResult.Cancelled> {
    return new AsyncResult(this.#read("json"));
  }

  /**
   * Read the response body as text.
   *
   * @example
   * ```ts
   * const result = await Result.run(async function* () {
   *   const res = yield* jfetch("/page");
   *   const html = yield* res.text();
   *   return Result.ok(html);
   * });
   * ```
   */
  text(): AsyncResult<string, ParseError | AsyncResult.Cancelled> {
    return new AsyncResult(this.#read("text"));
  }

  /**
   * Read the response body as an `ArrayBuffer`.
   *
   * @example
   * ```ts
   * const result = await Result.run(async function* () {
   *   const res = yield* jfetch("/api/file");
   *   const buffer = yield* res.arrayBuffer();
   *   return Result.ok(buffer);
   * });
   * ```
   */
  arrayBuffer(): AsyncResult<ArrayBuffer, ParseError | AsyncResult.Cancelled> {
    return new AsyncResult(this.#read("arrayBuffer"));
  }

  /**
   * Read the response body as a `Blob`.
   *
   * @example
   * ```ts
   * const result = await Result.run(async function* () {
   *   const res = yield* jfetch("/api/image.png");
   *   const blob = yield* res.blob();
   *   return Result.ok(blob);
   * });
   * ```
   */
  blob(): AsyncResult<Blob, ParseError | AsyncResult.Cancelled> {
    return new AsyncResult(this.#read("blob"));
  }

  /**
   * Read the response body as a `Uint8Array`.
   *
   * @example
   * ```ts
   * const result = await Result.run(async function* () {
   *   const res = yield* jfetch("/api/binary");
   *   const bytes = yield* res.bytes();
   *   return Result.ok(bytes);
   * });
   * ```
   */
  bytes(): AsyncResult<Uint8Array, ParseError | AsyncResult.Cancelled> {
    return new AsyncResult(this.#read("bytes"));
  }

  /**
   * Read the response body as `FormData`.
   *
   * @example
   * ```ts
   * const result = await Result.run(async function* () {
   *   const res = yield* jfetch("/api/form");
   *   const form = yield* res.formData();
   *   return Result.ok(form);
   * });
   * ```
   */
  formData(): AsyncResult<FormData, ParseError | AsyncResult.Cancelled> {
    return new AsyncResult(this.#read("formData"));
  }

  async #read<
    Method extends
      | "json"
      | "text"
      | "arrayBuffer"
      | "blob"
      | "bytes"
      | "formData",
  >(
    method: Method,
  ): Promise<
    Result<
      Awaited<ReturnType<Response[Method]>>,
      ParseError | AsyncResult.Cancelled
    >
  > {
    try {
      const data = await this.response[method]();
      return Result.ok(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return Result.err(
          new AsyncResult.Cancelled({
            message: `Cancelled: ${e.message}`,
            cause: e,
          }),
        );
      }
      return Result.err(new ParseError({ cause: e }));
    }
  }
}

const NetworkErrorBase: TaggedErrorFactory<"NetworkError"> = taggedError(
  "NetworkError",
);
/**
 * Thrown when `fetch` itself fails — DNS resolution, CORS, network unreachable, etc.
 *
 * @example
 * ```ts
 * import { jfetch, NetworkError } from "@joyful/fetch";
 *
 * const result = await jfetch("https://unreachable.invalid").json();
 * if (result.isErr() && result.error instanceof NetworkError) {
 *   console.error("Network failed:", result.error.message);
 * }
 * ```
 */
export class NetworkError extends NetworkErrorBase {}

const HttpErrorBase: TaggedErrorFactory<"HttpError"> = taggedError("HttpError");
/**
 * Thrown when the response has a non-2xx status code.
 *
 * The `status` field contains the HTTP status code, and the `response` field
 * is a fully usable {@linkcode FetchedResponse} that can be used to read the
 * error body.
 *
 * @example Check the status code
 * ```ts
 * import { jfetch, HttpError } from "@joyful/fetch";
 *
 * const result = await jfetch("/api/data").json<Data>();
 * if (result.isErr() && result.error instanceof HttpError) {
 *   console.error(`Server returned ${result.error.status}`);
 * }
 * ```
 *
 * @example Read the error response body
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 * import { Result } from "@joyful/result";
 *
 * const result = await jfetch("/api/action")
 *   .json<SuccessPayload>()
 *   .orElseMatchSome({
 *     HttpError: async (e) => {
 *       const body = await e.response.json<{ message: string }>();
 *       if (body.isOk()) {
 *         console.error(`API error ${e.status}: ${body.value.message}`);
 *       }
 *       return Result.err(e);
 *     },
 *   });
 * ```
 */
export class HttpError extends HttpErrorBase<{
  response: FetchedResponse;
  status: number;
}> {}

const ParseErrorBase: TaggedErrorFactory<"ParseError"> = taggedError(
  "ParseError",
);
/**
 * Thrown when body parsing fails (e.g. `response.json()` on invalid JSON).
 *
 * @example
 * ```ts
 * import { jfetch, ParseError } from "@joyful/fetch";
 *
 * const result = await jfetch("/api/data").json<Data>();
 * if (result.isErr() && result.error instanceof ParseError) {
 *   console.error("Failed to parse response:", result.error.message);
 * }
 * ```
 */
export class ParseError extends ParseErrorBase {}

/**
 * Shared cancellation outcome re-exported from `@joyful/result` for request and
 * body-read cancellation.
 *
 * @example Timeout after 5 seconds
 * ```ts
 * import { Cancelled, jfetch } from "@joyful/fetch";
 *
 * const result = await jfetch("/api/slow", {
 *   signal: AbortSignal.timeout(5000),
 * }).json<Data>();
 *
 * if (result.isErr() && result.error instanceof Cancelled) {
 *   console.error("Request timed out");
 * }
 * ```
 *
 * @example Manual abort
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const controller = new AbortController();
 * const request = jfetch("/api/stream", { signal: controller.signal }).text();
 *
 * controller.abort();
 *
 * const result = await request;
 * // result.error._tag === "Cancelled"
 * ```
 */
export const Cancelled = AsyncResult.Cancelled;
