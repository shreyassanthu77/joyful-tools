import {
  HttpError,
  type JFetch,
  jfetch,
  type NetworkError,
  ParseError,
} from "@joyful/fetch";
import {
  type AsyncResult,
  type Result,
  taggedError,
  type TaggedErrorFactory,
} from "@joyful/result";
import type { WabaSendOptions, WabaSendResponse } from "./messages.ts";

const DEFAULT_BASE_URL = "https://graph.facebook.com";

/**
 * Options for {@link createWabaClient}.
 *
 * @example
 * ```ts
 * import { createWabaClient } from "@joypack/waba";
 *
 * const waba = createWabaClient({
 *   accessToken: Deno.env.get("WHATSAPP_ACCESS_TOKEN")!,
 *   apiVersion: "v22.0",
 * });
 * ```
 */
export interface WabaClientOptions {
  /** Permanent or temporary access token for the WhatsApp Cloud API. */
  accessToken: string;
  /** Graph API version prefix such as `v22.0`. */
  apiVersion?: string;
  /** Optional injected fetch wrapper, useful for tests or custom transport. */
  fetch?: JFetch;
}

/** Creates a new {@link WabaClient}. */
export function createWabaClient(options: WabaClientOptions): WabaClient {
  return new WabaClient(options);
}

/**
 * Minimal WhatsApp Cloud API client.
 *
 * The client only handles base URL construction, bearer auth, JSON request
 * bodies, a small `send()` convenience, and Meta error mapping. Everything
 * else is left as normal Graph API paths and payloads.
 */
export class WabaClient {
  readonly accessToken: string;
  readonly apiVersion?: string;
  readonly fetch: JFetch;

  constructor(options: WabaClientOptions) {
    this.accessToken = options.accessToken;
    this.apiVersion = options.apiVersion;
    this.fetch = options.fetch ?? jfetch;
  }

  /**
   * Sends a WhatsApp message via `POST /{phone-number-id}/messages`.
   *
   * This is a thin convenience over {@link WabaClient.request}. It selects the
   * standard messages endpoint and injects `messaging_product: "whatsapp"`,
   * while leaving the rest of the payload close to Meta's JSON shape.
   *
   * @example Send a text message
   * ```ts
   * import { createWabaClient } from "@joypack/waba";
   *
   * const waba = createWabaClient({
   *   accessToken: Deno.env.get("WHATSAPP_ACCESS_TOKEN")!,
   *   apiVersion: "v22.0",
   * });
   *
   * const sent = await waba.send({
   *   phoneNumberId: "1234567890",
   *   to: "15551234567",
   *   type: "text",
   *   text: { body: "hello" },
   * });
   * ```
   */
  send(
    options: WabaSendOptions,
  ): AsyncResult<WabaSendResponse, WabaRequestError> {
    const { phoneNumberId, signal, ...message } = options;

    return this.request<WabaSendResponse>({
      path: `/${phoneNumberId}/messages`,
      method: "POST",
      json: {
        messaging_product: "whatsapp",
        ...message,
      },
      signal,
    });
  }

  /**
   * Sends a request to the WhatsApp Cloud API.
   *
   * Non-2xx responses are mapped from `HttpError` into
   * {@link WhatsAppError}. Successful responses are parsed as JSON.
   *
   * @param options Request path, method, headers, query string, and optional
   * JSON/body payload.
   * @returns An async result containing the parsed JSON response body.
   *
   * @example Send a text message
   * ```ts
   * import { createWabaClient } from "@joypack/waba";
   *
   * const waba = createWabaClient({
   *   accessToken: Deno.env.get("WHATSAPP_ACCESS_TOKEN")!,
   *   apiVersion: "v22.0",
   * });
   *
   * const sent = await waba.request<{ messages: Array<{ id: string }> }>({
   *   path: "/1234567890/messages",
   *   json: {
   *     messaging_product: "whatsapp",
   *     to: "15551234567",
   *     type: "text",
   *     text: { body: "hello" },
   *   },
   * });
   * ```
   */
  request<T = unknown>(
    options: WabaRequestOptions,
  ): AsyncResult<T, WabaRequestError> {
    const apiVersion = this.apiVersion?.replace(/^\/+|\/+$/g, "");
    const path = options.path.replace(/^\/+/, "");
    const url = new URL(
      apiVersion == null ||
        apiVersion.length === 0 ||
        path === apiVersion ||
        path.startsWith(`${apiVersion}/`)
        ? `/${path}`
        : `/${apiVersion}/${path}`,
      DEFAULT_BASE_URL,
    );

    if (options.searchParams instanceof URLSearchParams) {
      options.searchParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    } else if (options.searchParams != null) {
      for (const [key, value] of Object.entries(options.searchParams)) {
        if (value != null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const headers = new Headers(options.headers);
    headers.set("authorization", `Bearer ${this.accessToken}`);

    let body = options.body;
    if ("json" in options && options.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.json);
    }

    return this.fetch(url, {
      method: options.method ?? (body == null ? "GET" : "POST"),
      headers,
      body,
      signal: options.signal,
    })
      .json<T>()
      .mapErr((error): PromiseOr<WabaRequestError> => {
        if (error instanceof HttpError) return toWhatsAppError(error);
        if (error instanceof ParseError) {
          return new WhatsAppError({
            message: "WhatsApp API returned an invalid JSON response",
            cause: error,
          });
        }
        return error;
      });
  }
}

/** Options for {@link WabaClient.request}. */
export type WabaRequestOptions =
  & {
    /**
     * Graph path relative to `https://graph.facebook.com`, for example
     * `"/1234567890/messages"`.
     */
    path: string;
    /** HTTP method. Defaults to `GET` or `POST` when a body is present. */
    method?: string;
    /** Extra request headers merged with the bearer token header. */
    headers?: HeadersInit;
    /** Query-string values appended to the request URL. */
    searchParams?: WabaSearchParams;
    /** Optional abort signal passed through to the underlying fetch call. */
    signal?: AbortSignal;
  }
  & (
    | { json?: unknown; body?: never }
    | { body?: BodyInit | null; json?: never }
    | { json?: undefined; body?: undefined }
  );

/** Errors that can happen before, during, or after a WhatsApp API request. */
export type WabaRequestError = NetworkError | Result.Cancelled | WhatsAppError;

const WhatsAppErrorBase: TaggedErrorFactory<"WhatsAppError"> = taggedError(
  "WhatsAppError",
);

/**
 * Structured error for WhatsApp API failures.
 *
 * Non-2xx responses include `status` and any structured Meta error fields that
 * were present in the JSON body. Parse failures are also normalized into this
 * error so callers do not have to handle `ParseError` directly.
 */
export class WhatsAppError extends WhatsAppErrorBase<{
  /** HTTP status code returned by Meta, when the server responded. */
  status?: number;
  /** Meta error type, when present. */
  type?: string;
  /** Meta error code, when present. */
  code?: number;
  /** Meta error subcode, when present. */
  subcode?: number;
  /** Meta trace id useful when debugging with Meta support. */
  fbtraceId?: string;
  /** User-facing or nested detail string from the error payload. */
  details?: string;
  /** Parsed JSON error body returned by Meta, when available. */
  body?: MetaErrorResponse;
}> {}

type MetaErrorEnvelope = {
  error?: MetaErrorResponse["error"];
};

type MetaErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_user_msg?: string;
    error_data?: {
      details?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

async function toWhatsAppError(error: HttpError): Promise<WhatsAppError> {
  const fallbackMessage =
    `WhatsApp API request failed with status ${error.status}`;
  const payload = await error.response.json<MetaErrorEnvelope>();
  if (payload.isErr()) {
    return new WhatsAppError({
      message: fallbackMessage,
      status: error.status,
      cause: error,
    });
  }

  const metaError = payload.value.error ?? {};
  return new WhatsAppError({
    message: metaError.message ?? fallbackMessage,
    status: error.status,
    type: metaError.type,
    code: metaError.code,
    subcode: metaError.error_subcode,
    fbtraceId: metaError.fbtrace_id,
    details: metaError.error_data?.details ?? metaError.error_user_msg,
    body: payload.value,
    cause: error,
  });
}

/** Primitive query-string value accepted by {@link WabaRequestOptions.searchParams}. */
export type WabaSearchParamValue = string | number | boolean | null | undefined;

/** Query-string input accepted by {@link WabaClient.request}. */
export type WabaSearchParams =
  | URLSearchParams
  | Record<string, WabaSearchParamValue>;

type PromiseOr<T> = T | Promise<T>;
