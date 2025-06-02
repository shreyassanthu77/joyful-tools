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
		await expect.poll(() => handler).toHaveBeenCalledWith("hello");
	});

	test("delay", async () => {
		const handler = vi.fn(async (_: string) => {});
		const enq = createQueue({
			channel: "delay",
			handler,
		});
		await enq("hello", 10);
		await expect
			.poll(() => handler, {
				interval: 10,
				timeout: 15,
			})
			.toHaveBeenCalledWith("hello");
	});
});
