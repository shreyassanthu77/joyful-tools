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
}
