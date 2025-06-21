import { createKv } from "@joyful/kv";
import { openKv, createDenoDriver } from "@joyful/kv-node-denokv";
import { serialize as encodeV8, deserialize as decodeV8 } from "node:v8";

const denoKv = await openKv("data/kv.db", {
	implementation: "sqlite",
	encodeV8,
	decodeV8,
});

export const kv = createKv({
	driver: createDenoDriver({
		kv: denoKv,
	}),
});
