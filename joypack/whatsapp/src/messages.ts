import type { WhatsAppMediaReference } from "./media.ts";
import { HttpError, ParseError } from "@joyful/fetch";
import type { AsyncResult } from "@joyful/result";
import {
  type PromiseOr,
  toWhatsAppError,
  type WhatsAppClient,
  WhatsAppError,
  type WhatsAppRequestError,
} from "./client.ts";

/** Contact echoed back by Meta after a successful send request. */
export interface WhatsAppSendContact {
  input?: string;
  wa_id?: string;
  [key: string]: unknown;
}

/** Message record echoed back by Meta after a successful send request. */
export interface WhatsAppSendReceipt {
  id: string;
  message_status?: string;
  [key: string]: unknown;
}

/** Successful response body returned by `POST /{phone-number-id}/messages`. */
export interface WhatsAppSendResponse {
  messaging_product?: string;
  contacts?: WhatsAppSendContact[];
  messages?: WhatsAppSendReceipt[];
  [key: string]: unknown;
}

/** Optional reply context for outbound messages. */
export interface WhatsAppMessageContext {
  message_id: string;
}

/** Text body for an outbound WhatsApp text message. */
export interface WhatsAppTextMessageBody {
  body: string;
  preview_url?: boolean;
}

/** Template language selection for a template message. */
export interface WhatsAppTemplateLanguage {
  code: string;
  policy?: "deterministic";
}

/** Text template parameter. */
export interface WhatsAppTemplateTextParameter {
  type: "text";
  text: string;
}

/** Currency template parameter. */
export interface WhatsAppTemplateCurrencyParameter {
  type: "currency";
  currency: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
}

/** Date-time template parameter. */
export interface WhatsAppTemplateDateTimeParameter {
  type: "date_time";
  date_time: {
    fallback_value: string;
    day_of_week?: number;
    year?: number;
    month?: number;
    day_of_month?: number;
    hour?: number;
    minute?: number;
    calendar?: "GREGORIAN";
  };
}

/** Shared media reference accepted by WhatsApp template parameters. */
export type WhatsAppTemplateMediaReference = WhatsAppMediaReference;

/** Image template parameter. */
export interface WhatsAppTemplateImageParameter {
  type: "image";
  image: WhatsAppTemplateMediaReference;
}

/** Video template parameter. */
export interface WhatsAppTemplateVideoParameter {
  type: "video";
  video: WhatsAppTemplateMediaReference;
}

/** Document template parameter. */
export interface WhatsAppTemplateDocumentParameter {
  type: "document";
  document: WhatsAppTemplateMediaReference & {
    filename?: string;
  };
}

/** Location template parameter. */
export interface WhatsAppTemplateLocationParameter {
  type: "location";
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

/** Quick-reply button parameter. */
export interface WhatsAppTemplatePayloadParameter {
  type: "payload";
  payload: string;
}

/** Text button parameter shown in Meta's sample template button examples. */
export interface WhatsAppTemplateButtonTextParameter {
  type: "text";
  text: string | boolean;
}

/** Catalog button action parameter. */
export interface WhatsAppTemplateCatalogActionParameter {
  type: "action";
  action: {
    thumbnail_product_retailer_id: string;
  };
}

/** Flow button action parameter. */
export interface WhatsAppTemplateFlowActionParameter {
  type: "action";
  action: {
    flow_token: string;
    flow_action_data?: Record<string, unknown>;
  };
}

/** Header parameters supported by WhatsApp template messages. */
export type WhatsAppTemplateHeaderParameter =
  | WhatsAppTemplateTextParameter
  | WhatsAppTemplateImageParameter
  | WhatsAppTemplateVideoParameter
  | WhatsAppTemplateDocumentParameter
  | WhatsAppTemplateLocationParameter;

/** Body parameters supported by WhatsApp template messages. */
export type WhatsAppTemplateBodyParameter =
  | WhatsAppTemplateTextParameter
  | WhatsAppTemplateCurrencyParameter
  | WhatsAppTemplateDateTimeParameter;

/** Any supported WhatsApp template parameter. */
export type WhatsAppTemplateParameter =
  | WhatsAppTemplateHeaderParameter
  | WhatsAppTemplateBodyParameter
  | WhatsAppTemplatePayloadParameter
  | WhatsAppTemplateButtonTextParameter
  | WhatsAppTemplateCatalogActionParameter
  | WhatsAppTemplateFlowActionParameter;

/** Meta's official examples use both numeric strings and numbers here. */
export type WhatsAppTemplateButtonIndex = `${number}` | number;

/** Header component for a template message. */
export interface WhatsAppTemplateHeaderComponent {
  type: "header";
  parameters: WhatsAppTemplateHeaderParameter[];
}

/** Body component for a template message. */
export interface WhatsAppTemplateBodyComponent {
  type: "body";
  parameters: WhatsAppTemplateBodyParameter[];
}

/** Quick-reply template button component. */
export interface WhatsAppTemplateQuickReplyButtonComponent {
  type: "button";
  sub_type: "quick_reply";
  index: WhatsAppTemplateButtonIndex;
  parameters: [
    WhatsAppTemplatePayloadParameter | WhatsAppTemplateButtonTextParameter,
  ];
}

/** Catalog template button component. */
export interface WhatsAppTemplateCatalogButtonComponent {
  type: "button";
  sub_type: "CATALOG";
  index: WhatsAppTemplateButtonIndex;
  parameters: [WhatsAppTemplateCatalogActionParameter];
}

/** Flow template button component. */
export interface WhatsAppTemplateFlowButtonComponent {
  type: "button";
  sub_type: "flow";
  index: WhatsAppTemplateButtonIndex;
  parameters: [WhatsAppTemplateFlowActionParameter];
}

/** Supported template component blocks for outbound template messages. */
export type WhatsAppTemplateComponent =
  | WhatsAppTemplateHeaderComponent
  | WhatsAppTemplateBodyComponent
  | WhatsAppTemplateQuickReplyButtonComponent
  | WhatsAppTemplateCatalogButtonComponent
  | WhatsAppTemplateFlowButtonComponent;

/** Template payload for an outbound WhatsApp template message. */
export interface WhatsAppTemplateMessageBody {
  name: string;
  language: WhatsAppTemplateLanguage;
  components?: WhatsAppTemplateComponent[];
}

/** Reaction payload for an outbound WhatsApp reaction message. */
export interface WhatsAppReactionMessageBody {
  message_id: string;
  emoji: string;
}

/** Location payload for an outbound WhatsApp location message. */
export interface WhatsAppLocationMessageBody {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

/** Name block inside an outbound contact message. */
export interface WhatsAppContactName {
  formatted_name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  suffix?: string;
  prefix?: string;
}

/** Phone block inside an outbound contact message. */
export interface WhatsAppContactPhone {
  phone: string;
  type?: string;
  wa_id?: string;
}

/** Email block inside an outbound contact message. */
export interface WhatsAppContactEmail {
  email: string;
  type?: string;
}

/** URL block inside an outbound contact message. */
export interface WhatsAppContactUrl {
  url: string;
  type?: string;
}

/** Address block inside an outbound contact message. */
export interface WhatsAppContactAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  country_code?: string;
  type?: string;
}

/** Organization block inside an outbound contact message. */
export interface WhatsAppContactOrg {
  company?: string;
  department?: string;
  title?: string;
}

/** Birthday block inside an outbound contact message. */
export interface WhatsAppContact {
  name: WhatsAppContactName;
  birthday?: string;
  phones?: WhatsAppContactPhone[];
  emails?: WhatsAppContactEmail[];
  urls?: WhatsAppContactUrl[];
  addresses?: WhatsAppContactAddress[];
  org?: WhatsAppContactOrg;
}

/** Image payload for an outbound WhatsApp media message. */
export type WhatsAppImageMessageBody = WhatsAppMediaReference & {
  caption?: string;
};

/** Audio payload for an outbound WhatsApp media message. */
export type WhatsAppAudioMessageBody = WhatsAppMediaReference;

/** Video payload for an outbound WhatsApp media message. */
export type WhatsAppVideoMessageBody = WhatsAppMediaReference & {
  caption?: string;
};

/** Document payload for an outbound WhatsApp media message. */
export type WhatsAppDocumentMessageBody = WhatsAppMediaReference & {
  caption?: string;
  filename?: string;
};

/** Sticker payload for an outbound WhatsApp media message. */
export type WhatsAppStickerMessageBody = WhatsAppMediaReference;

/** Body text for an interactive message. */
export interface WhatsAppInteractiveBody {
  text: string;
}

/** Footer text for an interactive message. */
export interface WhatsAppInteractiveFooter {
  text: string;
}

/** Header text for an interactive message. */
export interface WhatsAppInteractiveTextHeader {
  type: "text";
  text: string;
}

/** Reply button option for an interactive button message. */
export interface WhatsAppInteractiveReplyButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

/** Reply-button interactive message payload. */
export interface WhatsAppInteractiveButtonMessage {
  type: "button";
  body: WhatsAppInteractiveBody;
  action: {
    buttons: [
      WhatsAppInteractiveReplyButton,
      ...WhatsAppInteractiveReplyButton[],
    ];
  };
  footer?: WhatsAppInteractiveFooter;
  header?: WhatsAppInteractiveTextHeader;
}

/** Row option inside an interactive list section. */
export interface WhatsAppInteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

/** Section inside an interactive list message. */
export interface WhatsAppInteractiveListSection {
  title?: string;
  rows: [WhatsAppInteractiveListRow, ...WhatsAppInteractiveListRow[]];
}

/** List interactive message payload. */
export interface WhatsAppInteractiveListMessage {
  type: "list";
  body: WhatsAppInteractiveBody;
  action: {
    button: string;
    sections: [
      WhatsAppInteractiveListSection,
      ...WhatsAppInteractiveListSection[],
    ];
  };
  footer?: WhatsAppInteractiveFooter;
  header?: WhatsAppInteractiveTextHeader;
}

/** Flow launch payload for an interactive flow message. */
export interface WhatsAppInteractiveFlowParametersBase {
  flow_message_version: "3";
  flow_token: string;
  flow_cta: string;
  flow_action: "navigate";
  flow_action_payload?: {
    screen?: string;
    data?: Record<string, unknown>;
  };
}

/** Flow launch payload addressed by flow id. */
export interface WhatsAppInteractiveFlowParametersById
  extends WhatsAppInteractiveFlowParametersBase {
  flow_id: string;
  flow_name?: never;
}

/** Flow launch payload addressed by flow name. */
export interface WhatsAppInteractiveFlowParametersByName
  extends WhatsAppInteractiveFlowParametersBase {
  flow_name: string;
  flow_id?: never;
}

/** Flow interactive message payload. */
export interface WhatsAppInteractiveFlowMessage {
  type: "flow";
  body: WhatsAppInteractiveBody;
  action: {
    name: "flow";
    parameters:
      | WhatsAppInteractiveFlowParametersById
      | WhatsAppInteractiveFlowParametersByName;
  };
  footer?: WhatsAppInteractiveFooter;
  header?: WhatsAppInteractiveTextHeader;
}

/** Interactive message payloads supported by `send()`. */
export type WhatsAppInteractiveMessage =
  | WhatsAppInteractiveButtonMessage
  | WhatsAppInteractiveListMessage
  | WhatsAppInteractiveFlowMessage;

/** Common fields accepted by outbound WhatsApp messages. */
export interface WhatsAppSendBase {
  phoneNumberId: string;
  to: string;
  recipient_type?: "individual";
  context?: WhatsAppMessageContext;
  biz_opaque_callback_data?: string;
  signal?: AbortSignal;
}

/** Supported outbound WhatsApp message payloads for {@link WhatsAppMessagesApi.send}. */
export type WhatsAppSendOptions =
  | (WhatsAppSendBase & {
    type: "text";
    text: WhatsAppTextMessageBody;
  })
  | (WhatsAppSendBase & {
    type: "location";
    location: WhatsAppLocationMessageBody;
  })
  | (WhatsAppSendBase & {
    type: "contacts";
    contacts: [WhatsAppContact, ...WhatsAppContact[]];
  })
  | (WhatsAppSendBase & {
    type: "image";
    image: WhatsAppImageMessageBody;
  })
  | (WhatsAppSendBase & {
    type: "audio";
    audio: WhatsAppAudioMessageBody;
  })
  | (WhatsAppSendBase & {
    type: "video";
    video: WhatsAppVideoMessageBody;
  })
  | (WhatsAppSendBase & {
    type: "document";
    document: WhatsAppDocumentMessageBody;
  })
  | (WhatsAppSendBase & {
    type: "sticker";
    sticker: WhatsAppStickerMessageBody;
  })
  | (WhatsAppSendBase & {
    type: "interactive";
    interactive: WhatsAppInteractiveMessage;
  })
  | (WhatsAppSendBase & {
    type: "template";
    template: WhatsAppTemplateMessageBody;
  })
  | (WhatsAppSendBase & {
    type: "reaction";
    reaction: WhatsAppReactionMessageBody;
  });

/** Successful response body returned by mark-as-read requests. */
export interface WhatsAppMarkAsReadResponse {
  success: boolean;
  [key: string]: unknown;
}

/** Options for `whatsapp.messages.markAsRead(...)`. */
export interface WhatsAppMarkAsReadOptions {
  phoneNumberId: string;
  messageId: string;
  signal?: AbortSignal;
}

/** Message helper namespace attached to {@link WhatsAppClient.messages}. */
export class WhatsAppMessagesApi {
  readonly #client: WhatsAppClient;

  constructor(client: WhatsAppClient) {
    this.#client = client;
  }

  send(
    options: WhatsAppSendOptions,
  ): AsyncResult<WhatsAppSendResponse, WhatsAppRequestError> {
    const { phoneNumberId, signal, ...message } = options;

    return this.#client.request(`${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        ...message,
      }),
      signal,
    }).json<WhatsAppSendResponse>().mapErr(
      (error): PromiseOr<WhatsAppRequestError> => {
        if (error instanceof HttpError) return toWhatsAppError(error);
        if (error instanceof ParseError) {
          return new WhatsAppError({
            message: "WhatsApp API returned an invalid JSON response",
            cause: error,
          });
        }
        return error;
      },
    );
  }

  markAsRead(
    options: WhatsAppMarkAsReadOptions,
  ): AsyncResult<WhatsAppMarkAsReadResponse, WhatsAppRequestError> {
    return this.#client.request(`${options.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: options.messageId,
      }),
      signal: options.signal,
    }).json<WhatsAppMarkAsReadResponse>().mapErr(
      (error): PromiseOr<WhatsAppRequestError> => {
        if (error instanceof HttpError) return toWhatsAppError(error);
        if (error instanceof ParseError) {
          return new WhatsAppError({
            message: "WhatsApp API returned an invalid JSON response",
            cause: error,
          });
        }
        return error;
      },
    );
  }
}
