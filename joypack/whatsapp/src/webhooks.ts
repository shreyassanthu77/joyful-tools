const BODY_RECEIVED = "EVENT_RECEIVED";

/**
 * Raw WhatsApp webhook payload.
 *
 * The payload is intentionally modelled loosely so the package can accept new
 * webhook fields without needing a release for every upstream addition.
 */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
  [key: string]: unknown;
}

/** A webhook entry from `payload.entry[]`. */
export interface WhatsAppWebhookEntry {
  id?: string;
  changes?: WhatsAppWebhookChange[];
  [key: string]: unknown;
}

/** A webhook change from `entry.changes[]`. */
export interface WhatsAppWebhookChange {
  field?: string;
  value?: WhatsAppWebhookValue;
  [key: string]: unknown;
}

/** Common webhook value shape used by WhatsApp Cloud API change events. */
export interface WhatsAppWebhookValue {
  messaging_product?: string;
  metadata?: WhatsAppWebhookMetadata;
  contacts?: WhatsAppWebhookContact[];
  messages?: WhatsAppWebhookMessage[];
  statuses?: WhatsAppWebhookStatus[];
  [key: string]: unknown;
}

/** Common metadata block included with webhook events. */
export interface WhatsAppWebhookMetadata {
  display_phone_number?: string;
  phone_number_id?: string;
  [key: string]: unknown;
}

/** Incoming contact block from a webhook message event. */
export interface WhatsAppWebhookContact {
  wa_id?: string;
  profile?: {
    name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Context block included on replies to earlier messages. */
export interface WhatsAppWebhookMessageContext {
  from?: string;
  id?: string;
  [key: string]: unknown;
}

/** Text message body from an inbound webhook event. */
export interface WhatsAppWebhookText {
  body?: string;
  [key: string]: unknown;
}

/** Interactive reply button selection from an inbound webhook event. */
export interface WhatsAppWebhookInteractiveButtonReply {
  id?: string;
  title?: string;
  [key: string]: unknown;
}

/** Interactive list selection from an inbound webhook event. */
export interface WhatsAppWebhookInteractiveListReply {
  id?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

/** Interactive content block from an inbound webhook event. */
export interface WhatsAppWebhookInteractive {
  type?: string;
  button_reply?: WhatsAppWebhookInteractiveButtonReply;
  list_reply?: WhatsAppWebhookInteractiveListReply;
  [key: string]: unknown;
}

/** Incoming WhatsApp message payload. */
export interface WhatsAppWebhookMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  context?: WhatsAppWebhookMessageContext;
  text?: WhatsAppWebhookText;
  interactive?: WhatsAppWebhookInteractive;
  [key: string]: unknown;
}

/** Inbound text message. */
export interface WhatsAppWebhookTextMessage extends WhatsAppWebhookMessage {
  type: "text";
  text: WhatsAppWebhookText;
}

/** Inbound interactive button reply message. */
export interface WhatsAppWebhookInteractiveButtonReplyMessage
  extends WhatsAppWebhookMessage {
  type: "interactive";
  interactive: WhatsAppWebhookInteractive & {
    type: "button_reply";
    button_reply: WhatsAppWebhookInteractiveButtonReply;
  };
}

/** Inbound interactive list reply message. */
export interface WhatsAppWebhookInteractiveListReplyMessage
  extends WhatsAppWebhookMessage {
  type: "interactive";
  interactive: WhatsAppWebhookInteractive & {
    type: "list_reply";
    list_reply: WhatsAppWebhookInteractiveListReply;
  };
}

/** Outbound message status update payload. */
export interface WhatsAppWebhookStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  [key: string]: unknown;
}

/**
 * Normalized per-item webhook event.
 *
 * Each message or status entry becomes its own event, while unsupported change
 * shapes are surfaced as `unknown` so callers can still inspect the raw value.
 */
export type WhatsAppWebhookMessageKind =
  | "text"
  | "interactive_button_reply"
  | "interactive_list_reply"
  | "unknown";

type WebhookEventBase = {
  entry: WhatsAppWebhookEntry;
  change: WhatsAppWebhookChange;
  value: WhatsAppWebhookValue;
  metadata?: WhatsAppWebhookMetadata;
};

type MessageWebhookEvent<
  TMessageKind extends WhatsAppWebhookMessageKind,
  TMessage extends WhatsAppWebhookMessage,
> = WebhookEventBase & {
  kind: "message";
  contacts: WhatsAppWebhookContact[];
  messageKind: TMessageKind;
  message: TMessage;
};

export type WebhookEvent =
  | MessageWebhookEvent<"text", WhatsAppWebhookTextMessage>
  | MessageWebhookEvent<
    "interactive_button_reply",
    WhatsAppWebhookInteractiveButtonReplyMessage
  >
  | MessageWebhookEvent<
    "interactive_list_reply",
    WhatsAppWebhookInteractiveListReplyMessage
  >
  | MessageWebhookEvent<"unknown", WhatsAppWebhookMessage>
  | (WebhookEventBase & {
    kind: "status";
    status: WhatsAppWebhookStatus;
  })
  | (WebhookEventBase & {
    kind: "unknown";
  });

/** Context passed to a {@link WebhookEventHandler}. */
export interface WebhookEventContext {
  /** One normalized message, status, or fallback event. */
  event: WebhookEvent;
  /** Raw parsed webhook payload. */
  payload: WhatsAppWebhookPayload;
  /** Incoming request. The body has already been consumed by the handler. */
  request: Request;
}

/** Called for each normalized webhook event. */
export type WebhookEventHandler = (
  context: WebhookEventContext,
) => void | Promise<void>;

/** Options for {@link handleWebhooks}. */
export interface HandleWebhooksOptions {
  /** Verify token configured in the Meta developer dashboard. */
  verifyToken: string;
  /** Optional app secret used to validate `X-Hub-Signature-256`. */
  appSecret?: string;
}

/** Fetch-style webhook handler function. */
export type WebhookHandler = (request: Request) => Promise<Response>;

/**
 * Creates a fetch-style WhatsApp webhook handler.
 *
 * The returned handler accepts both the verification `GET` request and the
 * delivery `POST` request on the same route so the surrounding framework keeps
 * full routing control.
 *
 * If `appSecret` is provided, the handler validates `X-Hub-Signature-256`
 * before parsing the payload. Each message or status item is flattened into its
 * own {@link WebhookEvent} before `onEvent` runs.
 *
 * @param onEvent Called once for every normalized webhook event.
 * @param options Verification token and optional app secret.
 * @returns A fetch-style request handler that can be mounted on a webhook route.
 *
 * @example
 * ```ts
 * import { handleWebhooks } from "@joypack/whatsapp";
 *
 * const webhook = handleWebhooks(
 *   async ({ event }) => {
 *     if (event.kind === "message" && event.messageKind === "text") {
 *       console.log(event.message.text.body);
 *     }
 *   },
 *   {
 *     verifyToken: Deno.env.get("WHATSAPP_VERIFY_TOKEN")!,
 *     appSecret: Deno.env.get("WHATSAPP_APP_SECRET"),
 *   },
 * );
 * ```
 */
export function handleWebhooks(
  onEvent: WebhookEventHandler,
  options: HandleWebhooksOptions,
): WebhookHandler {
  return function webhookHandler(request: Request): Promise<Response> {
    switch (request.method) {
      case "GET":
        return Promise.resolve(handleVerificationRequest(request, options));
      case "POST":
        return handleDeliveryRequest(request, onEvent, options);
      default:
        return Promise.resolve(
          textResponse("Method not allowed", 405, { allow: "GET, POST" }),
        );
    }
  };
}

/**
 * Flattens a raw webhook payload into normalized per-message and per-status
 * events.
 *
 * This is useful when you already have the parsed payload and want the same
 * normalization logic that {@link handleWebhooks} uses internally.
 *
 * @example
 * ```ts
 * import { webhookEvents } from "@joypack/whatsapp";
 *
 * const events = webhookEvents(payload);
 * for (const event of events) {
 *   console.log(event.kind);
 * }
 * ```
 */
export function webhookEvents(
  payload: WhatsAppWebhookPayload,
): WebhookEvent[] {
  const events: WebhookEvent[] = [];

  for (const entry of payload.entry) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      const value = change.value ?? {};
      const metadata = value.metadata;
      const contacts = value.contacts ?? [];

      let emitted = false;

      for (const message of value.messages ?? []) {
        const baseEvent = {
          kind: "message" as const,
          entry,
          change,
          value,
          metadata,
          contacts,
        };

        if (isTextMessage(message)) {
          events.push({
            ...baseEvent,
            messageKind: "text",
            message,
          });
        } else if (isInteractiveButtonReplyMessage(message)) {
          events.push({
            ...baseEvent,
            messageKind: "interactive_button_reply",
            message,
          });
        } else if (isInteractiveListReplyMessage(message)) {
          events.push({
            ...baseEvent,
            messageKind: "interactive_list_reply",
            message,
          });
        } else {
          events.push({
            ...baseEvent,
            messageKind: "unknown",
            message,
          });
        }

        emitted = true;
      }

      for (const status of value.statuses ?? []) {
        events.push({
          kind: "status",
          entry,
          change,
          value,
          metadata,
          status,
        });
        emitted = true;
      }

      if (!emitted) {
        events.push({
          kind: "unknown",
          entry,
          change,
          value,
          metadata,
        });
      }
    }
  }

  return events;
}

async function handleDeliveryRequest(
  request: Request,
  onEvent: WebhookEventHandler,
  options: HandleWebhooksOptions,
): Promise<Response> {
  const body = new Uint8Array(await request.arrayBuffer());

  if (options.appSecret != null) {
    const signature = request.headers.get("x-hub-signature-256");
    if (
      signature == null ||
      !(await verifySignature(body, signature, options.appSecret))
    ) {
      return textResponse("Invalid webhook signature", 401);
    }
  }

  const payload = parseWebhookPayload(body);
  if (payload == null) {
    return textResponse("Invalid webhook payload", 400);
  }

  for (const event of webhookEvents(payload)) {
    await onEvent({ event, payload, request });
  }

  return textResponse(BODY_RECEIVED, 200);
}

function handleVerificationRequest(
  request: Request,
  options: HandleWebhooksOptions,
): Response {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || challenge == null) {
    return textResponse("Invalid webhook verification request", 400);
  }

  if (verifyToken !== options.verifyToken) {
    return textResponse("Invalid webhook verification token", 403);
  }

  return textResponse(challenge, 200);
}

function parseWebhookPayload(
  body: Uint8Array,
): WhatsAppWebhookPayload | null {
  try {
    return JSON.parse(new TextDecoder().decode(body)) as WhatsAppWebhookPayload;
  } catch {
    return null;
  }
}

function isTextMessage(
  message: WhatsAppWebhookMessage,
): message is WhatsAppWebhookTextMessage {
  return message.type === "text" && message.text != null;
}

function isInteractiveButtonReplyMessage(
  message: WhatsAppWebhookMessage,
): message is WhatsAppWebhookInteractiveButtonReplyMessage {
  return message.type === "interactive" &&
    message.interactive?.type === "button_reply" &&
    message.interactive.button_reply != null;
}

function isInteractiveListReplyMessage(
  message: WhatsAppWebhookMessage,
): message is WhatsAppWebhookInteractiveListReplyMessage {
  return message.type === "interactive" &&
    message.interactive?.type === "list_reply" &&
    message.interactive.list_reply != null;
}

async function verifySignature(
  body: Uint8Array,
  signatureHeader: string,
  appSecret: string,
): Promise<boolean> {
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signatureHeader.trim());
  if (match == null) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bodyBuffer = Uint8Array.from(body);
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, bodyBuffer),
  );
  const received = hexToBytes(match[1]);
  if (received == null || received.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index++) {
    mismatch |= expected[index] ^ received[index];
  }
  return mismatch === 0;
}

function hexToBytes(value: string): Uint8Array | null {
  if (value.length % 2 !== 0) return null;

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    const byte = Number.parseInt(value.slice(index, index + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[index / 2] = byte;
  }
  return bytes;
}

function textResponse(
  body: string,
  status: number,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "text/plain; charset=utf-8");
  }
  return new Response(body, { status, headers: responseHeaders });
}
