interface BaseResult<T, E> {
  ok(): boolean;
  err(): boolean;
  unwrap(): T;
  unwrapErr(): E;
  unwrapOr(defaultValue: T): T;
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

  unwrapOr(_: T): T {
    return this.value;
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

  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }
}

export type Result<T, E> = Ok<T, E> | Err<E, T>;

export function map<T, U, E>(
  f: (value: T) => U,
): (result: Result<T, E>) => Result<U, E> {
  return (result: Result<T, E>): Result<U, E> => {
    return result instanceof Ok
      ? new Ok(f(result.value))
      : (result as Err<E, never>);
  };
}

export function mapErr<T, U, E>(
  f: (error: E) => U,
): (result: Result<T, E>) => Result<T, U> {
  return (result: Result<T, E>): Result<T, U> => {
    return result instanceof Err
      ? new Err(f(result.error))
      : (result as Ok<T, never>);
  };
}

export function andThen<T1, T2, E1, E2>(
  f: (value: T1) => Result<T2, E2>,
): (result: Result<T1, E1>) => Result<T2, E1 | E2> {
  return (result: Result<T1, E1>): Result<T2, E1 | E2> => {
    return result instanceof Ok ? f(result.value) : (result as Err<E1, never>);
  };
}

export function orElse<T1, T2, E1, E2>(
  f: (error: E1) => Result<T2, E2>,
): (result: Result<T1, E1>) => Result<T1 | T2, E2> {
  return (result: Result<T1, E1>): Result<T1 | T2, E2> => {
    return result instanceof Err ? f(result.error) : (result as Ok<T1, never>);
  };
}

export function match<T, E, U>(
  ok: (value: T) => U,
  err: (error: E) => U,
): (result: Result<T, E>) => U {
  return (result: Result<T, E>): U => {
    return result instanceof Ok ? ok(result.value) : err(result.error);
  };
}
