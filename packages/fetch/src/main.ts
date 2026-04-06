/**
 * @module
 *
 * Joyful fetch utilities. Wraps the web standard `fetch` with
 * `@joyful/result` for type-safe error handling.
 *
 * Every call returns a {@linkcode JoyfulResponse} — a thin wrapper whose body
 * methods (`.json()`, `.text()`, etc.) return `AsyncResult` instead of raw
 * promises. Non-2xx responses are automatically treated as errors, and network
 * failures, aborts, and parse errors each get their own tagged error type.
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
 * import { Result } from "@joyful/result";
 *
 * const page = await jfetch("/api/users")
 *   .response
 *   .andThen(async (res) => {
 *     const total = Number(res.headers.get("x-total-count") ?? "0");
 *     const data = await res.json() as User[];
 *     return Result.ok({ data, total });
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
 *     AbortError: () => Result.ok(DEFAULT_CONFIG),
 *     HttpError: (e) => {
 *       if (e.status === 404) return Result.ok(DEFAULT_CONFIG);
 *       return Result.err(e);
 *     },
 *     ParseError: () => Result.ok(DEFAULT_CONFIG),
 *   });
 * ```
 *
 * @example Sequential requests with Result.run
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
 */

import { AsyncResult, Err, Result } from "@joyful/result";

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
 * @example Await directly for a raw Result<Response, ResponseError>
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
  ): Promise<Result<Response, ResponseError>> {
    try {
      const res = await fetch(...args);
      if (!res.ok) {
        const wrapped = new JoyfulResponse(Promise.resolve(Result.ok(res)));
        return Result.err(
          new HttpError({ response: wrapped, status: res.status }),
        );
      }

      return Result.ok(res);
    } catch (e) {
      if (e instanceof DOMException) {
        return Result.err(new AbortError({ cause: e }));
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
 * aborted requests, and non-2xx HTTP responses.
 */
export type ResponseError = NetworkError | AbortError | HttpError;

/**
 * Wraps a `Response` to provide body parsing methods that return `AsyncResult`.
 *
 * You don't normally construct this yourself — it's returned by `jfetch` and
 * `createFetch`. It implements `PromiseLike`, so you can `await` it directly
 * to get a `Result<Response, ResponseError>`.
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
 * @example Access the underlying AsyncResult via .response
 * ```ts
 * import { jfetch } from "@joyful/fetch";
 *
 * const etag = await jfetch("/api/data")
 *   .response
 *   .map((res) => res.headers.get("etag"))
 *   .unwrapOr(null);
 * ```
 */
export class JoyfulResponse
  implements PromiseLike<Result<Response, ResponseError>> {
  #response: Promise<Result<Response, ResponseError>>;

  constructor(response: Promise<Result<Response, ResponseError>>) {
    this.#response = response;
  }

  then<P, Q>(
    onfulfilled?: (
      value: Result<Response, ResponseError>,
    ) => P | PromiseLike<P>,
    onrejected?: (reason: unknown) => Q | PromiseLike<Q>,
  ): PromiseLike<P | Q> {
    return this.#response.then(onfulfilled, onrejected);
  }

  /** The underlying response as an `AsyncResult`. Use this to read headers
   * or other response metadata.
   *
   * @example Read a header value
   * ```ts
   * const contentType = await jfetch("/api/data")
   *   .response
   *   .map((res) => res.headers.get("content-type"))
   *   .unwrapOr(null);
   * ```
   *
   * @example Read headers and body together
   * ```ts
   * import { Result } from "@joyful/result";
   *
   * const page = await jfetch("/api/users")
   *   .response
   *   .andThen(async (res) => {
   *     const total = Number(res.headers.get("x-total-count") ?? "0");
   *     const data = await res.json() as User[];
   *     return Result.ok({ data, total });
   *   })
   *   .unwrapOr({ data: [], total: 0 });
   * ```
   */
  get response(): AsyncResult<Response, ResponseError> {
    return new AsyncResult(this.#response);
  }

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
    return new AsyncResult(this.#read("json"));
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
    return new AsyncResult(this.#read("text"));
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
    return new AsyncResult(this.#read("arrayBuffer"));
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
    return new AsyncResult(this.#read("blob"));
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
    return new AsyncResult(this.#read("bytes"));
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
    Result<Awaited<ReturnType<Response[Method]>>, ResponseError | ParseError>
  > {
    const res = await this.#response;
    // @ts-expect-error - we know the value is an error so we can safely cast to a result with a different Value type
    if (res instanceof Err) return res;
    try {
      const data = await res.value[method]();
      return Result.ok(data);
    } catch (e) {
      return Result.err(new ParseError({ cause: e }));
    }
  }
}

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
export class NetworkError extends Result.taggedError("NetworkError") {}

/**
 * Thrown when the request is aborted via `AbortSignal` or times out via
 * `AbortSignal.timeout()`.
 *
 * @example Timeout after 5 seconds
 * ```ts
 * import { jfetch, AbortError } from "@joyful/fetch";
 *
 * const result = await jfetch("/api/slow", {
 *   signal: AbortSignal.timeout(5000),
 * }).json<Data>();
 *
 * if (result.isErr() && result.error instanceof AbortError) {
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
 * // result.error._tag === "AbortError"
 * ```
 */
export class AbortError extends Result.taggedError("AbortError") {}

/**
 * Thrown when the response has a non-2xx status code.
 *
 * The `status` field contains the HTTP status code, and the `response` field
 * is a fully usable {@linkcode JoyfulResponse} that can be used to read the
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
export class HttpError extends Result.taggedError("HttpError")<{
  response: JoyfulResponse;
  status: number;
}> {}

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
export class ParseError extends Result.taggedError("ParseError") {}
