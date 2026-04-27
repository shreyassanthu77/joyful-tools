import {
  type Cancelled,
  type HttpError,
  type JFetch,
  jfetch,
  type NetworkError,
} from "@joyful/fetch";
import { taggedError, type TaggedErrorFactory } from "@joyful/result";
import { WhatsAppMediaApi } from "./media.ts";
import { WhatsAppMessagesApi } from "./messages.ts";

const DEFAULT_BASE_URL = "https://graph.facebook.com";

/**
 * Options for {@link createWhatsAppClient}.
 *
 * @example
 * ```ts
 * import { createWhatsAppClient } from "@joypack/whatsapp";
 *
 * const whatsapp = createWhatsAppClient({
 *   accessToken: Deno.env.get("WHATSAPP_ACCESS_TOKEN")!,
 *   apiVersion: "v22.0",
 * });
 * ```
 */
export interface WhatsAppClientOptions {
  /** Permanent or temporary access token for the WhatsApp Cloud API. */
  accessToken: string;
  /** Graph API version prefix such as `v22.0`. */
  apiVersion?: string;
  /** Optional injected fetch wrapper, useful for tests or custom transport. */
  fetch?: JFetch;
}

/** Creates a new {@link WhatsAppClient}. */
export function createWhatsAppClient(
  options: WhatsAppClientOptions,
): WhatsAppClient {
  return new WhatsAppClient(options);
}

/**
 * Minimal WhatsApp Cloud API client.
 *
 * The client only handles Graph path resolution and bearer auth. Higher-level
 * helpers live under {@link WhatsAppClient.messages} and
 * {@link WhatsAppClient.media}.
 */
export class WhatsAppClient {
  readonly accessToken: string;
  readonly apiVersion?: string;
  readonly messages: WhatsAppMessagesApi;
  readonly media: WhatsAppMediaApi;
  readonly #fetch: JFetch;

  constructor(options: WhatsAppClientOptions) {
    this.accessToken = options.accessToken;
    this.apiVersion = options.apiVersion;
    this.#fetch = options.fetch ?? jfetch;
    this.messages = new WhatsAppMessagesApi(this);
    this.media = new WhatsAppMediaApi(this);
  }

  /**
   * Sends an authenticated request.
   *
   * Relative paths are resolved against the configured Graph API version.
   * Absolute URLs are used as-is, which is useful for media downloads.
   */
  request(path: string | URL, init?: RequestInit): ReturnType<JFetch> {
    const url = path instanceof URL || /^https?:\/\//.test(path)
      ? new URL(path)
      : new URL(
        (() => {
          const apiVersion = this.apiVersion?.replace(/^\/+|\/+$/g, "");
          const trimmedPath = path.replace(/^\/+/, "");
          if (
            apiVersion == null ||
            apiVersion.length === 0 ||
            trimmedPath === apiVersion ||
            trimmedPath.startsWith(`${apiVersion}/`)
          ) {
            return `/${trimmedPath}`;
          }
          return `/${apiVersion}/${trimmedPath}`;
        })(),
        DEFAULT_BASE_URL,
      );
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${this.accessToken}`);
    return this.#fetch(url, {
      ...init,
      headers,
    });
  }
}

/** Errors that can happen before, during, or after a WhatsApp API request. */
export type WhatsAppRequestError =
  | NetworkError
  | Cancelled
  | WhatsAppError;

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

export async function toWhatsAppError(
  error: HttpError,
): Promise<WhatsAppError> {
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

export type PromiseOr<T> = T | Promise<T>;
