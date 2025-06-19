# @joyful/kv-mini-redis

A minimal Redis/Valkey driver for [@joyful/kv](https://jsr.io/@joyful/kv) that uses [@iuioiua/redis](https://jsr.io/@iuioiua/redis) for the underlying Redis protocol implementation.
Redis is a popular open-source, in-memory data structure store, used as a database, cache, and message broker. Valkey is a community-driven fork of Redis.

This driver allows you to easily connect your Kv-compliant application to a Redis or Valkey data store.

## Features

- **Cross-Runtime Compatibility**: Works in both Deno and Node.js environments.
  - For Node.js environments, version 18.0.0 or later is **required** due to the use of native stream adaptation features (`Readable.toWeb`, `Writable.toWeb`). Deno environments do not have this specific version constraint.
- **Flexible Connection Options**:
    - Connect using a Redis URL string (e.g., `redis://user:pass@host:port/db`).
    - Supports `redis://` (plain TCP) and `rediss://` (TLS) URL schemes.
    - Alternatively, provide individual options like `hostname`, `port`, `password`, `db`, and `tls`.
- **TLS Support**: Securely connect to Redis instances requiring TLS.
- **Password Authentication**: Authenticate using a password from the URL or the `password` option.
- **Database Selection**: Connect to a specific Redis database using the URL path or the `db` option.
- **Option Precedence**: Explicitly provided options (like `port` or `password`) will override values parsed from a connection URL if both are supplied.

## Installation

`@joyful/kv-mini-redis` is hosted on [JSR](https://jsr.io/@joyful/kv-mini-redis). You will also typically need `@joyful/kv`.

**For Deno:**
Add the packages to your `deno.json(c)` configuration file:
```bash
deno add @joyful/kv @joyful/kv-mini-redis
```
Then, you can import them in your Deno project:
```typescript
import { createKv } from "jsr:@joyful/kv";
import { createRedisDriver, RedisConnectionOptions } from "jsr:@joyful/kv-mini-redis";
```

**For Node.js (and Bun):**
You can use the following commands to add JSR packages to your project:

*   **Using `npx` (recommended for npm/yarn users):**
    ```bash
    npx jsr add @joyful/kv @joyful/kv-mini-redis
    ```
*   **Using `pnpm` (version 10.8 or later):**
    ```bash
    pnpm install jsr:@joyful/kv jsr:@joyful/kv-mini-redis
    ```
*   **Using `pnpm` (older than 10.8):**
    ```bash
    pnpm dlx jsr add @joyful/kv @joyful/kv-mini-redis
    ```
*   **Using `bun`:**
    ```bash
    bunx jsr add @joyful/kv @joyful/kv-mini-redis
    ```

After installation, you can import the packages in your Node.js/Bun project:
```typescript
import { createKv } from "@joyful/kv"; // Or "jsr:@joyful/kv"
import { createRedisDriver, RedisConnectionOptions } from "@joyful/kv-mini-redis"; // Or "jsr:@joyful/kv-mini-redis"
```
**Note:** For Node.js environments, ensure your `package.json` includes `"type": "module"` for ES module support, or use dynamic imports if you are in a CommonJS project. Refer to the [JSR documentation](https://jsr.io/docs/consuming-packages/with-node) for detailed Node.js compatibility and setup.

## Usage

Here are various ways to configure the Redis driver:

**1. Using Default Options (connects to `redis://127.0.0.1:6379`)**

```typescript
const driver = await createRedisDriver(); // Connects to redis://127.0.0.1:6379 by default
const kv = createKv({ driver });

// Basic operations
const setResult = await kv.set("user:alice", "Alice Name");
if (setResult.ok) {
  console.log("Alice's name set successfully.");
} else {
  console.error("Failed to set Alice's name:", setResult.error);
}

const getResult = await kv.get("user:alice");
if (getResult.ok) {
  console.log("Retrieved user:", getResult.value); // "Alice Name"
} else {
  console.error("Failed to get user:alice:", getResult.error);
}
```

**2. Using a Redis URL**

```typescript
// Basic URL
const driver1 = await createRedisDriver({ url: "redis://localhost:6379" });

// URL with password
const driver2 = await createRedisDriver({ url: "redis://:mypassword@localhost:6379" });

// URL for TLS connection (rediss:// scheme)
const driver3 = await createRedisDriver({ url: "rediss://my-secure-redis-host:6379" });

// URL with a specific database number (e.g., database 2)
const driver4 = await createRedisDriver({ url: "redis://localhost/2" });

const kvWithUrl = createKv({ driver: driver1 });
// Now use kvWithUrl for operations, e.g.:
// const setResultUrl = await kvWithUrl.set("foo", "bar");
// if (setResultUrl.ok) { console.log(await kvWithUrl.get("foo")); }
```

**3. Using Individual Options**

```typescript
// Connecting to a specific hostname and port
const driverOpts1 = await createRedisDriver({
  hostname: "my.redis.server",
  port: 6380,
});

// Connecting with TLS enabled
const driverOpts2 = await createRedisDriver({
  hostname: "my-secure-redis-host",
  port: 6379,
  tls: true,
});

// Connecting with a password and to a specific database
const driverOpts3 = await createRedisDriver({
  hostname: "localhost",
  password: "supersecretpassword",
  db: 1,
});

const kvWithOptions = createKv({ driver: driverOpts1 });
// Now use kvWithOptions for operations, e.g.:
// const setResultOpts = await kvWithOptions.set("anotherKey", "anotherValue");
// if (setResultOpts.ok) { console.log(await kvWithOptions.get("anotherKey")); }
```

**4. Overriding URL Parts with Explicit Options**

Explicit options take precedence over values parsed from the `url`.

```typescript
// URL specifies port 6379, but the 'port' option overrides it to 6380
const driverMixed1 = await createRedisDriver({
  url: "redis://localhost:6379",
  port: 6380, // This port will be used
});

// URL specifies TLS via 'rediss://', but 'tls' option overrides it to false
const driverMixed2 = await createRedisDriver({
  url: "rediss://localhost:6379",
  tls: false, // Connection will NOT use TLS
});

// URL has one password, 'password' option provides the one that will be used
const driverMixed3 = await createRedisDriver({
  url: "redis://:urlpassword@localhost",
  password: "explicit_password", // This password will be used
});
```

For a full list of connection options and their descriptions, refer to the `RedisConnectionOptions` type definition in the `mod.ts` file of this package.

- Check out the [main package @joyful/kv](https://jsr.io/@joyful/kv) for more usage examples of the Kv interface.

## License

MIT
