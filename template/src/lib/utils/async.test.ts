import { expect, test, describe, vi } from "vitest";
import { wait, debounce, rateLimit } from "./async.ts";

test("wait()", async () => {
	const start = Date.now();
	const WAIT_TIME = 5;
	await wait(WAIT_TIME);
	const waitTime = Date.now() - start;
	const WIGGLE_ROOM = 1.2;
	expect(waitTime).toBeGreaterThanOrEqual(WAIT_TIME - WIGGLE_ROOM);
	expect(waitTime).toBeLessThan(WAIT_TIME + WIGGLE_ROOM);
});

describe("debounce()", () => {
	const DELAY = 4;
	test("should delay a function", async () => {
		const inner = vi.fn(() => {});
		const debounced = debounce(inner, DELAY);
		debounced();

		await wait(DELAY);
		expect(inner).toBeCalledTimes(1);
	});

	test("should debounce multiple calls", async () => {
		const inner = vi.fn(() => {});
		const debounced = debounce(inner, DELAY);

		debounced();
		debounced();
		debounced();
		await wait(DELAY);
		expect(inner).toBeCalledTimes(1);
	});

	test("cancel() should cancel a debounced function", async () => {
		const inner = vi.fn(() => {});
		const debounced = debounce(inner, DELAY);

		debounced();
		debounced.cancel();
		await wait(DELAY);
		expect(inner).toBeCalledTimes(0);
	});
});

describe("rate limited()", () => {
	test("should run a single call immediately", async () => {
		const inner = vi.fn(() => {});
		const rateLimited = rateLimit(inner, 2);
		rateLimited();
		await Promise.resolve();
		expect(inner).toBeCalledTimes(1);
	});

	test("should run multiple calls until the timeframe is reached", async () => {
		const CPS = 4;
		const inner = vi.fn(() => {});
		const rateLimited = rateLimit(inner, CPS);
		for (let i = 0; i < CPS + 1; i++) {
			rateLimited();
		}
		await wait(1000);
		expect(inner).toBeCalledTimes(CPS);
		await wait(1000);
		expect(inner).toBeCalledTimes(CPS + 1);
	});
});
