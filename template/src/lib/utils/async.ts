/**
 * Waits for `ms` milliseconds.
 * @param ms - The number of milliseconds to wait.
 * @returns A promise that resolves after `ms` milliseconds.
 */
export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A function that can be called multiple times, but delays the execution of the
 * function until after `wait` milliseconds have elapsed.
 */
export type Debounced<T extends (...args: any[]) => void | Promise<void>> = {
	(...args: Parameters<T>): void;
	/**
	 * Cancels the debounced function if it is scheduled to be called.
	 */
	cancel: () => void;
};

type Timeout = ReturnType<typeof setTimeout>;

/**
 * Delays a function call until after `wait` milliseconds have elapsed.
 * If the function is called again before `wait` milliseconds have elapsed, the
 * previous call is cancelled and the new call is scheduled.
 * @param func - The function to debounce.
 * @param wait - The number of milliseconds to wait before calling the function.
 * @returns The debounced function.
 */
export function debounce<T extends (...args: any[]) => void | Promise<void>>(
	func: T,
	wait: number,
): Debounced<T> {
	let timeout: Timeout | null = null;
	function $cancel() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
	}

	function $debounced(...args: Parameters<T>) {
		$cancel();
		timeout = setTimeout(async () => {
			timeout = null;
			func(...args);
		}, wait);
	}

	$debounced.cancel = $cancel;

	return $debounced;
}

type RateLimited<T extends (...args: any[]) => any> = (
	...args: Parameters<T>
) => Promise<Awaited<ReturnType<T>>>;
/**
 * Rate limits a function to be called at most once per `cps` calls per second.
 * @param func - The function to rate limit.
 * @param cps - The maximum number of calls per second. Must be greater than 0.
 * @returns The rate limited function.
 */
export function rateLimit<T extends (...args: any[]) => any>(func: T, cps: number): RateLimited<T> {
	if (cps <= 0) {
		throw new Error("cps must be greater than 0. what?");
	}
	const timeframe = 1000 / cps;
	let nextStart = 0;
	let promiseChain = Promise.resolve();

	function $rateLimited(...args: Parameters<T>) {
		async function $rateLimitedInner() {
			const now = Date.now();
			const execStartTime = Math.max(nextStart, now);
			const waitTime = execStartTime - now;
			if (waitTime > 0) {
				await wait(waitTime);
			}
			nextStart = execStartTime + timeframe;
			return func(...args);
		}

		const promise = promiseChain.then($rateLimitedInner);
		promiseChain = promise.catch(() => {});
		return promise;
	}

	return $rateLimited;
}
