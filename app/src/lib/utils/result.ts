interface BaseResult<T, E> {
	/**
	 *  Returns `true` if the result is an `Ok` value.
	 */
	ok(): this is Ok<T, E>;
	/**
	 *  Returns `true` if the result is an `Err` value.
	 */
	err(): this is Err<T, E>;
	/**
	 *  Unwraps the result, yielding the content of an `Ok` value.
	 *  Throws if the result is an `Err` value.
	 */
	unwrap(): T;
	/**
	 *  Unwraps the result, yielding the content of an `Err` value.
	 *  Throws if the result is an `Ok` value.
	 */
	unwrapErr(): E;
	/**
	 *  Unwraps the result, yielding the content of an `Ok` value.
	 *  Returns the provided default value if the result is an `Err` value.
	 */
	unwrapOr(defaultValue: T): T;
	/**
	 *  Returns the result of calling the function `f` with the content of an `Ok` value,
	 *  or returns the content of an `Err` value if the result is an `Err` value.
	 */
	andThen<U, O>(f: (value: T) => Result<U, O>): Result<U, E | O>;
	/**
	 *  Returns the result of calling the function `f` with the content of an `Err` value,
	 *  or returns the content of an `Ok` value if the result is an `Ok` value.
	 */
	orElse<U, O>(f: (value: E) => Result<U, O>): Result<T | U, O>;
	/**
	 *  Maps the contained value using the provided function, or returns the content of an `Err` value if the result is an `Err` value.
	 */
	map<U>(f: (value: T) => U): Result<U, E>;
	/**
	 *  Maps the error value using the provided function, or returns the content of an `Ok` value if the result is an `Ok` value.
	 */
	mapErr<O>(f: (value: E) => O): Result<T, O>;

	mapOrDefault<U>(defaultValue: U): Result<T | U, never>;
	mapOrDefault<U>(defaultFunc: (err: E) => U): Result<T | U, never>;

	/** Converts the result to an `AsyncResult`. */
	toAsync(): AsyncResult<T, E>;
}

export class Ok<T, E> implements BaseResult<T, E> {
	value: T;
	constructor(value: T) {
		this.value = value;
	}

	ok(): this is Ok<T, E> {
		return true;
	}

	err(): this is Err<T, E> {
		return false;
	}

	unwrap(): T {
		return this.value;
	}

	unwrapErr(): E {
		throw new Error('Called `unwrapErr` on an `Ok` value.');
	}

	unwrapOr(_: T): T {
		return this.value;
	}

	andThen<U, O>(f: (value: T) => Result<U, O>): Result<U, E | O> {
		try {
			return f(this.value);
		} catch (e) {
			return new Err(e as O);
		}
	}

	orElse<U, O>(_: (value: E) => Result<U, O>): Result<T | U, O> {
		return new Ok(this.value);
	}

	map<U>(f: (value: T) => U): Result<U, E> {
		return new Ok(f(this.value));
	}

	mapErr<O>(_: (value: E) => O): Result<T, O> {
		return new Ok(this.value);
	}

	mapOrDefault<U>(defaultValue: U): Result<T | U, never>;
	mapOrDefault<U>(defaultFunc: (err: E) => U): Result<T | U, never>;
	mapOrDefault<U>(_: U | ((err: E) => U)): Result<T | U, never> {
		return new Ok(this.value);
	}

	toAsync(): AsyncResult<T, E> {
		return new AsyncResult(Promise.resolve(this));
	}
}

export class Err<T, E> implements BaseResult<T, E> {
	error: E;
	constructor(value: E) {
		this.error = value;
	}

	ok(): this is Ok<T, E> {
		return false;
	}

	err(): this is Err<T, E> {
		return true;
	}

	unwrap(): T {
		throw new Error('Called `unwrap` on an `Err` value.');
	}

	unwrapErr(): E {
		return this.error;
	}

	unwrapOr(defaultValue: T): T {
		return defaultValue;
	}

	andThen<U, O>(_: (value: T) => Result<U, O>): Result<U, E | O> {
		return new Err(this.error);
	}

	orElse<U, O>(f: (value: E) => Result<U, O>): Result<T | U, O> {
		try {
			return f(this.error);
		} catch (e) {
			return new Err(e as O);
		}
	}

	map<U>(_: (value: T) => U): Result<U, E> {
		return new Err(this.error);
	}

	mapErr<O>(f: (value: E) => O): Result<T, O> {
		return new Err(f(this.error));
	}

	mapOrDefault<U>(defaultValue: U): Result<T | U, never>;
	mapOrDefault<U>(defaultFunc: (err: E) => U): Result<T | U, never>;
	mapOrDefault<U>(d: U | ((err: E) => U)): Result<T | U, never> {
		if (typeof d === 'function') {
			// @ts-ignore - d is a function
			return new Ok(d(this.error));
		}
		return new Ok(d);
	}

	toAsync(): AsyncResult<T, E> {
		return new AsyncResult(Promise.resolve(this));
	}
}

export type Result<T, E> = Ok<T, E> | Err<T, E>;

export namespace Result {
	export function ok<T, E>(value: T): Result<T, E> {
		return new Ok(value);
	}

	export function err<T, E>(value: E): Result<T, E> {
		return new Err(value);
	}

	/**
	 *  Creates a new `Result` from a function that may throw.
	 */
	export function from<T, E>(fn: () => T): Result<T, E> {
		try {
			return ok(fn());
		} catch (e) {
			return err(e as E);
		}
	}

	/**
	 *  Creates a new `Result` from a function that may return a promise.
	 */
	export function fromAsync<T, E>(
		fn: () => Promise<T>,
		mapErr?: (reason: unknown) => E
	): AsyncResult<T, E> {
		try {
			return new AsyncResult(
				fn()
					.then((value) => ok<T, E>(value))
					.catch((reason) => err<T, E>(mapErr ? mapErr(reason) : reason))
			);
		} catch (e) {
			return new AsyncResult(Promise.reject(e as E));
		}
	}
}

export class AsyncResult<T, E> implements PromiseLike<Result<T, E>> {
	#promise: Promise<Result<T, E>>;

	constructor(promise: Promise<Result<T, E>>) {
		this.#promise = promise;
	}

	map<U>(f: (value: T) => U | Promise<U>): AsyncResult<U, E> {
		return new AsyncResult(
			this.#promise.then(async (result) => {
				if (result.ok()) {
					return new Ok(await f(result.value));
				}

				return new Err(result.error);
			})
		);
	}

	mapErr<O>(f: (value: E) => O | PromiseLike<O>): AsyncResult<T, O> {
		return new AsyncResult(
			this.#promise.then(async (result) => {
				if (result.ok()) {
					return new Ok(result.value);
				}

				return new Err(await f(result.error));
			})
		);
	}

	andThen<U, O>(f: (value: T) => Result<U, O> | AsyncResult<U, O>): AsyncResult<U, E | O> {
		return new AsyncResult(
			this.#promise.then(async (result) => {
				if (result.ok()) {
					const newResult = f(result.value);
					if (newResult instanceof AsyncResult) {
						return newResult.#promise;
					}
					return newResult;
				}

				return new Err(result.error);
			})
		);
	}

	orElse<U, O>(f: (value: E) => Result<U, O> | AsyncResult<U, O>): AsyncResult<T | U, O> {
		return new AsyncResult(
			this.#promise.then(async (result) => {
				if (result.ok()) {
					return new Ok(result.value);
				}

				const newResult = f(result.error);
				if (newResult instanceof AsyncResult) {
					return newResult.#promise;
				}
				return newResult;
			})
		);
	}

	mapOrDefault<U>(defaultValue: U): AsyncResult<T | U, never>;
	mapOrDefault<U>(defaultFunc: (err: E) => U): AsyncResult<T | U, never>;
	mapOrDefault<U>(d: U | ((err: E) => U)): AsyncResult<T | U, never> {
		return new AsyncResult(
			this.#promise.then(async (result) => {
				if (result.ok()) {
					return new Ok(result.value);
				}
				if (typeof d === 'function') {
					// @ts-ignore - d is a function
					return new Ok(d(result.error));
				}

				return new Ok(d);
			})
		);
	}

	then<P, Q>(
		onfulfilled?: (value: Result<T, E>) => P | PromiseLike<P>,
		onrejected?: (reason: unknown) => Q | PromiseLike<Q>
	): PromiseLike<P | Q> {
		return this.#promise.then(onfulfilled, onrejected);
	}
}
