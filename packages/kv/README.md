# @joyful/kv

A simple, type-safe key-value store abstraction for Node and Deno with multiple driver support.

## Features

- **Zero-dependency**: No external dependencies except for the drivers themselves
- **Type-safe**: Full TypeScript support with generic value types
- **Multiple drivers**: Memory and Deno KV drivers included as of now
- **Namespacing**: Create isolated namespaces with the `fork()` method
- **TTL support**: Set expiration times for values
- **Error handling**: Result-based error handling with `KvResult<T>`
- **Prefix management**: Automatic key prefixing for organization

## Installation

`@joyful/kv` is hosted on [JSR](https://jsr.io/@joyful/kv).

**For Deno:**
Add the package to your `deno.json(c)` configuration file:
```bash
deno add @joyful/kv
```
Then, you can import it in your Deno project:
```typescript
import { createKv } from "jsr:@joyful/kv";
// Drivers included in the main package can be imported directly:
import { createMemoryDriver } from "jsr:@joyful/kv/memory";
import { createDenoDriver } from "jsr:@joyful/kv/deno-kv";
```

**For Node.js (and Bun):**
You can use the following commands to add JSR packages to your project:

*   **Using `npx` (recommended for npm/yarn users):**
    ```bash
    npx jsr add @joyful/kv
    ```
*   **Using `pnpm` (version 10.8 or later):**
    ```bash
    pnpm install jsr:@joyful/kv
    ```
*   **Using `pnpm` (older than 10.8):**
    ```bash
    pnpm dlx jsr add @joyful/kv
    ```
*   **Using `bun`:**
    ```bash
    bunx jsr add @joyful/kv
    ```

After installation, you can import the package in your Node.js/Bun project:
```typescript
import { createKv } from "@joyful/kv"; // Or "jsr:@joyful/kv" if your setup prefers explicit jsr specifier
import { createMemoryDriver } from "@joyful/kv/memory"; // Or "jsr:@joyful/kv/memory"
import { createDenoDriver } from "@joyful/kv/deno-kv"; // Or "jsr:@joyful/kv/deno-kv"
```
**Note:** For Node.js environments, ensure your `package.json` includes `"type": "module"` for ES module support, or use dynamic imports if you are in a CommonJS project. Refer to the [JSR documentation](https://jsr.io/docs/consuming-packages/with-node) for detailed Node.js compatibility and setup.

## Usage

### Basic Usage

```typescript
import { createKv } from "@joyful/kv";
import { createMemoryDriver } from "@joyful/kv/memory";

// Create a KV store with memory driver
const kv = createKv({
  driver: createMemoryDriver(),
  prefix: "myapp"
});

// Set a value
const setResult = await kv.set("user:123", "john_doe");
if (setResult.ok) {
  console.log("Value set successfully");
} else {
  console.error("Failed to set value:", setResult.error);
  // Handle error appropriately
}

// Get a value
const getResult = await kv.get("user:123");
if (getResult.ok) {
  console.log("User:", getResult.value); // "john_doe"
} else {
  console.error("Failed to get value:", getResult.error);
}

// Delete a value
await kv.delete("user:123");

// Clear all values in the namespace
await kv.clear();
```

### Using Deno KV Driver

```typescript
import { createKv } from "@joyful/kv";
import { createDenoDriver } from "@joyful/kv/deno-kv";

// This example is specific to Deno runtime
const denoKvInstance = await Deno.openKv(); // Standard Deno API to open a KV store
const kv = createKv({
  driver: createDenoDriver({ kv: denoKvInstance }),
  prefix: "myapp"
});

// Same API as above
const setResult = await kv.set("key", "value");
if (setResult.ok) {
  console.log("Value set in Deno KV");
} else {
  console.error("Failed to set value in Deno KV:", setResult.error);
}
```

### Namespacing with Fork

```typescript
const kv = createKv({
  driver: createMemoryDriver(),
  prefix: "myapp"
});

// Create separate namespaces
const authKv = kv.fork("auth");
const cacheKv = kv.fork("cache");

// These won't conflict with each other
await authKv.set("session", "abc123");
await cacheKv.set("session", "cached_data");
```

### TTL (Time-to-Live)

```typescript
// Set a value that expires in 60 seconds
await kv.set("temp_token", "xyz789", 60);
```

## API Reference

### `createKv(options)`

Creates a new KV store instance.

**Options:**
- `driver`: KV driver implementation
- `prefix?`: Optional prefix for all keys (default: "kv")

### `Kv` Methods

- `get(key: string)`: Get value by key
- `set(key: string, value: Value, ttlSeconds?: number)`: Set value with optional TTL. `Value` is a generic and type-safe parameter, typically a string, number, boolean, or a simple JavaScript object that can be serialized (e.g., not containing functions or complex class instances).
- `delete(key: string)`: Delete value by key
- `clear()`: Clear all values in the current namespace
- `fork(namespace: string)`: Create a new KV instance with a sub-namespace

### Built-in Drivers

#### Memory Driver
```typescript
import { createMemoryDriver } from "@joyful/kv/memory";
const driver = createMemoryDriver();
```

#### Deno KV Driver
```typescript
import { createDenoDriver } from "@joyful/kv/deno-kv";
const driver = createDenoDriver({ 
  kv: await Deno.openKv(),
  prefix?: "custom_prefix"
});
```

#### Other Drivers
Some other drivers are available as separate packages, allowing you to install only what you need. These external driver packages will include their own necessary dependencies (e.g., a Redis client for a Redis driver).

| Driver | Description |
| --- | --- |
| [`@joyful/kv-node-denokv`](https://jsr.io/@joyful/kv-node-denokv) | A Deno KV driver for Node.js that uses [@deno/kv](https://www.npmjs.com/package/@deno/kv). |
| [`@joyful/kv-mini-redis`](https://jsr.io/@joyful/kv-mini-redis) | A small Redis/Valkey driver based on [@iuioiua/redis](https://jsr.io/@iuioiua/redis). |
| [`@joyful/kv-nats`](https://jsr.io/@joyful/kv-nats) | A NATS KV driver. (See package README for NATS client details). |

## Error Handling

All operations return a `KvResult<T, E>` which is either:

```typescript
{ ok: true, value: T } | { ok: false, error: E }
```

```typescript
const result = await kv.get("key");
if (result.ok) {
  console.log("Value:", result.value);
} else {
  console.error("Failed to get key:", result.error);
  // Potentially return a default value or handle appropriately,
  // for example:
  // return undefined;
  // or throw new Error(`Failed to retrieve key: ${result.error.message}`);
}
```

## License

MIT
