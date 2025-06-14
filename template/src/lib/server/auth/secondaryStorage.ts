import type { SecondaryStorage } from "better-auth";
import { kv } from "$lib/server/kv";

const authKv = kv.fork("auth");
export const secondaryStorage: SecondaryStorage = {
	async get(key: string) {
		const result = await authKv.get(key);
		if (!result.ok) throw result.error;
		return result.value;
	},
	async set(key: string, value: string, ttlSeconds?: number) {
		const res = await authKv.set(key, value, ttlSeconds);
		if (!res.ok) throw res.error;
	},
	async delete(key: string) {
		const res = await authKv.delete(key);
		if (!res.ok) throw res.error;
	},
};
