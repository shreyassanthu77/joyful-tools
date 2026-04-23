# @joypack/waba

WhatsApp Business API tooling.

Built on top of `@joyful/fetch` and `@joyful/result`.

The package does two things:

- makes outbound WhatsApp Cloud API requests with `createWabaClient()`
- handles inbound webhook verification and delivery with `handleWebhooks()`

## Installation

```bash
# npm
npm install @joypack/waba

# pnpm
pnpm add @joypack/waba

# bun
bun add @joypack/waba

# npm (from JSR)
npx jsr add @joypack/waba

# pnpm 10.9+ (from JSR)
pnpm add jsr:@joypack/waba

# yarn 4.9+ (from JSR)
yarn add jsr:@joypack/waba

# deno
deno add jsr:@joypack/waba
```

## Request API

```ts
import { createWabaClient } from "@joypack/waba";

const waba = createWabaClient({
  accessToken: Deno.env.get("WHATSAPP_ACCESS_TOKEN")!,
  apiVersion: "v22.0",
});

const sent = await waba.request<{ messages: Array<{ id: string }> }>({
  path: "/1234567890/messages",
  json: {
    messaging_product: "whatsapp",
    to: "15551234567",
    type: "text",
    text: { body: "hello" },
  },
});

if (sent.isErr()) {
  console.error(sent.error._tag, sent.error.message);
}
```

`request<T>()` returns an `AsyncResult<T, WabaRequestError>` and parses the
successful response body as JSON for you.

WhatsApp failures are normalized to `WhatsAppError`, which carries Meta's parsed
error fields like `status`, `type`, `code`, `subcode`, `fbtraceId`, `details`,
and `body` when available.

## Webhooks

```ts
import { handleWebhooks } from "@joypack/waba";

export const webhook = handleWebhooks(
  async ({ event }) => {
    if (event.kind === "message") {
      console.log(event.message.id, event.contacts[0]?.wa_id);
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
event before your callback runs. If you want that normalization without the HTTP
handler, use `webhookEvents(payload)` directly.
