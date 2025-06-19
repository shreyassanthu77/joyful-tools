# @joyful/kv-node-denokv

[@deno/kv](https://www.npmjs.com/package/@deno/kv) driver for [@joyful/kv](https://jsr.io/@joyful/kv).
This package provides a driver that allows you to use Deno's Key-Value (KV) store API in Node.js environments. It leverages the `@deno/kv` package, which implements the Deno KV API, typically using a local SQLite database as the backend by default.

## Installation

`@joyful/kv-node-denokv` is hosted on [JSR](https://jsr.io/@joyful/kv-node-denokv). This package is intended for Node.js environments. You will also typically need `@joyful/kv` and the `@deno/kv` npm package.

**1. Install `@joyful` packages using JSR:**

You can use the following commands to add JSR packages to your Node.js (or Bun) project:

*   **Using `npx` (recommended for npm/yarn users):**
    ```bash
    npx jsr add @joyful/kv @joyful/kv-node-denokv
    ```
*   **Using `pnpm` (version 10.8 or later):**
    ```bash
    pnpm install jsr:@joyful/kv jsr:@joyful/kv-node-denokv
    ```
*   **Using `pnpm` (older than 10.8):**
    ```bash
    pnpm dlx jsr add @joyful/kv @joyful/kv-node-denokv
    ```
*   **Using `bun`:**
    ```bash
    bunx jsr add @joyful/kv @joyful/kv-node-denokv
    ```

**2. Install `@deno/kv` npm package:**

This driver requires the `@deno/kv` package from npm, which provides the Deno KV API implementation for Node.js. Install it using your preferred Node.js package manager:
```bash
npm install @deno/kv
# or
yarn add @deno/kv
# or
pnpm add @deno/kv
# or
bun add @deno/kv
```

After installation, you can import the packages in your Node.js/Bun project:
```typescript
import { createKv } from "@joyful/kv"; // Or "jsr:@joyful/kv"
import { createDenoDriver, openKv } from "@joyful/kv-node-denokv"; // Or "jsr:@joyful/kv-node-denokv"
// import { openKv } from "@deno/kv"; // Alternatively, openKv can be imported directly
```

**Node.js Note:** Ensure your `package.json` includes `"type": "module"` for ES module support, or use dynamic imports if you are in a CommonJS project. Refer to the [JSR documentation](https://jsr.io/docs/consuming-packages/with-node) for detailed Node.js compatibility and setup with JSR packages.

**Backend Configuration:**
The `@deno/kv` package might store data in a local file (e.g., `deno.sqlite` in the current working directory or a system-specific location). You can often specify a path when calling `openKv()`, for example `await openKv("./my-app-data.sqlite");`. For detailed configuration of `@deno/kv` (like custom backend paths or in-memory usage), please refer to the [official @deno/kv documentation](https://www.npmjs.com/package/@deno/kv).

## Usage

```typescript
import { createKv } from "@joyful/kv";
import { createDenoDriver, openKv } from "@joyful/kv-node-denokv";
// Alternatively, if you prefer: import { openKv } from "@deno/kv";

async function main() {
  // Open the Deno KV store.
  // You can optionally provide a path to a SQLite file, e.g., await openKv("./my-app-data.sqlite");
  // If no path is provided, @deno/kv uses a default location.
  const denoKvStore = await openKv(); // Or: await openKv("path/to/your.sqlite");

  // Create the @joyful/kv driver
  const driver = createDenoDriver({
    kv: denoKvStore,
    prefix: "myapp", // Optional: adds a prefix to all keys for this kv instance
  });

  // Create the @joyful/kv store
  const kv = createKv({ driver });

  console.log("Setting values...");
  const setResult1 = await kv.set("user:1", { name: "Alice", age: 30 });
  if (!setResult1.ok) console.error("Set failed for user:1:", setResult1.error);

  const setResult2 = await kv.set("config:theme", "dark");
  if (!setResult2.ok) console.error("Set failed for config:theme:", setResult2.error);

  console.log("\nGetting values...");
  const userResult = await kv.get<{ name: string; age: number }>("user:1");
  if (userResult.ok) {
    console.log("User 1:", userResult.value); // { name: "Alice", age: 30 }
  } else {
    console.error("Failed to get user:1:", userResult.error);
  }

  const themeResult = await kv.get<string>("config:theme");
  if (themeResult.ok) {
    console.log("Theme:", themeResult.value); // "dark"
  } else {
    console.error("Failed to get config:theme:", themeResult.error);
  }

  // Example of using TTL (Time-To-Live)
  console.log("\nSetting value with TTL...");
  const tempSetResult = await kv.set("session:token", "abc123xyz", 60); // Expires in 60 seconds
  if (tempSetResult.ok) {
    console.log("Session token set with TTL.");
  } else {
    console.error("Failed to set session token:", tempSetResult.error);
  }

  // Note: @deno/kv handles persistence. Closing is typically managed by the underlying @deno/kv store.
  // If specific cleanup is needed for the DenoKv instance from @deno/kv, refer to its documentation.
  // For example, some versions/implementations might have a `denoKvStore.close()` method.
  // As of @deno/kv 0.3.x and later, an explicit close is generally not required for file-based stores
  // and might not even be available on the Kv object itself.
  // Example of checking if close method exists (use with caution):
  // if (denoKvStore && typeof (denoKvStore as any).close === 'function') {
  //   (denoKvStore as any).close();
  //   console.log("\nDeno KV store closed if 'close' method was available.");
  // }
}

main().catch(err => {
  console.error("Error in example:", err);
});
```

> [!NOTE]
> `openKv` is re-exported from `@deno/kv` by this package for convenience. You can also import `openKv` directly from `@deno/kv` if you prefer.

## Further Information

- Check out the [main @joyful/kv package documentation](https://jsr.io/@joyful/kv) for more usage examples of the generic `Kv` interface.
- For more details on configuring the Deno KV behavior in Node.js, including backend options, refer to the [official @deno/kv package documentation](https://www.npmjs.com/package/@deno/kv).

## License

MIT
