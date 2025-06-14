import { createKv } from "@joyful/kv";
import { openKv, createDenoDriver } from "@joyful/kv/deno-kv-node";

const denoKv = await openKv();

export const kv = createKv({
	driver: createDenoDriver({
		kv: denoKv,
	}),
});
