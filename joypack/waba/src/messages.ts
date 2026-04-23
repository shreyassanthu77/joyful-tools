/** Contact echoed back by Meta after a successful send request. */
export interface WabaSendContact {
  input?: string;
  wa_id?: string;
  [key: string]: unknown;
}

/** Message record echoed back by Meta after a successful send request. */
export interface WabaSendReceipt {
  id: string;
  message_status?: string;
  [key: string]: unknown;
}

/** Successful response body returned by `POST /{phone-number-id}/messages`. */
export interface WabaSendResponse {
  messaging_product?: string;
  contacts?: WabaSendContact[];
  messages?: WabaSendReceipt[];
  [key: string]: unknown;
}

/** Optional reply context for outbound messages. */
export interface WabaMessageContext {
  message_id: string;
}

/** Text body for an outbound WhatsApp text message. */
export interface WabaTextMessageBody {
  body: string;
  preview_url?: boolean;
}

/** Template language selection for a template message. */
export interface WabaTemplateLanguage {
  code: string;
  policy?: "deterministic";
}

/** Text template parameter. */
export interface WabaTemplateTextParameter {
  type: "text";
  text: string;
}

/** Currency template parameter. */
export interface WabaTemplateCurrencyParameter {
  type: "currency";
  currency: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
}

/** Date-time template parameter. */
export interface WabaTemplateDateTimeParameter {
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
export type WabaTemplateMediaReference = { id: string } | { link: string };

/** Image template parameter. */
export interface WabaTemplateImageParameter {
  type: "image";
  image: WabaTemplateMediaReference;
}

/** Video template parameter. */
export interface WabaTemplateVideoParameter {
  type: "video";
  video: WabaTemplateMediaReference;
}

/** Document template parameter. */
export interface WabaTemplateDocumentParameter {
  type: "document";
  document: WabaTemplateMediaReference & {
    filename?: string;
  };
}

/** Location template parameter. */
export interface WabaTemplateLocationParameter {
  type: "location";
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

/** Quick-reply button parameter. */
export interface WabaTemplatePayloadParameter {
  type: "payload";
  payload: string;
}

/** Text button parameter shown in Meta's sample template button examples. */
export interface WabaTemplateButtonTextParameter {
  type: "text";
  text: string | boolean;
}

/** Catalog button action parameter. */
export interface WabaTemplateCatalogActionParameter {
  type: "action";
  action: {
    thumbnail_product_retailer_id: string;
  };
}

/** Flow button action parameter. */
export interface WabaTemplateFlowActionParameter {
  type: "action";
  action: {
    flow_token: string;
    flow_action_data?: Record<string, unknown>;
  };
}

/** Header parameters supported by WhatsApp template messages. */
export type WabaTemplateHeaderParameter =
  | WabaTemplateTextParameter
  | WabaTemplateImageParameter
  | WabaTemplateVideoParameter
  | WabaTemplateDocumentParameter
  | WabaTemplateLocationParameter;

/** Body parameters supported by WhatsApp template messages. */
export type WabaTemplateBodyParameter =
  | WabaTemplateTextParameter
  | WabaTemplateCurrencyParameter
  | WabaTemplateDateTimeParameter;

/** Any supported WhatsApp template parameter. */
export type WabaTemplateParameter =
  | WabaTemplateHeaderParameter
  | WabaTemplateBodyParameter
  | WabaTemplatePayloadParameter
  | WabaTemplateButtonTextParameter
  | WabaTemplateCatalogActionParameter
  | WabaTemplateFlowActionParameter;

/** Meta's official examples use both numeric strings and numbers here. */
export type WabaTemplateButtonIndex = `${number}` | number;

/** Header component for a template message. */
export interface WabaTemplateHeaderComponent {
  type: "header";
  parameters: WabaTemplateHeaderParameter[];
}

/** Body component for a template message. */
export interface WabaTemplateBodyComponent {
  type: "body";
  parameters: WabaTemplateBodyParameter[];
}

/** Quick-reply template button component. */
export interface WabaTemplateQuickReplyButtonComponent {
  type: "button";
  sub_type: "quick_reply";
  index: WabaTemplateButtonIndex;
  parameters: [WabaTemplatePayloadParameter | WabaTemplateButtonTextParameter];
}

/** Catalog template button component. */
export interface WabaTemplateCatalogButtonComponent {
  type: "button";
  sub_type: "CATALOG";
  index: WabaTemplateButtonIndex;
  parameters: [WabaTemplateCatalogActionParameter];
}

/** Flow template button component. */
export interface WabaTemplateFlowButtonComponent {
  type: "button";
  sub_type: "flow";
  index: WabaTemplateButtonIndex;
  parameters: [WabaTemplateFlowActionParameter];
}

/** Supported template component blocks for outbound template messages. */
export type WabaTemplateComponent =
  | WabaTemplateHeaderComponent
  | WabaTemplateBodyComponent
  | WabaTemplateQuickReplyButtonComponent
  | WabaTemplateCatalogButtonComponent
  | WabaTemplateFlowButtonComponent;

/** Template payload for an outbound WhatsApp template message. */
export interface WabaTemplateMessageBody {
  name: string;
  language: WabaTemplateLanguage;
  components?: WabaTemplateComponent[];
}

/** Reaction payload for an outbound WhatsApp reaction message. */
export interface WabaReactionMessageBody {
  message_id: string;
  emoji: string;
}

/** Common fields accepted by outbound WhatsApp messages. */
export interface WabaSendBase {
  phoneNumberId: string;
  to: string;
  recipient_type?: "individual";
  context?: WabaMessageContext;
  biz_opaque_callback_data?: string;
  signal?: AbortSignal;
}

/** Supported outbound WhatsApp message payloads for {@link WabaClient.send}. */
export type WabaSendOptions =
  | (WabaSendBase & {
    type: "text";
    text: WabaTextMessageBody;
  })
  | (WabaSendBase & {
    type: "template";
    template: WabaTemplateMessageBody;
  })
  | (WabaSendBase & {
    type: "reaction";
    reaction: WabaReactionMessageBody;
  });
