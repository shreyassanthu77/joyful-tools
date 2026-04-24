/**
 * Builder helpers for authoring WhatsApp template messages.
 *
 * Import this submodule as a namespace when you want small free functions instead
 * of a singleton builder object.
 *
 * @example
 * ```ts
 * import * as template from "@joypack/whatsapp/template";
 *
 * const payload = template.message("order_update", "en_US", [
 *   template.body(
 *     template.text("Shreyas"),
 *     template.currency({
 *       fallback_value: "$19.99",
 *       code: "USD",
 *       amount_1000: 19990,
 *     }),
 *   ),
 *   template.quickReplyButton("0", template.payload("confirm-order")),
 * ]);
 * ```
 *
 * @module
 */

import type {
  WhatsAppTemplateBodyComponent,
  WhatsAppTemplateBodyParameter,
  WhatsAppTemplateButtonIndex,
  WhatsAppTemplateButtonTextParameter,
  WhatsAppTemplateCatalogActionParameter,
  WhatsAppTemplateCatalogButtonComponent,
  WhatsAppTemplateComponent,
  WhatsAppTemplateCurrencyParameter,
  WhatsAppTemplateDateTimeParameter,
  WhatsAppTemplateDocumentParameter,
  WhatsAppTemplateFlowActionParameter,
  WhatsAppTemplateFlowButtonComponent,
  WhatsAppTemplateHeaderComponent,
  WhatsAppTemplateHeaderParameter,
  WhatsAppTemplateImageParameter,
  WhatsAppTemplateLanguage,
  WhatsAppTemplateLocationParameter,
  WhatsAppTemplateMediaReference,
  WhatsAppTemplateMessageBody,
  WhatsAppTemplatePayloadParameter,
  WhatsAppTemplateQuickReplyButtonComponent,
  WhatsAppTemplateTextParameter,
  WhatsAppTemplateVideoParameter,
} from "./messages.ts";

export function language(
  code: string,
  policy: "deterministic" = "deterministic",
): WhatsAppTemplateLanguage {
  return { code, policy };
}

export function text(text: string): WhatsAppTemplateTextParameter {
  return { type: "text", text };
}

export function currency(
  currency: WhatsAppTemplateCurrencyParameter["currency"],
): WhatsAppTemplateCurrencyParameter {
  return { type: "currency", currency };
}

export function dateTime(
  dateTime: WhatsAppTemplateDateTimeParameter["date_time"],
): WhatsAppTemplateDateTimeParameter {
  return { type: "date_time", date_time: dateTime };
}

export function image(
  image: WhatsAppTemplateMediaReference,
): WhatsAppTemplateImageParameter {
  return { type: "image", image };
}

export function video(
  video: WhatsAppTemplateMediaReference,
): WhatsAppTemplateVideoParameter {
  return { type: "video", video };
}

export function document(
  document: WhatsAppTemplateDocumentParameter["document"],
): WhatsAppTemplateDocumentParameter {
  return { type: "document", document };
}

export function location(
  location: WhatsAppTemplateLocationParameter["location"],
): WhatsAppTemplateLocationParameter {
  return { type: "location", location };
}

export function payload(payload: string): WhatsAppTemplatePayloadParameter {
  return { type: "payload", payload };
}

export function buttonText(
  text: string | boolean,
): WhatsAppTemplateButtonTextParameter {
  return { type: "text", text };
}

export function catalogAction(
  thumbnailProductRetailerId: string,
): WhatsAppTemplateCatalogActionParameter {
  return {
    type: "action",
    action: {
      thumbnail_product_retailer_id: thumbnailProductRetailerId,
    },
  };
}

export function flowAction(
  flowToken: string,
  flowActionData?: Record<string, unknown>,
): WhatsAppTemplateFlowActionParameter {
  return {
    type: "action",
    action: {
      flow_token: flowToken,
      ...(flowActionData == null ? {} : { flow_action_data: flowActionData }),
    },
  };
}

export function header(
  ...parameters: WhatsAppTemplateHeaderParameter[]
): WhatsAppTemplateHeaderComponent {
  return { type: "header", parameters };
}

export function headerText(text: string): WhatsAppTemplateHeaderComponent {
  return { type: "header", parameters: [{ type: "text", text }] };
}

export function headerImage(
  image: WhatsAppTemplateMediaReference,
): WhatsAppTemplateHeaderComponent {
  return { type: "header", parameters: [{ type: "image", image }] };
}

export function headerVideo(
  video: WhatsAppTemplateMediaReference,
): WhatsAppTemplateHeaderComponent {
  return { type: "header", parameters: [{ type: "video", video }] };
}

export function headerDocument(
  document: WhatsAppTemplateDocumentParameter["document"],
): WhatsAppTemplateHeaderComponent {
  return {
    type: "header",
    parameters: [{ type: "document", document }],
  };
}

export function headerLocation(
  location: WhatsAppTemplateLocationParameter["location"],
): WhatsAppTemplateHeaderComponent {
  return {
    type: "header",
    parameters: [{ type: "location", location }],
  };
}

export function body(
  ...parameters: WhatsAppTemplateBodyParameter[]
): WhatsAppTemplateBodyComponent {
  return { type: "body", parameters };
}

export function bodyText(text: string): WhatsAppTemplateBodyComponent {
  return { type: "body", parameters: [{ type: "text", text }] };
}

export function bodyCurrency(
  currency: WhatsAppTemplateCurrencyParameter["currency"],
): WhatsAppTemplateBodyComponent {
  return { type: "body", parameters: [{ type: "currency", currency }] };
}

export function bodyDateTime(
  dateTime: WhatsAppTemplateDateTimeParameter["date_time"],
): WhatsAppTemplateBodyComponent {
  return {
    type: "body",
    parameters: [{ type: "date_time", date_time: dateTime }],
  };
}

export function quickReplyButton(
  index: WhatsAppTemplateButtonIndex,
  parameter:
    | WhatsAppTemplatePayloadParameter
    | WhatsAppTemplateButtonTextParameter,
): WhatsAppTemplateQuickReplyButtonComponent {
  return {
    type: "button",
    sub_type: "quick_reply",
    index,
    parameters: [parameter],
  };
}

export function catalogButton(
  index: WhatsAppTemplateButtonIndex,
  parameter: WhatsAppTemplateCatalogActionParameter,
): WhatsAppTemplateCatalogButtonComponent {
  return {
    type: "button",
    sub_type: "CATALOG",
    index,
    parameters: [parameter],
  };
}

export function flowButton(
  index: WhatsAppTemplateButtonIndex,
  parameter: WhatsAppTemplateFlowActionParameter,
): WhatsAppTemplateFlowButtonComponent {
  return {
    type: "button",
    sub_type: "flow",
    index,
    parameters: [parameter],
  };
}

export function message(
  name: string,
  languageOrCode: string | WhatsAppTemplateLanguage,
  components?: WhatsAppTemplateComponent[],
): WhatsAppTemplateMessageBody {
  return {
    name,
    language: typeof languageOrCode === "string"
      ? { code: languageOrCode }
      : languageOrCode,
    ...(components == null || components.length === 0 ? {} : { components }),
  };
}
