# @joyful/kv-mini-redis

A small Redis/Valkey driver for [@joyful/kv](https://jsr.io/@joyful/kv) that uses [@iuioiua/redis](https://jsr.io/@iuioiua/redis).

## Usage

```typescript
import { createKv } from "@joyful/kv";
import { createRedisDriver } from "@joyful/kv-mini-redis";

const kv = createKv({
  driver: createRedisDriver({
    hostname: "127.0.0.1",
    port: 6379,
  }),
});
```

> [!NOTE] `createRedisDriver` currently only works in Deno and only supports basic tcp transport. More options will be added in the future.

- Check out the [main package](https://jsr.io/@joyful/kv) for more usage examples.

## License

MIT
