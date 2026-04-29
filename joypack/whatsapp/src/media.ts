import { HttpError } from "@joyful/fetch";
import type { FetchedResponse } from "@joyful/fetch";
import type { AsyncResult } from "@joyful/result";
import {
  type PromiseOr,
  toWhatsAppError,
  type WhatsAppClient,
  WhatsAppError,
  type WhatsAppRequestError,
} from "./client.ts";

/** Shared media reference accepted by WhatsApp media and template payloads. */
export type WhatsAppMediaReference = { id: string } | { link: string };

/** Uploaded media record returned by Meta's media metadata endpoint. */
export interface WhatsAppMediaMetadata {
  id: string;
  url: string;
  messaging_product?: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
  [key: string]: unknown;
}

/** Successful response body returned by `POST /{phone-number-id}/media`. */
export interface WhatsAppUploadMediaResponse {
  id: string;
  [key: string]: unknown;
}

/** Successful response body returned by `DELETE /{media-id}`. */
export interface WhatsAppDeleteMediaResponse {
  success: boolean;
  [key: string]: unknown;
}

/** Metadata plus the authenticated binary response fetched from Meta's media URL. */
export interface WhatsAppMediaDownloadResponse {
  media: WhatsAppMediaMetadata;
  response: FetchedResponse;
}

/** Options for `whatsapp.media.upload(...)`. */
export interface WhatsAppUploadMediaOptions {
  phoneNumberId: string;
  file: Blob;
  filename?: string;
  mimeType?: string;
  signal?: AbortSignal;
}

/** Options for `whatsapp.media.get(...)`. */
export interface WhatsAppGetMediaOptions {
  mediaId: string;
  signal?: AbortSignal;
}

/** Options for `whatsapp.media.download(...)`. */
export interface WhatsAppDownloadMediaOptions {
  mediaId: string;
  signal?: AbortSignal;
}

/** Options for `whatsapp.media.delete(...)`. */
export interface WhatsAppDeleteMediaOptions {
  mediaId: string;
  signal?: AbortSignal;
}

/** Media helper namespace attached to {@link WhatsAppClient.media}. */
export class WhatsAppMediaApi {
  readonly #client: WhatsAppClient;

  constructor(client: WhatsAppClient) {
    this.#client = client;
  }

  upload(
    options: WhatsAppUploadMediaOptions,
  ): AsyncResult<WhatsAppUploadMediaResponse, WhatsAppRequestError> {
    const body = new FormData();
    body.set("messaging_product", "whatsapp");

    const mimeType = options.mimeType ?? options.file.type;
    if (mimeType.length > 0) {
      body.set("type", mimeType);
    }

    if (options.filename == null) {
      body.set("file", options.file);
    } else {
      body.set("file", options.file, options.filename);
    }

    return this.#client
      .request(`${options.phoneNumberId}/media`, {
        method: "POST",
        body,
        signal: options.signal,
      })
      .json<WhatsAppUploadMediaResponse>()
      .mapErr((error): PromiseOr<WhatsAppRequestError> => {
        if (error instanceof HttpError) return toWhatsAppError(error);
        if (error._tag === "ParseError") {
          return new WhatsAppError({
            message: "WhatsApp API returned an invalid JSON response",
            cause: error,
          });
        }
        return error;
      });
  }

  get(
    options: WhatsAppGetMediaOptions,
  ): AsyncResult<WhatsAppMediaMetadata, WhatsAppRequestError> {
    return this.#client
      .request(options.mediaId, {
        method: "GET",
        signal: options.signal,
      })
      .json<WhatsAppMediaMetadata>()
      .mapErr((error): PromiseOr<WhatsAppRequestError> => {
        if (error instanceof HttpError) return toWhatsAppError(error);
        if (error._tag === "ParseError") {
          return new WhatsAppError({
            message: "WhatsApp API returned an invalid JSON response",
            cause: error,
          });
        }
        return error;
      });
  }

  download(
    options: WhatsAppDownloadMediaOptions,
  ): AsyncResult<WhatsAppMediaDownloadResponse, WhatsAppRequestError> {
    return this.get(options).andThen((media) => {
      const headers = new Headers();
      headers.set("authorization", `Bearer ${this.#client.accessToken}`);
      return this.#client
        .request(media.url, {
          headers,
          signal: options.signal,
        })
        .map((response) => ({
          media,
          response,
        }))
        .mapErr((error): PromiseOr<WhatsAppRequestError> => {
          if (error instanceof HttpError) return toWhatsAppError(error);
          return error;
        });
    });
  }

  delete(
    options: WhatsAppDeleteMediaOptions,
  ): AsyncResult<WhatsAppDeleteMediaResponse, WhatsAppRequestError> {
    return this.#client
      .request(options.mediaId, {
        method: "DELETE",
        signal: options.signal,
      })
      .json<WhatsAppDeleteMediaResponse>()
      .mapErr((error): PromiseOr<WhatsAppRequestError> => {
        if (error instanceof HttpError) return toWhatsAppError(error);
        if (error._tag === "ParseError") {
          return new WhatsAppError({
            message: "WhatsApp API returned an invalid JSON response",
            cause: error,
          });
        }
        return error;
      });
  }
}
