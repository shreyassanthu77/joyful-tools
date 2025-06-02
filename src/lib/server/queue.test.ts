import { test, describe, expect, vi } from "vitest";
import { openKv } from "@deno/kv";
import { createQueue } from "./queue.ts";

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
		const enq = createQueue({
			channel: "retry",
			handler,
			maxRetries: retries,
			retryDelay: 0,
		});

		await enq("hello");
		await expect
			.poll(() => handler, {
				interval: 2,
				timeout: 100,
			})
			.toHaveBeenCalledTimes(retries);
		expect(handler).toHaveBeenNthCalledWith(1, "hello");
		expect(handler).toHaveBeenNthCalledWith(2, "hello");
		expect(handler).toHaveBeenNthCalledWith(3, "hello");
	});

	test("deadletter", async () => {
		const err = new Error("always fails");
		const handler = vi.fn(async (_: string) => {
			throw err;
		});
		const enq = createQueue<string>({
			channel: "deadletter",
			handler,
			maxRetries: 1,
			retryDelay: 0,
		});
		await enq("hello");
		await expect
			.poll(() => handler, { interval: 2, timeout: 100 })
			.toHaveBeenCalledWith("hello");
		const msgs = enq.getFailed();
		const deadletters = await Array.fromAsync(msgs);
		expect(deadletters).toHaveLength(1);
		expect(deadletters[0]!.error).toBe(String(err));
	});

	test("custom failure handler", async () => {
		const err = new Error("always fails");
		const func = vi.fn(async (_: string, __: unknown) => {});
		const enq = createQueue<string>({
			channel: "custom-failure-handler",
			handler: () => {
				throw err;
			},
			onFailure: async (data, error) => {
				func(data, error);
			},
			maxRetries: 1,
			retryDelay: 0,
		});
		await enq("hello");
		await expect
			.poll(() => func, { interval: 2, timeout: 100 })
			.toHaveBeenCalledWith("hello", err);
	});
});
