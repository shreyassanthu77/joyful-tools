# @joypack/whatsapp

WhatsApp Business API tooling.

Built on top of `@joyful/fetch` and `@joyful/result`.

The package does two things:

- sends outbound WhatsApp Cloud API messages with `createWhatsAppClient()`
- handles inbound webhook verification and delivery with `handleWebhooks()`

## Installation

```bash
# npm
npm install @joypack/whatsapp

# pnpm
pnpm add @joypack/whatsapp

# bun
bun add @joypack/whatsapp

# npm (from JSR)
npx jsr add @joypack/whatsapp

# pnpm 10.9+ (from JSR)
pnpm add jsr:@joypack/whatsapp

# yarn 4.9+ (from JSR)
yarn add jsr:@joypack/whatsapp

# deno
deno add jsr:@joypack/whatsapp
```

## Send messages

```ts
import { createWhatsAppClient } from "@joypack/whatsapp";

const whatsapp = createWhatsAppClient({
  accessToken: Deno.env.get("WHATSAPP_ACCESS_TOKEN")!,
  apiVersion: "v22.0",
});

const sent = await whatsapp.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "text",
  text: { body: "hello" },
});

if (sent.isErr()) {
  console.error(sent.error._tag, sent.error.message);
}
```

`send()` is a thin convenience for `POST /{phone-number-id}/messages`. It adds
`messaging_product: "whatsapp"` for you and returns an
`AsyncResult<WhatsAppSendResponse, WhatsAppRequestError>`.

Inside the user-initiated 24-hour window, you can also send arbitrary
interactive messages with `type: "interactive"`, including reply buttons, lists,
and flows:

```ts
await whatsapp.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "interactive",
  interactive: {
    type: "button",
    body: {
      text: "Pick one:",
    },
    footer: {
      text: "You can change this later",
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: "plan_basic",
            title: "Basic",
          },
        },
        {
          type: "reply",
          reply: {
            id: "plan_pro",
            title: "Pro",
          },
        },
      ],
    },
  },
});
```

```ts
await whatsapp.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "interactive",
  interactive: {
    type: "list",
    header: { type: "text", text: "Choose a plan" },
    body: { text: "Available options:" },
    footer: { text: "More plans on the web" },
    action: {
      button: "Browse",
      sections: [
        {
          title: "Plans",
          rows: [
            {
              id: "plan_basic",
              title: "Basic",
              description: "Starter tier",
            },
          ],
        },
      ],
    },
  },
});
```

```ts
await whatsapp.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "interactive",
  interactive: {
    type: "flow",
    header: { type: "text", text: "Complete signup" },
    body: { text: "Open the flow to continue." },
    footer: { text: "Takes less than a minute" },
    action: {
      name: "flow",
      parameters: {
        flow_message_version: "3",
        flow_id: "123456789012345",
        flow_cta: "Open Flow!",
        flow_token: "signup-session-token",
        flow_action: "navigate",
        flow_action_payload: {
          screen: "WELCOME",
          data: {
            userId: "usr_123",
          },
        },
      },
    },
  },
});
```

Template messages are typed to match Meta's official message examples more
closely, including `header`, `body`, `quick_reply`, `CATALOG`, and `flow` button
components:

```ts
await whatsapp.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "template",
  template: {
    name: "order_update",
    language: { code: "en_US" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Shreyas" },
          {
            type: "currency",
            currency: {
              fallback_value: "$19.99",
              code: "USD",
              amount_1000: 19990,
            },
          },
        ],
      },
      {
        type: "button",
        sub_type: "quick_reply",
        index: "0",
        parameters: [{ type: "payload", payload: "confirm-order" }],
      },
      {
        type: "button",
        sub_type: "CATALOG",
        index: 1,
        parameters: [
          {
            type: "action",
            action: {
              thumbnail_product_retailer_id: "2lc20305pt",
            },
          },
        ],
      },
    ],
  },
});
```

## Request API

If you need another Graph endpoint or a payload `send()` does not cover yet, use
`request<T>()` directly:

```ts
const profile = await whatsapp.request<{ verified_name?: string }>({
  path: "/1234567890/whatsapp_business_profile",
  searchParams: { fields: "verified_name" },
});
```

`request<T>()` returns an `AsyncResult<T, WhatsAppRequestError>` and parses the
successful response body as JSON for you.

WhatsApp failures are normalized to `WhatsAppError`, which carries Meta's parsed
error fields like `status`, `type`, `code`, `subcode`, `fbtraceId`, `details`,
and `body` when available.

## Webhooks

```ts
import { handleWebhooks } from "@joypack/whatsapp";

export const webhook = handleWebhooks(
  async ({ event }) => {
    if (event.kind === "message" && event.messageKind === "text") {
      console.log(event.message.text.body, event.contacts[0]?.wa_id);
    }

    if (
      event.kind === "message" &&
      event.messageKind === "interactive_button_reply"
    ) {
      console.log(event.message.interactive.button_reply.id);
    }
  },
  {
    verifyToken: Deno.env.get("WHATSAPP_VERIFY_TOKEN")!,
    appSecret: Deno.env.get("WHATSAPP_APP_SECRET"),
  },
);
```

The returned handler accepts both requests Meta sends to the same route:

- `GET` for webhook verification
- `POST` for webhook delivery

When `appSecret` is set, the handler also validates `X-Hub-Signature-256`.

Each incoming message or status update is flattened into its own normalized
event before your callback runs. Message events are lightly classified as
`text`, `interactive_button_reply`, `interactive_list_reply`, or `unknown`
through `event.messageKind`, while the raw payload types stay permissive so new
upstream fields still flow through without a package update. If you want that
normalization without the HTTP handler, use `webhookEvents(payload)` directly.
