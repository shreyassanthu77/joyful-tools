import {
  type FetchedResponse,
  HttpError,
  type JFetch,
  jfetch,
  type NetworkError,
} from "@joyful/fetch";
import {
  type AsyncResult,
  type Result,
  taggedError,
  type TaggedErrorFactory,
} from "@joyful/result";

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
  accessToken: string;
  apiVersion?: string;
  fetch?: JFetch;
}

export function createWabaClient(options: WabaClientOptions): WabaClient {
  return new WabaClient(options);
}

export type WabaRequestOptions = {
  path: string;
  method?: string;
  headers?: HeadersInit;
  searchParams?: WabaSearchParams;
  signal?: AbortSignal;
} & (
  | { json?: unknown; body?: never }
  | { body?: BodyInit | null; json?: never }
  | { json?: undefined; body?: undefined }
);

export class WabaClient {
  readonly accessToken: string;
  readonly apiVersion?: string;
  readonly fetch: JFetch;

  constructor(options: WabaClientOptions) {
    this.accessToken = options.accessToken;
    this.apiVersion = options.apiVersion;
    this.fetch = options.fetch ?? jfetch;
  }

  request(
    options: WabaRequestOptions,
  ): AsyncResult<FetchedResponse, WabaResponseError> {
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
    }).mapErr(
      (err): PromiseOr<NetworkError | Result.Cancelled | WhatsAppApiError> => {
        if (err instanceof HttpError) return toWhatsAppApiError(err);
        return err;
      },
    );
  }
}

export type WabaResponseError =
  | NetworkError
  | Result.Cancelled
  | WhatsAppApiError;

const WhatsAppApiErrorBase: TaggedErrorFactory<"WhatsAppApiError"> =
  taggedError("WhatsAppApiError");

export class WhatsAppApiError extends WhatsAppApiErrorBase<{
  status: number;
  type?: string;
  code?: number;
  subcode?: number;
  fbtraceId?: string;
  details?: string;
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

async function toWhatsAppApiError(error: HttpError): Promise<WhatsAppApiError> {
  const fallbackMessage = `WhatsApp API request failed with status ${error.status}`;
  const payload = await error.response.json<MetaErrorEnvelope>();
  if (payload.isErr()) {
    return new WhatsAppApiError({
      message: fallbackMessage,
      status: error.status,
      cause: error,
    });
  }

  const metaError = payload.value.error ?? {};
  return new WhatsAppApiError({
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

export type WabaSearchParamValue = string | number | boolean | null | undefined;

export type WabaSearchParams =
  | URLSearchParams
  | Record<string, WabaSearchParamValue>;

type PromiseOr<T> = T | Promise<T>;
