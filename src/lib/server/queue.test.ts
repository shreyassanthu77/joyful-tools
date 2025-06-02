import { test, describe, expect, vi } from "vitest";
import { openKv } from "@deno/kv";
import { createQueue } from "./queue.ts";
import { wait } from "../async.ts";

vi.mock(import("./kv.ts"), async () => {
	const tempKv = await openKv(undefined, {
		implementation: "in-memory",
	});
	return {
		kv: tempKv,
	};
});

describe("queue", () => {
	test("basic", async () => {
		const handler = vi.fn(async (_: string) => {});
		const enq = createQueue({
			channel: "basic",
			handler,
		});
		await enq("hello");
		await expect
			.poll(() => handler, { interval: 2 })
			.toHaveBeenCalledWith("hello");
	});

	test("delay", async () => {
		const handler = vi.fn(async (_: string) => {});
		const enq = createQueue({
			channel: "delay",
			handler,
		});
		await enq("hello", 10);
		await expect
			.poll(() => handler, { interval: 10, timeout: 15 })
			.toHaveBeenCalledWith("hello");
	});

	test("retry", async () => {
		const handler = vi
			.fn(async (_: string) => {})
			.mockRejectedValueOnce(new Error("first call"))
			.mockRejectedValueOnce(new Error("second call"));

		const retries = 3;
		const retryDelay = 20;
		const enq = createQueue({
			channel: "retry",
			handler,
			maxRetries: retries,
			retryDelay: retryDelay,
		});

		await enq("hello");
		await wait(retryDelay * retries + 3);
		expect(handler).toHaveBeenCalledTimes(3);
		expect(handler).toHaveBeenNthCalledWith(1, "hello");
		expect(handler).toHaveBeenNthCalledWith(2, "hello");
		expect(handler).toHaveBeenNthCalledWith(3, "hello");
	});

	test("deadletter", async () => {
		const err = new Error("always fails");
		const enq = createQueue<string>({
			channel: "deadletter",
			handler: () => {
				throw err;
			},
			maxRetries: 1,
		});
		await enq("hello");
		await wait(0);
		const msgs = enq.getFailed();
		const deadletters = await Array.fromAsync(msgs);
		expect(deadletters).toHaveLength(1);
		expect(deadletters[0]!.error).toBe(String(err));
	});
});
