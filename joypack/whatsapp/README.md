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

## Quick Start

`handleWebhooks()` returns a plain fetch-style handler. That means you can use
it in any runtime or framework that speaks the Web Fetch API. The example below
uses Hono for routing, but the webhook handler itself is not Hono-specific.

The example below mounts a single `/webhook` route for Meta verification and
delivery, then replies to `/start` with buttons and follows up on button and
list replies.

```ts
import { Hono } from "hono";
import { createWhatsAppClient, handleWebhooks } from "@joypack/whatsapp";

const env = {
  WHATSAPP_ACCESS_TOKEN: "<access-token>",
  WHATSAPP_PHONE_NUMBER_ID: "<phone-number-id>",
  WHATSAPP_VERIFY_TOKEN: "<verify-token>",
  WHATSAPP_APP_SECRET: "<app-secret>",
};

const app = new Hono();
const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

const whatsapp = createWhatsAppClient({
  accessToken: env.WHATSAPP_ACCESS_TOKEN,
});

const webhookHandler = handleWebhooks(
  async ({ event }) => {
    switch (event.kind) {
      case "message": {
        const from = event.contacts[0]?.wa_id;
        if (from == null) return;

        switch (event.messageKind) {
          case "text": {
            const { body } = event.message.text;
            if (body !== "/start") return;

            await whatsapp.send({
              type: "interactive",
              phoneNumberId,
              to: from,
              interactive: {
                type: "button",
                body: {
                  text: "What is your favorite color?",
                },
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: { id: "color-red", title: "Red" },
                    },
                    {
                      type: "reply",
                      reply: { id: "color-blue", title: "Blue" },
                    },
                    {
                      type: "reply",
                      reply: { id: "color-other", title: "Other" },
                    },
                  ],
                },
              },
            });
            break;
          }
          case "interactive_button_reply": {
            const { id, title } = event.message.interactive.button_reply;
            if (!id?.startsWith("color-")) return;

            if (id !== "color-other") {
              await whatsapp.send({
                type: "text",
                phoneNumberId,
                to: from,
                text: {
                  body: `You selected ${title}`,
                },
              });
              return;
            }

            await whatsapp.send({
              type: "interactive",
              phoneNumberId,
              to: from,
              interactive: {
                type: "list",
                body: {
                  text: "Alright, pick one of the following",
                },
                action: {
                  button: "View colors",
                  sections: [
                    {
                      title: "More color options",
                      rows: [
                        { id: "color-red", title: "Red" },
                        { id: "color-blue", title: "Blue" },
                        { id: "color-green", title: "Green" },
                        { id: "color-yellow", title: "Yellow" },
                        { id: "color-orange", title: "Orange" },
                        { id: "color-purple", title: "Purple" },
                      ],
                    },
                  ],
                },
              },
            });
            break;
          }
          case "interactive_list_reply": {
            const { id, title } = event.message.interactive.list_reply;
            if (!id?.startsWith("color-")) return;

            await whatsapp.send({
              type: "text",
              phoneNumberId,
              to: from,
              text: {
                body: `You selected ${title}`,
              },
            });
            break;
          }
          default: {
            console.log("Unhandled message", event.message);
          }
        }

        break;
      }
      case "status": {
        console.log("status", event.status.status, event.status.id);
        break;
      }
      case "unknown": {
        console.log("unknown event", event.value);
        break;
      }
    }
  },
  {
    verifyToken: env.WHATSAPP_VERIFY_TOKEN,
    appSecret: env.WHATSAPP_APP_SECRET,
  },
);

app.on(["GET", "POST"], "/webhook", (c) => webhookHandler(c.req.raw));

app.post("/send-test", async (c) => {
  const sent = await whatsapp.send({
    phoneNumberId,
    to: "15551234567",
    type: "text",
    text: { body: "hello from hono" },
  });

  if (sent.isErr()) {
    return c.json(
      {
        error: sent.error.message,
        tag: sent.error._tag,
      },
      500,
    );
  }

  return c.json(sent.value, 200);
});

export default app;
```

If you are not using Hono, the integration point is the same: pass your incoming
`Request` to `webhookHandler(...)` and return the resulting `Response`.

Quick start flow:

1. Create a WhatsApp client with `createWhatsAppClient()`.
2. Build one fetch-style webhook handler with `handleWebhooks(...)`.
3. Mount that handler on `GET` and `POST` for the same `/webhook` route.
4. Point your Meta webhook configuration at that public route.
5. Send a WhatsApp message containing `/start` to trigger the interactive flow.

## Send messages

```ts
import { createWhatsAppClient } from "@joypack/whatsapp";

const env = {
  WHATSAPP_ACCESS_TOKEN: "<access-token>",
};

const whatsapp = createWhatsAppClient({
  accessToken: env.WHATSAPP_ACCESS_TOKEN,
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

const env = {
  WHATSAPP_VERIFY_TOKEN: "<verify-token>",
  WHATSAPP_APP_SECRET: "<app-secret>",
};

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
    verifyToken: env.WHATSAPP_VERIFY_TOKEN,
    appSecret: env.WHATSAPP_APP_SECRET,
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
