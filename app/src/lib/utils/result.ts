interface BaseResult<T, E> {
	ok(): boolean;
	err(): boolean;
	unwrap(): T;
	unwrapErr(): E;
}

export class Ok<T, E = never> implements BaseResult<T, E> {
	constructor(public value: T) {}

	ok(): boolean {
		return true;
	}

	err(): boolean {
		return false;
	}

	unwrap(): T {
		return this.value;
	}

	unwrapErr(): E {
		throw new Error('called `unwrapErr` on an `Ok` value');
	}
}

export class Err<E, T = never> implements BaseResult<T, E> {
	constructor(public error: E) {}

	ok(): boolean {
		return false;
	}

	err(): boolean {
		return true;
	}

	unwrap(): T {
		throw new Error('called `unwrap` on an `Err` value');
	}

	unwrapErr(): E {
		return this.error;
	}
}

export type Result<T, E> = Ok<T, E> | Err<E, T>;

export class AsyncResult<T, E> implements PromiseLike<Result<T, E>> {
	_promise: Promise<Result<T, E>>;

	constructor(promise: Promise<Result<T, E>>) {
		this._promise = promise;
	}

	then<P, Q>(
		onfulfilled?: (value: Result<T, E>) => P | PromiseLike<P>,
		onrejected?: (reason: any) => Q | PromiseLike<Q>
	): PromiseLike<P | Q> {
		return this._promise.then(onfulfilled, onrejected);
	}
}

export type ResultData<T> =
	T extends Result<infer U, unknown> ? U : T extends AsyncResult<infer U, unknown> ? U : never;
export type ResultError<T> =
	T extends Result<unknown, infer E> ? E : T extends AsyncResult<unknown, infer E> ? E : never;

export namespace Result {
	export function from<T, E = unknown>(f: () => T): Result<T, E> {
		try {
			return new Ok(f());
		} catch (e) {
			return new Err(e as E);
		}
	}

	export function map<T, E, U>(f: (value: T) => U): (result: Result<T, E>) => Result<U, E> {
		return (result) => {
			if (result instanceof Ok) {
				return new Ok(f(result.value));
			}
			return new Err(result.error);
		};
	}

	export function mapErr<T, E, F>(f: (error: E) => F): (result: Result<T, E>) => Result<T, F> {
		return (result) => {
			if (result instanceof Ok) {
				return new Ok(result.value);
			}
			return new Err(f(result.error));
		};
	}

	export function andThen<T1, E1, T2, E2>(
		f: (value: T1) => Result<T2, E2>
	): (result: Result<T1, E1>) => Result<T2, E1 | E2> {
		return (result) => {
			if (result instanceof Ok) {
				return f(result.value);
			}
			return new Err(result.error);
		};
	}

	export function orElse<T1, E1, T2, E2>(
		f: (error: E1) => Result<T2, E2>
	): (result: Result<T1, E1>) => Result<T1 | T2, E2> {
		return (result) => {
			if (result instanceof Ok) {
				return new Ok(result.value);
			}
			return f(result.error);
		};
	}

	export function mapAsync<T, E, U>(
		f: (value: T) => Promise<U>
	): (result: Result<T, E>) => AsyncResult<U, E>;
	export function mapAsync<T, E, U>(
		f: (value: T) => U | Promise<U>
	): (result: AsyncResult<T, E>) => AsyncResult<U, E>;
	export function mapAsync<T, E, U>(
		f: (value: T) => U | Promise<U>
	): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<U, E> {
		return (result) => {
			if (result instanceof AsyncResult) {
				return new AsyncResult(
					result._promise
						.then(async (r) => {
							if (r instanceof Err) {
								return new Err(r.error);
							}
							const value = await f(r.value);
							return new Ok(value);
						})
						.catch((e) => new Err(e))
				);
			}

			if (result instanceof Ok) {
				const value = f(result.value);
				if (value instanceof Promise) {
					return new AsyncResult(value.then((value) => new Ok(value)).catch((e) => new Err(e)));
				}
				return new AsyncResult(Promise.resolve(new Ok(value)));
			}

			return new AsyncResult(Promise.resolve(new Err(result.error)));
		};
	}

	export function mapErrAsync<T, E, F>(
		f: (error: E) => Promise<F>
	): (result: Result<T, E>) => AsyncResult<T, F>;
	export function mapErrAsync<T, E, F>(
		f: (error: E) => F | Promise<F>
	): (result: AsyncResult<T, E>) => AsyncResult<T, F>;
	export function mapErrAsync<T, E, F>(
		f: (error: E) => F | Promise<F>
	): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<T, F> {
		return (result) => {
			if (result instanceof AsyncResult) {
				return new AsyncResult(
					result._promise
						.then(async (r) => {
							if (r instanceof Ok) {
								return new Ok(r.value);
							}
							const error = await f(r.error);
							return new Err(error);
						})
						.catch((e) => new Err(e))
				);
			}

			if (result instanceof Ok) {
				return new AsyncResult(Promise.resolve(new Ok(result.value)));
			}

			const error = f(result.error);
			if (error instanceof Promise) {
				return new AsyncResult(error.then((error) => new Err(error)).catch((e) => new Err(e)));
			}
			return new AsyncResult(Promise.resolve(new Err(error)));
		};
	}
}
