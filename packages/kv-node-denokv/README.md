# @joyful/kv-node-denokv

[@deno/kv](https://www.npmjs.com/package/@deno/kv) driver for [@joyful/kv](https://jsr.io/@joyful/kv).

## Usage

```typescript
import { createKv } from "@joyful/kv";
import { createDenoDriver, openKv } from "@joyful/kv-node-denokv";

const kv = createKv({
  driver: createDenoDriver({
    kv: await openKv(),
  }),
});
```

> [!NOTE] `openKv` is just a re-export from [@deno/kv](https://www.npmjs.com/package/@deno/kv).

- Check out the [main package](https://jsr.io/@joyful/kv) for more usage examples.
- Also check out the [@deno/kv](https://www.npmjs.com/package/@deno/kv) package for more information ## License


## License

MIT
