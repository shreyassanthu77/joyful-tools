# @joyful/kv-mini-redis

A minimal Redis/Valkey driver for [@joyful/kv](https://jsr.io/@joyful/kv) that uses [@iuioiua/redis](https://jsr.io/@iuioiua/redis) for the underlying Redis protocol implementation.

This driver allows you to easily connect your Kv-compliant application to a Redis data store.

## Features

- **Cross-Runtime Compatibility**: Works in both Deno and Node.js environments.
  - For Node.js, version 18.0.0 or later is recommended to ensure availability of native stream adaptation features (`Readable.toWeb`, `Writable.toWeb`).
- **Flexible Connection Options**:
    - Connect using a Redis URL string (e.g., `redis://user:pass@host:port/db`).
    - Supports `redis://` (plain TCP) and `rediss://` (TLS) URL schemes.
    - Alternatively, provide individual options like `hostname`, `port`, `password`, `db`, and `tls`.
- **TLS Support**: Securely connect to Redis instances requiring TLS.
- **Password Authentication**: Authenticate using a password from the URL or the `password` option.
- **Database Selection**: Connect to a specific Redis database using the URL path or the `db` option.
- **Option Precedence**: Explicitly provided options (like `port` or `password`) will override values parsed from a connection URL if both are supplied.

## Usage

First, ensure you have `@joyful/kv` and `@joyful/kv-mini-redis` installed or imported.

```typescript
import { createKv } from "@joyful/kv";
import { createRedisDriver, RedisDriverOptions } from "@joyful/kv-mini-redis";
// For Node.js, you might import like this if using ESM:
// import { createKv } from "@joyful/kv/index.js";
// import { createRedisDriver } from "@joyful/kv-mini-redis/index.js";
```

Here are various ways to configure the Redis driver:

**1. Using Default Options (connects to `redis://127.0.0.1:6379`)**

```typescript
const driver = await createRedisDriver();
const kv = createKv({ driver });

// Basic operations
await kv.set(["users", "alice"], { name: "Alice" });
console.log(await kv.get(["users", "alice"]));
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
// ... use kvWithUrl
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
// ... use kvWithOptions
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

Refer to the `RedisDriverOptions` documentation in `mod.ts` for a full list of options and their descriptions.

- Check out the [main package @joyful/kv](https://jsr.io/@joyful/kv) for more usage examples of the Kv interface.

## License

MIT
