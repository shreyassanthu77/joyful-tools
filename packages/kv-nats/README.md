# @joyful/kv-nats

A driver for [@joyful/kv](https://jsr.io/@joyful/kv) enabling the use of NATS KV.
NATS KV is a key-value store built on top of NATS JetStream, offering persistence and data streaming capabilities.
This driver uses `jsr:@nats-io/kv-deno` (typically with `jsr:@nats-io/nats-deno` for connections) in Deno. For Node.js, it uses functionality from the `nats` package (v2.x or later) for JetStream and KV operations, often complemented by types from `jsr:@nats-io/kv-node` if using JSR in a Node.js project.

## Prerequisites

To use this driver, you need a running NATS server with JetStream enabled. The `prefix` option provided to `createNatsDriver` (e.g., `"my_bucket"`) corresponds to the NATS KV bucket name that will be used or created. If no `prefix` is specified, a default bucket name (typically "KV") will be used.

## Installation

`@joyful/kv-nats` is hosted on [JSR](https://jsr.io/@joyful/kv-nats). You will also typically need `@joyful/kv` and a NATS client library appropriate for your environment.

**1. Install `@joyful` packages:**

*   **For Deno:**
    Add the packages to your `deno.json(c)` configuration file:
    ```bash
    deno add @joyful/kv @joyful/kv-nats
    ```
    Your Deno code will then use imports like:
    ```typescript
    import { createKv } from "jsr:@joyful/kv";
    import { createNatsDriver } from "jsr:@joyful/kv-nats/deno"; // Ensure '/deno' or '/node' entry point is used as appropriate
    ```

*   **For Node.js (and Bun):**
    Use the following commands to add JSR packages:
    *   `npx jsr add @joyful/kv @joyful/kv-nats` (recommended for npm/yarn)
    *   `pnpm install jsr:@joyful/kv jsr:@joyful/kv-nats` (for pnpm v10.8+)
    *   `pnpm dlx jsr add @joyful/kv @joyful/kv-nats` (for older pnpm)
    *   `bunx jsr add @joyful/kv @joyful/kv-nats`

    Your Node.js/Bun code will then use imports like:
    ```typescript
    import { createKv } from "@joyful/kv"; // Or "jsr:@joyful/kv"
    import { createNatsDriver } from "@joyful/kv-nats/node"; // Ensure '/deno' or '/node' entry point is used as appropriate
    ```

**2. Install NATS Client Library:**

*   **For Deno:**
    The NATS client is typically imported directly via JSR:
    ```typescript
    import { connect as natsConnect } from "jsr:@nats-io/nats-deno";
    ```
    (Ensure this is the correct/recommended NATS client for Deno from JSR).

*   **For Node.js:**
    Install the `nats` package using npm/yarn/pnpm:
    ```bash
    npm install nats
    # or
    yarn add nats
    # or
    pnpm add nats
    ```
    Then import it in your code:
    ```typescript
    import { connect as natsConnect } from "nats";
    ```

**Node.js Note:** For Node.js environments, ensure your `package.json` includes `"type": "module"` for ES module support, or use dynamic imports if you are in a CommonJS project. Refer to the [JSR documentation](https://jsr.io/docs/consuming-packages/with-node) for detailed Node.js compatibility and setup.

## Usage

The following example demonstrates usage in a Deno environment. For Node.js, adjust the NATS client import (`import { connect } from "nats";`) and the `createNatsDriver` import (`from "@joyful/kv-nats/node";`).

```typescript
// Example for Deno
import { createKv } from "@joyful/kv";
import { createNatsDriver } from "@joyful/kv-nats/deno";
import { connect as natsConnect } from "jsr:@nats-io/nats-deno"; // NATS client for Deno

async function main() {
  let nc;
  try {
    // 1. Connect to NATS server (ensure JetStream is enabled)
    nc = await natsConnect({ servers: "nats://localhost:4222" });
    console.log("Connected to NATS.");

    // 2. Create the NATS KV driver
    // The prefix "my_app_data" will be the NATS KV bucket name.
    const natsDriver = await createNatsDriver({
      conn: nc,
      prefix: "my_app_data", // This will be the bucket name in NATS KV
      // options: { /* additional NATS KV options from jsr:@nats-io/kv-deno KvOptions */ }
      // e.g., { history: 5 }
    });
    console.log("NATS KV driver created for bucket 'my_app_data'.");

    // 3. Create the @joyful/kv store
    const kvStore = createKv({ driver: natsDriver });
    console.log("@joyful/kv store created.");

    // 4. Set a value
    const setResult = await kvStore.set("user:1", "Alice");
    if (setResult.ok) {
      console.log("Value set successfully: user:1 -> Alice");
    } else {
      console.error("Failed to set value:", setResult.error);
    }

    // 5. Get a value
    const getResult = await kvStore.get("user:1");
    if (getResult.ok) {
      console.log("Retrieved value for user:1 ->", getResult.value); // Should be "Alice"
    } else {
      console.error("Failed to get value for user:1:", getResult.error);
    }

    // 6. Example for TTL (Time-To-Live)
    // The NatsDriver in this package implements TTL by prefixing keys
    // and managing expiration internally, as NATS KV itself might have
    // different TTL semantics (e.g., per-bucket limits or requires NATS Server >= 2.10 for native key-level TTL).
    const ttlKey = "temporary:data";
    const ttlSetResult = await kvStore.set(ttlKey, "this will expire", 60); // Expires in 60 seconds
    if (ttlSetResult.ok) {
      console.log(`Temporary value set for key '${ttlKey}' with 60s TTL.`);
    } else {
      console.error(`Failed to set temporary value for key '${ttlKey}':`, ttlSetResult.error);
    }

    // Verify TTL by trying to get it after a delay (optional, for demonstration)
    // console.log(`Waiting for ${ttlKey} to expire...`);
    // await new Promise(resolve => setTimeout(resolve, 61 * 1000));
    // const afterTtlResult = await kvStore.get(ttlKey);
    // if (afterTtlResult.ok) {
    //   console.error(`ERROR: Value for '${ttlKey}' should have expired but was found:`, afterTtlResult.value);
    // } else {
    //   console.log(`Value for '${ttlKey}' correctly not found after TTL.`);
    // }

  } catch (err) {
    console.error("Error in NATS KV example:", err);
  } finally {
    // 7. Clean up NATS connection
    if (nc) {
      await nc.close();
      console.log("NATS connection closed.");
    }
  }
}

main().catch(err => {
  console.error("Unhandled error in main function:", err);
});

```

- Check out the [main @joyful/kv package documentation](https://jsr.io/@joyful/kv) for more general usage examples of the `Kv` interface.
- For detailed NATS KV options, refer to the documentation for `jsr:@nats-io/kv-deno` (for Deno) or `@nats-io/kv-node` (for Node.js).

## License

MIT
