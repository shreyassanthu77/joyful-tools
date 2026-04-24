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

            await whatsapp.messages.send({
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
              await whatsapp.messages.send({
                type: "text",
                phoneNumberId,
                to: from,
                text: {
                  body: `You selected ${title}`,
                },
              });
              return;
            }

            await whatsapp.messages.send({
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

            await whatsapp.messages.send({
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
        switch (event.statusKind) {
          case "sent":
          case "delivered":
          case "read":
          case "failed": {
            console.log(
              event.statusKind,
              event.status.id,
              event.status.recipient_id,
            );
            break;
          }
          default: {
            console.log("unknown status", event.status.status, event.status.id);
          }
        }
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
  const sent = await whatsapp.messages.send({
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

const sent = await whatsapp.messages.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "text",
  text: { body: "hello" },
});

if (sent.isErr()) {
  console.error(sent.error._tag, sent.error.message);
}
```

`messages.send()` is a thin convenience for `POST /{phone-number-id}/messages`.
It adds `messaging_product: "whatsapp"` for you and returns an
`AsyncResult<WhatsAppSendResponse, WhatsAppRequestError>`.

Mark a previously received message as read:

```ts
await whatsapp.messages.markAsRead({
  phoneNumberId: "1234567890",
  messageId: "wamid.HBgLN...",
});
```

For raw authenticated Graph API calls, use `request(path, init)`:

```ts
const profile = await whatsapp.request(
  "/1234567890/whatsapp_business_profile?fields=verified_name",
);
```

For media lifecycle operations, use the separate `whatsapp.media` namespace:

```ts
const uploaded = await whatsapp.media.upload({
  phoneNumberId: "1234567890",
  file: new File(["hello"], "welcome.txt", { type: "text/plain" }),
});

if (uploaded.isOk()) {
  await whatsapp.messages.send({
    phoneNumberId: "1234567890",
    to: "15551234567",
    type: "document",
    document: {
      id: uploaded.value.id,
      filename: "welcome.txt",
      caption: "Uploaded through the media API",
    },
  });
}
```

```ts
const downloaded = await whatsapp.media.download({
  mediaId: "1037543291543634",
});

if (downloaded.isOk()) {
  const file = await downloaded.value.response.blob();
  console.log(downloaded.value.media.mime_type, file.isOk());
}
```

Outbound media messages are also supported directly through `messages.send()`:

```ts
await whatsapp.messages.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "image",
  image: {
    link: "https://example.com/banner.jpg",
    caption: "Launch day banner",
  },
});
```

Location and contact messages are supported too:

```ts
await whatsapp.messages.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "location",
  location: {
    latitude: 12.9716,
    longitude: 77.5946,
    name: "Bengaluru Office",
    address: "MG Road, Bengaluru",
  },
});
```

```ts
await whatsapp.messages.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "contacts",
  contacts: [
    {
      name: { formatted_name: "Ada Lovelace", first_name: "Ada" },
      phones: [{ phone: "+15551234567", type: "CELL" }],
      emails: [{ email: "ada@example.com", type: "WORK" }],
    },
  ],
});
```

Inside the user-initiated 24-hour window, you can also send arbitrary
interactive messages with `type: "interactive"`, including reply buttons, lists,
and flows:

```ts
import * as interactive from "@joypack/whatsapp/interactive";

await whatsapp.messages.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "interactive",
  interactive: interactive.button(
    "Pick one:",
    [
      interactive.replyButton("plan_basic", "Basic"),
      interactive.replyButton("plan_pro", "Pro"),
    ],
    {
      footer: "You can change this later",
    },
  ),
});
```

```ts
await whatsapp.messages.send({
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
await whatsapp.messages.send({
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
await whatsapp.messages.send({
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

The `@joypack/whatsapp/interactive` submodule also includes `listRow(...)`,
`listSection(...)`, `list(...)`, `flowById(...)`, `flowByName(...)`, and
`flow(...)` helpers when you want the same typed builder style for list and flow
messages.

Template messages are typed to match Meta's official message examples more
closely, including `header`, `body`, `quick_reply`, `CATALOG`, and `flow` button
components:

```ts
import * as template from "@joypack/whatsapp/template";

await whatsapp.messages.send({
  phoneNumberId: "1234567890",
  to: "15551234567",
  type: "template",
  template: template.message("order_update", "en_US", [
    template.body(
      template.text("Shreyas"),
      template.currency({
        fallback_value: "$19.99",
        code: "USD",
        amount_1000: 19990,
      }),
    ),
    template.quickReplyButton("0", template.payload("confirm-order")),
    template.catalogButton(1, template.catalogAction("2lc20305pt")),
  ]),
});
```

You can also use the higher-level shortcuts like `template.bodyText(...)`,
`template.headerImage(...)`, and `template.flowButton(...)` when you only need a
single parameter block.

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
`text`, `image`, `audio`, `video`, `document`, `sticker`, `location`,
`contacts`, `interactive_button_reply`, `interactive_list_reply`, or `unknown`
through `event.messageKind`, while the raw payload types stay permissive so new
upstream fields still flow through without a package update. Legacy raw `button`
webhook messages are normalized into the same `interactive_button_reply` shape,
so `event.message.interactive.button_reply` works for both variants. Status
events are similarly narrowed through `event.statusKind` as `sent`, `delivered`,
`read`, `failed`, or `unknown`, and also surface `event.conversation`,
`event.pricing`, `event.errors`, and `event.callbackData` when Meta includes
them. If you want that normalization without the HTTP handler, use
`webhookEvents(payload)` directly.
