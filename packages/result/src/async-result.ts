import { Ok, Err, type Result } from "./result.ts";

export interface AsyncResult<T, E = unknown> extends PromiseLike<Result<T, E>> {
  readonly promise: Promise<Result<T, E>>;
}

class AsyncResultImpl<T, E = unknown> implements AsyncResult<T, E> {
  constructor(public promise: Promise<Result<T, E>>) {}

  then<P, Q>(
    onfulfilled?: (value: Result<T, E>) => P | PromiseLike<P>,
    onrejected?: (reason: unknown) => Q | PromiseLike<Q>,
  ): PromiseLike<P | Q> {
    return this.promise.then(onfulfilled, onrejected);
  }
}

export function fromResult<T, E>(result: Result<T, E>): AsyncResult<T, E> {
  return new AsyncResultImpl(Promise.resolve(result));
}

function onErrorNoop<E>(error: unknown): E {
  return error as E;
}

async function fromPromise<T, E>(
  promiseFactory: () => T | Promise<T>,
  onError: (error: unknown) => E = onErrorNoop,
): Promise<Result<T, E>> {
  try {
    const promise = promiseFactory();
    if (promise instanceof Promise) {
      const result = await promise;
      return new Ok(result);
    } else {
      return new Ok(promise);
    }
  } catch (e) {
    return new Err(onError(e));
  }
}

export function fromThrowable<T, E>(
  fn: () => T | Promise<T>,
  onError?: (error: unknown) => E,
): AsyncResult<T, E> {
  return new AsyncResultImpl(fromPromise(fn, onError));
}

async function mapInner<T, U, E>(
  result: Result<T, E> | AsyncResult<T, E>,
  f: (value: T) => U | Promise<U>,
): Promise<Result<U, E>> {
  const value =
    result instanceof AsyncResultImpl
      ? await (result as AsyncResultImpl<T, E>).promise
      : (result as Result<T, E>);
  if (value instanceof Err) return value as Err<E, never>;
  const mapped = f(value.value);
  if (mapped instanceof Promise) {
    return new Ok(await mapped);
  }
  return new Ok(mapped);
}

export function map<T, U, E>(
  result: Result<T, E> | AsyncResult<T, E>,
  f: (value: T) => U | Promise<U>,
): AsyncResult<U, E>;
export function map<T, U, E>(
  f: (value: T) => U | Promise<U>,
): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<U, E>;
export function map<T, U, E>(
  resultOrFn: Result<T, E> | AsyncResult<T, E> | ((value: T) => U | Promise<U>),
  maybeFn?: (value: T) => U | Promise<U>,
):
  | AsyncResult<U, E>
  | ((result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<U, E>) {
  if (maybeFn !== undefined) {
    const result = resultOrFn as AsyncResult<T, E>;
    const f = maybeFn;
    return new AsyncResultImpl(mapInner(result, f));
  }

  return (result: Result<T, E> | AsyncResult<T, E>): AsyncResult<U, E> => {
    return new AsyncResultImpl(mapInner(result, resultOrFn as (value: T) => U));
  };
}

async function mapErrInner<T, U, E>(
  result: Result<T, E> | AsyncResult<T, E>,
  f: (error: E) => U | Promise<U>,
): Promise<Result<T, U>> {
  const value =
    result instanceof AsyncResultImpl
      ? await (result as AsyncResultImpl<T, E>).promise
      : (result as Result<T, E>);
  if (value instanceof Ok) return value as Ok<T, never>;
  const mapped = f(value.error);
  if (mapped instanceof Promise) {
    return new Err(await mapped);
  }
  return new Err(mapped);
}

export function mapErr<T, U, E>(
  result: Result<T, E> | AsyncResult<T, E>,
  f: (error: E) => U | Promise<U>,
): AsyncResult<T, U>;
export function mapErr<T, U, E>(
  f: (error: E) => U | Promise<U>,
): (result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<T, U>;
export function mapErr<T, U, E>(
  resultOrFn: Result<T, E> | AsyncResult<T, E> | ((error: E) => U | Promise<U>),
  maybeFn?: (error: E) => U | Promise<U>,
):
  | AsyncResult<T, U>
  | ((result: Result<T, E> | AsyncResult<T, E>) => AsyncResult<T, U>) {
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T, E> | AsyncResult<T, E>;
    const f = maybeFn;
    return new AsyncResultImpl(mapErrInner(result, f));
  }

  return (result: Result<T, E> | AsyncResult<T, E>): AsyncResult<T, U> => {
    return new AsyncResultImpl(
      mapErrInner(result, resultOrFn as (error: E) => U),
    );
  };
}

async function andThenInner<T1, T2, E1, E2>(
  result: Result<T1, E1> | AsyncResult<T1, E1>,
  f: (value: T1) => AsyncResult<T2, E2>,
): Promise<Result<T2, E1 | E2>> {
  const value =
    result instanceof AsyncResultImpl
      ? await (result as AsyncResultImpl<T1, E1>).promise
      : (result as Result<T1, E1>);
  if (value instanceof Err) return value as Err<E1, never>;
  const mapped = f(value.value);
  return mapped.promise;
}

export function andThen<T1, T2, E1, E2>(
  result: Result<T1, E1> | AsyncResult<T1, E1>,
  f: (value: T1) => AsyncResult<T2, E2>,
): AsyncResult<T2, E1 | E2>;
export function andThen<T1, T2, E1, E2>(
  f: (value: T1) => AsyncResult<T2, E2>,
): (result: Result<T1, E1> | AsyncResult<T1, E1>) => AsyncResult<T2, E1 | E2>;
export function andThen<T1, T2, E1, E2>(
  resultOrFn:
    | Result<T1, E1>
    | AsyncResult<T1, E1>
    | ((value: T1) => AsyncResult<T2, E2>),
  maybeFn?: (value: T1) => AsyncResult<T2, E2>,
):
  | AsyncResult<T2, E1 | E2>
  | ((
      result: Result<T1, E1> | AsyncResult<T1, E1>,
    ) => AsyncResult<T2, E1 | E2>) {
  if (maybeFn !== undefined) {
    const result = resultOrFn as Result<T1, E1> | AsyncResult<T1, E1>;
    const f = maybeFn;
    return new AsyncResultImpl(andThenInner(result, f));
  }

  return (
    result: Result<T1, E1> | AsyncResult<T1, E1>,
  ): AsyncResult<T2, E1 | E2> => {
    return new AsyncResultImpl(
      andThenInner(result, resultOrFn as (value: T1) => AsyncResult<T2, E2>),
    );
  };
}
