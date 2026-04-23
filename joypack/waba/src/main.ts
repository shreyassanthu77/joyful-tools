/**
 * WhatsApp Business API utilities built on top of `@joyful/fetch` and
 * `@joyful/result`.
 *
 * The package is split into two small pieces:
 * - {@link createWabaClient} for outbound WhatsApp Cloud API requests
 * - {@link handleWebhooks} and {@link webhookEvents} for inbound webhook
 *   verification and event handling
 *
 * The request side stays intentionally small. {@link WabaClient.request}
 * returns parsed JSON directly, while webhook helpers handle Meta's verification
 * and delivery requests.
 *
 * @example Send a WhatsApp message
 * ```ts
 * import { createWabaClient } from "@joypack/waba";
 *
 * const waba = createWabaClient({
 *   accessToken: Deno.env.get("WHATSAPP_ACCESS_TOKEN")!,
 *   apiVersion: "v22.0",
 * });
 *
 * const result = await waba.request<{ messages: Array<{ id: string }> }>({
 *   path: "/1234567890/messages",
 *   json: {
 *     messaging_product: "whatsapp",
 *     to: "15551234567",
 *     type: "text",
 *     text: { body: "hello from joyful-tools" },
 *   },
 * });
 *
 * if (result.isOk()) {
 *   console.log(result.value.messages[0]?.id);
 * } else {
 *   console.error(result.error._tag, result.error.message);
 * }
 * ```
 *
 * @example Handle a webhook route
 * ```ts
 * import { handleWebhooks } from "@joypack/waba";
 *
 * export const webhook = handleWebhooks(
 *   async ({ event }) => {
 *     if (event.kind !== "message") return;
 *     console.log(event.message.id, event.contacts[0]?.wa_id);
 *   },
 *   {
 *     verifyToken: Deno.env.get("WHATSAPP_VERIFY_TOKEN")!,
 *     appSecret: Deno.env.get("WHATSAPP_APP_SECRET"),
 *   },
 * );
 * ```
 *
 * @module
 */

export * from "./client.ts";
export * from "./webhooks.ts";
