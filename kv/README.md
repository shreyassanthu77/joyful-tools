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

```typescript
import { createKv } from "@joyful/kv";
import { createMemoryDriver } from "@joyful/kv/memory";
import { createDenoDriver } from "@joyful/kv/deno-kv";
```

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
}

// Get a value
const getResult = await kv.get("user:123");
if (getResult.ok) {
  console.log("User:", getResult.value); // "john_doe"
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

const denoKv = await Deno.openKv();
const kv = createKv({
  driver: createDenoDriver({ kv: denoKv }),
  prefix: "myapp"
});

// Same API as above
await kv.set("key", "value");
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

### Custom Value Types

```typescript
interface User {
  id: string;
  name: string;
}

const userKv = createKv<unknown, User>({
  driver: createMemoryDriver(),
});

await userKv.set("user:123", { id: "123", name: "John" });
```

## API Reference

### `createKv(options)`

Creates a new KV store instance.

**Options:**
- `driver`: KV driver implementation
- `prefix?`: Optional prefix for all keys (default: "kv")

### `Kv` Methods

- `get(key: string)`: Get value by key
- `set(key: string, value: Value, ttlSeconds?: number)`: Set value with optional TTL
- `delete(key: string)`: Delete value by key
- `clear()`: Clear all values in the current namespace
- `fork(namespace: string)`: Create a new KV instance with a sub-namespace

### Drivers

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

## Error Handling

All operations return a `KvResult<T>` which is either:

```typescript
{ ok: true, value: T } | { ok: false, error: unknown }
```

```typescript
const result = await kv.get("key");
if (result.ok) {
  console.log("Value:", result.value);
} else {
  console.error("Error:", result.error);
}
```

## License

MIT
