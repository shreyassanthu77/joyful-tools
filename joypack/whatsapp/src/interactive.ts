/**
 * Builder helpers for authoring WhatsApp interactive messages.
 *
 * Import this submodule as a namespace when you want small free functions for
 * reply buttons, lists, and flows.
 *
 * @example
 * ```ts
 * import * as interactive from "@joypack/whatsapp/interactive";
 *
 * const message = interactive.button(
 *   "Pick one:",
 *   [
 *     interactive.replyButton("plan_basic", "Basic"),
 *     interactive.replyButton("plan_pro", "Pro"),
 *   ],
 *   { footer: "You can change this later" },
 * );
 * ```
 *
 * @module
 */

import type {
  WhatsAppInteractiveBody,
  WhatsAppInteractiveButtonMessage,
  WhatsAppInteractiveFlowMessage,
  WhatsAppInteractiveFlowParametersById,
  WhatsAppInteractiveFlowParametersByName,
  WhatsAppInteractiveFooter,
  WhatsAppInteractiveListMessage,
  WhatsAppInteractiveListRow,
  WhatsAppInteractiveListSection,
  WhatsAppInteractiveReplyButton,
  WhatsAppInteractiveTextHeader,
} from "./messages.ts";

export function body(text: string): WhatsAppInteractiveBody {
  return { text };
}

export function footer(text: string): WhatsAppInteractiveFooter {
  return { text };
}

export function headerText(text: string): WhatsAppInteractiveTextHeader {
  return { type: "text", text };
}

export function replyButton(
  id: string,
  title: string,
): WhatsAppInteractiveReplyButton {
  return {
    type: "reply",
    reply: { id, title },
  };
}

export function listRow(
  id: string,
  title: string,
  description?: string,
): WhatsAppInteractiveListRow {
  return {
    id,
    title,
    ...(description == null ? {} : { description }),
  };
}

export function listSection(
  rows: [WhatsAppInteractiveListRow, ...WhatsAppInteractiveListRow[]],
  title?: string,
): WhatsAppInteractiveListSection {
  return {
    ...(title == null ? {} : { title }),
    rows,
  };
}

export function flowById(
  flowId: string,
  flowToken: string,
  flowCta: string,
  options?: {
    flowActionPayload?: {
      screen?: string;
      data?: Record<string, unknown>;
    };
  },
): WhatsAppInteractiveFlowParametersById {
  return {
    flow_message_version: "3",
    flow_id: flowId,
    flow_token: flowToken,
    flow_cta: flowCta,
    flow_action: "navigate",
    ...(options?.flowActionPayload == null
      ? {}
      : { flow_action_payload: options.flowActionPayload }),
  };
}

export function flowByName(
  flowName: string,
  flowToken: string,
  flowCta: string,
  options?: {
    flowActionPayload?: {
      screen?: string;
      data?: Record<string, unknown>;
    };
  },
): WhatsAppInteractiveFlowParametersByName {
  return {
    flow_message_version: "3",
    flow_name: flowName,
    flow_token: flowToken,
    flow_cta: flowCta,
    flow_action: "navigate",
    ...(options?.flowActionPayload == null
      ? {}
      : { flow_action_payload: options.flowActionPayload }),
  };
}

export function button(
  bodyOrText: string | WhatsAppInteractiveBody,
  buttons: [
    WhatsAppInteractiveReplyButton,
    ...WhatsAppInteractiveReplyButton[],
  ],
  options?: {
    footer?: string | WhatsAppInteractiveFooter;
    header?: string | WhatsAppInteractiveTextHeader;
  },
): WhatsAppInteractiveButtonMessage {
  return {
    type: "button",
    body: typeof bodyOrText === "string" ? { text: bodyOrText } : bodyOrText,
    action: { buttons },
    ...(options?.footer == null ? {} : {
      footer: typeof options.footer === "string"
        ? { text: options.footer }
        : options.footer,
    }),
    ...(options?.header == null ? {} : {
      header: typeof options.header === "string"
        ? { type: "text", text: options.header }
        : options.header,
    }),
  };
}

export function list(
  bodyOrText: string | WhatsAppInteractiveBody,
  button: string,
  sections: [
    WhatsAppInteractiveListSection,
    ...WhatsAppInteractiveListSection[],
  ],
  options?: {
    footer?: string | WhatsAppInteractiveFooter;
    header?: string | WhatsAppInteractiveTextHeader;
  },
): WhatsAppInteractiveListMessage {
  return {
    type: "list",
    body: typeof bodyOrText === "string" ? { text: bodyOrText } : bodyOrText,
    action: { button, sections },
    ...(options?.footer == null ? {} : {
      footer: typeof options.footer === "string"
        ? { text: options.footer }
        : options.footer,
    }),
    ...(options?.header == null ? {} : {
      header: typeof options.header === "string"
        ? { type: "text", text: options.header }
        : options.header,
    }),
  };
}

export function flow(
  bodyOrText: string | WhatsAppInteractiveBody,
  parameters:
    | WhatsAppInteractiveFlowParametersById
    | WhatsAppInteractiveFlowParametersByName,
  options?: {
    footer?: string | WhatsAppInteractiveFooter;
    header?: string | WhatsAppInteractiveTextHeader;
  },
): WhatsAppInteractiveFlowMessage {
  return {
    type: "flow",
    body: typeof bodyOrText === "string" ? { text: bodyOrText } : bodyOrText,
    action: {
      name: "flow",
      parameters,
    },
    ...(options?.footer == null ? {} : {
      footer: typeof options.footer === "string"
        ? { text: options.footer }
        : options.footer,
    }),
    ...(options?.header == null ? {} : {
      header: typeof options.header === "string"
        ? { type: "text", text: options.header }
        : options.header,
    }),
  };
}
