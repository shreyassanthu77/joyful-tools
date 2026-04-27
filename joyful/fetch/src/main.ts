/**
 * Fetch wrapper that returns typed task runs instead of throwing or rejecting
 * for expected request, response, and body parsing failures.
 *
 * `jfetch(...)` starts immediately like native `fetch`. The returned
 * `JoyfulResponse` is awaitable for the raw response result and yieldable in
 * async generator workflows such as `Task.do`.
 *
 * @module
 */

import {
  Err,
  Ok,
  type Result,
  taggedError,
  type TaggedErrorFactory,
} from "@joyful/result";
import { Cancelled, TaskRun } from "@joyful/task";

export { Cancelled } from "@joyful/task";

/** Default `jfetch` using `globalThis.fetch`. */
export const jfetch: JFetch = createFetch(globalThis.fetch);

/** Create a `jfetch` function backed by the given `fetch` implementation. */
export function createFetch(fetch: FetchFn): JFetch {
  async function request(
    ...args: Parameters<FetchFn>
  ): Promise<Result<FetchedResponse, ResponseError>> {
    try {
      const response = await fetch(...args);
      const wrapped = new FetchedResponse(response);

      if (!response.ok) {
        return new Err(
          new HttpError({ response: wrapped, status: response.status }),
        );
      }

      return new Ok(wrapped);
    } catch (error) {
      if (isAbortError(error)) {
        return new Err(cancelledFrom(error));
      }
      return new Err(new NetworkError({ cause: error }));
    }
  }

  return (...args) => new JoyfulResponse(request(...args));
}

/** The type of a `fetch`-compatible function. */
export type FetchFn = typeof globalThis.fetch;

/** A `fetch`-like function that returns a {@link JoyfulResponse}. */
export type JFetch = (...args: Parameters<FetchFn>) => JoyfulResponse;

/** Errors that can occur before body parsing. */
export type ResponseError = NetworkError | Cancelled | HttpError;

/** Awaitable/yieldable task run for a fetch request with body readers. */
export class JoyfulResponse extends TaskRun<FetchedResponse, ResponseError> {
  /** @internal */
  constructor(result: Promise<Result<FetchedResponse, ResponseError>>) {
    super(result);
  }

  /** Parse the response body as JSON. */
  json<T = unknown>(): TaskRun<
    T,
    ResponseError | ParseError | Cancelled
  > {
    return new TaskRun(
      this.#read("json") as Promise<
        Result<T, ResponseError | ParseError | Cancelled>
      >,
    );
  }

  /** Read the response body as text. */
  text(): TaskRun<string, ResponseError | ParseError | Cancelled> {
    return new TaskRun(this.#read("text"));
  }

  /** Read the response body as an `ArrayBuffer`. */
  arrayBuffer(): TaskRun<
    ArrayBuffer,
    ResponseError | ParseError | Cancelled
  > {
    return new TaskRun(this.#read("arrayBuffer"));
  }

  /** Read the response body as a `Blob`. */
  blob(): TaskRun<Blob, ResponseError | ParseError | Cancelled> {
    return new TaskRun(this.#read("blob"));
  }

  /** Read the response body as bytes. */
  bytes(): TaskRun<
    Uint8Array,
    ResponseError | ParseError | Cancelled
  > {
    return new TaskRun(this.#read("bytes"));
  }

  /** Read the response body as `FormData`. */
  formData(): TaskRun<
    FormData,
    ResponseError | ParseError | Cancelled
  > {
    return new TaskRun(this.#read("formData"));
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
      ResponseError | ParseError | Cancelled
    >
  > {
    const result = await this;
    if (result instanceof Err) return new Err(result.error);

    try {
      return new Ok(await result.value.response[method]());
    } catch (error) {
      if (isAbortError(error)) return new Err(cancelledFrom(error));
      return new Err(new ParseError({ cause: error }));
    }
  }
}

/** Successfully-obtained HTTP response wrapper. */
export class FetchedResponse {
  /** The underlying raw `Response`. */
  readonly response: Response;

  /** @internal */
  constructor(response: Response) {
    this.response = response;
  }

  get headers(): Headers {
    return this.response.headers;
  }

  get status(): number {
    return this.response.status;
  }

  get ok(): boolean {
    return this.response.ok;
  }

  get url(): string {
    return this.response.url;
  }

  get redirected(): boolean {
    return this.response.redirected;
  }

  get statusText(): string {
    return this.response.statusText;
  }

  get type(): ResponseType {
    return this.response.type;
  }

  get body(): ReadableStream<Uint8Array> | null {
    return this.response.body;
  }

  get bodyUsed(): boolean {
    return this.response.bodyUsed;
  }

  /** Creates a clone of this response wrapper. */
  clone(): FetchedResponse {
    return new FetchedResponse(this.response.clone());
  }

  /** Parse the response body as JSON. */
  json<T = unknown>(): TaskRun<T, ParseError | Cancelled> {
    return new TaskRun(
      this.#read("json") as Promise<Result<T, ParseError | Cancelled>>,
    );
  }

  /** Read the response body as text. */
  text(): TaskRun<string, ParseError | Cancelled> {
    return new TaskRun(this.#read("text"));
  }

  /** Read the response body as an `ArrayBuffer`. */
  arrayBuffer(): TaskRun<ArrayBuffer, ParseError | Cancelled> {
    return new TaskRun(this.#read("arrayBuffer"));
  }

  /** Read the response body as a `Blob`. */
  blob(): TaskRun<Blob, ParseError | Cancelled> {
    return new TaskRun(this.#read("blob"));
  }

  /** Read the response body as bytes. */
  bytes(): TaskRun<Uint8Array, ParseError | Cancelled> {
    return new TaskRun(this.#read("bytes"));
  }

  /** Read the response body as `FormData`. */
  formData(): TaskRun<FormData, ParseError | Cancelled> {
    return new TaskRun(this.#read("formData"));
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
    Result<Awaited<ReturnType<Response[Method]>>, ParseError | Cancelled>
  > {
    try {
      return new Ok(await this.response[method]());
    } catch (error) {
      if (isAbortError(error)) return new Err(cancelledFrom(error));
      return new Err(new ParseError({ cause: error }));
    }
  }
}

const NetworkErrorBase: TaggedErrorFactory<"NetworkError"> = taggedError(
  "NetworkError",
);

/** Network or transport failure before an HTTP response was available. */
export class NetworkError extends NetworkErrorBase {}

const HttpErrorBase: TaggedErrorFactory<"HttpError"> = taggedError("HttpError");

/** Non-2xx HTTP response. */
export class HttpError extends HttpErrorBase<{
  response: FetchedResponse;
  status: number;
}> {}

const ParseErrorBase: TaggedErrorFactory<"ParseError"> = taggedError(
  "ParseError",
);

/** Body parsing or reading failure. */
export class ParseError extends ParseErrorBase {}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError" ||
    error instanceof Error && error.name === "AbortError";
}

function cancelledFrom(reason: unknown): Cancelled {
  return new Cancelled({
    message: reason instanceof Error
      ? `Cancelled: ${reason.message}`
      : typeof reason === "string"
      ? `Cancelled: ${reason}`
      : "Cancelled",
    cause: reason,
  });
}
