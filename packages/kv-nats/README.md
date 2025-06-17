# @joyful/kv-nats

A [Nats.io](https://nats.io/) KV driver for [@joyful/kv](https://jsr.io/@joyful/kv) that uses [jsr:@nats-io/kv](https://jsr.io/@nats-io/kv).

## Usage

```typescript
import { createKv } from "@joyful/kv";
import { connect as natsConnect } from "@nats-io/transport-node"; // or jsr:@nats-io/transport-deno if you're using Deno
import { createNatsDriver } from "@joyful/kv-nats";

const conn = await natsConnect({});
const kv = createKv({
  driver: createNatsDriver({ conn }),
});
```

- Check out the [main package](https://jsr.io/@joyful/kv) for more usage examples.

## License

MIT
