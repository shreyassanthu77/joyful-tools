import { HttpError, ParseError } from "@joyful/fetch";
import type { FetchedResponse } from "@joyful/fetch";
import { Err, Ok, type Result } from "@joyful/result";
import { TaskRun } from "@joyful/task";
import {
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
  ): TaskRun<WhatsAppUploadMediaResponse, WhatsAppRequestError> {
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

    return new TaskRun(mapWhatsAppError(
      this.#client
        .request(`${options.phoneNumberId}/media`, {
          method: "POST",
          body,
          signal: options.signal,
        })
        .json<WhatsAppUploadMediaResponse>(),
    ));
  }

  get(
    options: WhatsAppGetMediaOptions,
  ): TaskRun<WhatsAppMediaMetadata, WhatsAppRequestError> {
    return new TaskRun(mapWhatsAppError(
      this.#client
        .request(options.mediaId, {
          method: "GET",
          signal: options.signal,
        })
        .json<WhatsAppMediaMetadata>(),
    ));
  }

  download(
    options: WhatsAppDownloadMediaOptions,
  ): TaskRun<WhatsAppMediaDownloadResponse, WhatsAppRequestError> {
    return new TaskRun((async () => {
      const media = await this.get(options);
      if (media instanceof Err) return new Err(media.error);

      const headers = new Headers();
      headers.set("authorization", `Bearer ${this.#client.accessToken}`);
      const response = await this.#client.request(media.value.url, {
        headers,
        signal: options.signal,
      });

      if (response instanceof Err) {
        const error = response.error instanceof HttpError
          ? await toWhatsAppError(response.error)
          : response.error;
        return new Err(error);
      }

      return new Ok({ media: media.value, response: response.value });
    })());
  }

  delete(
    options: WhatsAppDeleteMediaOptions,
  ): TaskRun<WhatsAppDeleteMediaResponse, WhatsAppRequestError> {
    return new TaskRun(mapWhatsAppError(
      this.#client
        .request(options.mediaId, {
          method: "DELETE",
          signal: options.signal,
        })
        .json<WhatsAppDeleteMediaResponse>(),
    ));
  }
}

async function mapWhatsAppError<T>(
  resultRun: PromiseLike<
    Result<T, HttpError | ParseError | WhatsAppRequestError>
  >,
): Promise<Result<T, WhatsAppRequestError>> {
  const result = await resultRun;
  if (!(result instanceof Err)) return new Ok(result.value);

  const error = result.error;
  if (error instanceof HttpError) {
    return new Err(await toWhatsAppError(error));
  }
  if (error instanceof ParseError) {
    return new Err(
      new WhatsAppError({
        message: "WhatsApp API returned an invalid JSON response",
        cause: error,
      }),
    );
  }
  return new Err(error);
}
