interface BaseResult<T, E> {
  ok(): boolean;
  err(): boolean;
  unwrap(): T;
  unwrapErr(): E;
}

export class Ok<T, E = never> implements BaseResult<T, E> {
  constructor(public value: T) {}

  ok(): this is Ok<T, E> {
    return true;
  }

  err(): this is Err<E, T> {
    return false;
  }

  unwrap(): T {
    return this.value;
  }

  unwrapErr(): E {
    throw new Error("called `unwrapErr` on an `Ok` value");
  }
}

export class Err<E, T = never> implements BaseResult<T, E> {
  constructor(public error: E) {}

  ok(): this is Ok<T, E> {
    return false;
  }

  err(): this is Err<E, T> {
    return true;
  }

  unwrap(): T {
    throw new Error("called `unwrap` on an `Err` value");
  }

  unwrapErr(): E {
    return this.error;
  }
}

export type Result<T, E> = Ok<T, E> | Err<E, T>;
