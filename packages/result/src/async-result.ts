import { Ok, Err, type Result } from "./result.ts";

export class AsyncResult<T, E = unknown> {
  constructor(public promise: Promise<Result<T, E>>) {}
}

async function wrapPromise<T, E>(
  p: Promise<T>,
  onError: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const result = await p;
    return new Ok(result);
  } catch (e) {
    return new Err(onError(e));
  }
}
export function fromThrowable<T extends Promise<unknown>, E>(
  promise: T,
  onError: (error: unknown) => E,
): AsyncResult<T, E>;
export function fromThrowable<T, E>(
  promise: () => Promise<T>,
  onError: (error: unknown) => E,
): AsyncResult<T, E>;
export function fromThrowable<T, E>(
  promise: Promise<T> | (() => Promise<T>),
  onError: (error: unknown) => E,
): AsyncResult<T, E> {
  let p: Promise<T>;
  if (typeof promise === "function") {
    try {
      p = promise();
    } catch (e) {
      const err = new Err(onError(e));
      return new AsyncResult(Promise.resolve(err));
    }
  } else {
    p = promise;
  }
  return new AsyncResult(wrapPromise(p, onError));
}

async function mapWrap<T, U, E>(
  result: AsyncResult<T, E>,
  f: (value: T) => U | Promise<U>,
): Promise<Result<U, E>> {
  const r = await result.promise;
  return r instanceof Ok ? new Ok(await f(r.value)) : (r as Err<E, never>);
}
export function map<T, U, E>(
  result: AsyncResult<T, E>,
  f: (value: T) => U | Promise<U>,
): AsyncResult<U, E>;
export function map<T, U, E>(
  f: (value: T) => U | Promise<U>,
): (result: AsyncResult<T, E>) => AsyncResult<U, E>;
export function map<T, U, E>(
  resultOrFn: AsyncResult<T, E> | ((value: T) => U | Promise<U>),
  maybeFn?: (value: T) => U | Promise<U>,
): AsyncResult<U, E> | ((result: AsyncResult<T, E>) => AsyncResult<U, E>) {
  // Binary form: map(result, fn)
  if (maybeFn !== undefined) {
    const result = resultOrFn as AsyncResult<T, E>;
    const f = maybeFn;
    return new AsyncResult(mapWrap(result, f));
  }

  // Curried form: map(fn)(result)
  const f = resultOrFn as (value: T) => U | Promise<U>;
  return (result: AsyncResult<T, E>): AsyncResult<U, E> => {
    return new AsyncResult(mapWrap(result, f));
  };
}

async function andThenWrap<T1, T2, E1, E2>(
  result: AsyncResult<T1, E1>,
  f: (
    value: T1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>,
): Promise<Result<T2, E1 | E2>> {
  const r = await result.promise;
  if (r instanceof Ok) {
    const next = f(r.value);
    if (next instanceof AsyncResult) {
      return await next.promise;
    } else if (next instanceof Ok || next instanceof Err) {
      return next;
    } else {
      return await next;
    }
  }
  return r as Err<E1, never>;
}

export function andThen<T1, T2, E1, E2>(
  result: AsyncResult<T1, E1>,
  f: (
    value: T1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>,
): AsyncResult<T2, E1 | E2>;
export function andThen<T1, T2, E1, E2>(
  f: (
    value: T1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>,
): (result: AsyncResult<T1, E1>) => AsyncResult<T2, E1 | E2>;
export function andThen<T1, T2, E1, E2>(
  resultOrFn:
    | AsyncResult<T1, E1>
    | ((
        value: T1,
      ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>),
  maybeFn?: (
    value: T1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>,
):
  | AsyncResult<T2, E1 | E2>
  | ((result: AsyncResult<T1, E1>) => AsyncResult<T2, E1 | E2>) {
  // Binary form: andThen(result, fn)
  if (maybeFn !== undefined) {
    const result = resultOrFn as AsyncResult<T1, E1>;
    const f = maybeFn;
    return new AsyncResult(andThenWrap(result, f));
  }

  // Curried form: andThen(fn)(result)
  const f = resultOrFn as (
    value: T1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>;
  return (result: AsyncResult<T1, E1>): AsyncResult<T2, E1 | E2> => {
    return new AsyncResult(andThenWrap(result, f));
  };
}

async function orElseWrap<T1, T2, E1, E2>(
  result: AsyncResult<T1, E1>,
  f: (
    error: E1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>,
): Promise<Result<T1 | T2, E2>> {
  const r = await result.promise;
  if (r instanceof Err) {
    const next = f(r.error);
    if (next instanceof AsyncResult) {
      return await next.promise;
    } else if (next instanceof Ok || next instanceof Err) {
      return next;
    } else {
      return await next;
    }
  }
  return r as Ok<T1, never>;
}

export function orElse<T1, T2, E1, E2>(
  result: AsyncResult<T1, E1>,
  f: (
    error: E1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>,
): AsyncResult<T1 | T2, E2>;
export function orElse<T1, T2, E1, E2>(
  f: (
    error: E1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>,
): (result: AsyncResult<T1, E1>) => AsyncResult<T1 | T2, E2>;
export function orElse<T1, T2, E1, E2>(
  resultOrFn:
    | AsyncResult<T1, E1>
    | ((
        error: E1,
      ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>),
  maybeFn?: (
    error: E1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>,
):
  | AsyncResult<T1 | T2, E2>
  | ((result: AsyncResult<T1, E1>) => AsyncResult<T1 | T2, E2>) {
  // Binary form: orElse(result, fn)
  if (maybeFn !== undefined) {
    const result = resultOrFn as AsyncResult<T1, E1>;
    const f = maybeFn;
    return new AsyncResult(orElseWrap(result, f));
  }

  // Curried form: orElse(fn)(result)
  const f = resultOrFn as (
    error: E1,
  ) => Result<T2, E2> | AsyncResult<T2, E2> | Promise<Result<T2, E2>>;
  return (result: AsyncResult<T1, E1>): AsyncResult<T1 | T2, E2> => {
    return new AsyncResult(orElseWrap(result, f));
  };
}

async function matchWrap<T, E, U>(
  result: AsyncResult<T, E>,
  ok: (value: T) => U | Promise<U>,
  err: (error: E) => U | Promise<U>,
): Promise<U> {
  const r = await result.promise;
  if (r instanceof Ok) {
    return await ok(r.value);
  } else {
    return await err(r.error);
  }
}

export function match<T, E, U>(
  result: AsyncResult<T, E>,
  ok: (value: T) => U | Promise<U>,
  err: (error: E) => U | Promise<U>,
): Promise<U>;
export function match<T, E, U>(
  ok: (value: T) => U | Promise<U>,
  err: (error: E) => U | Promise<U>,
): (result: AsyncResult<T, E>) => Promise<U>;
export function match<T, E, U>(
  okOrResult: ((value: T) => U | Promise<U>) | AsyncResult<T, E>,
  errOrOk?: ((error: E) => U | Promise<U>) | ((value: T) => U | Promise<U>),
  maybeErr?: (error: E) => U | Promise<U>,
): Promise<U> | ((result: AsyncResult<T, E>) => Promise<U>) {
  // Binary form: match(result, okFn, errFn)
  if (maybeErr !== undefined) {
    const result = okOrResult as AsyncResult<T, E>;
    const ok = errOrOk as (value: T) => U | Promise<U>;
    const err = maybeErr;
    return matchWrap(result, ok, err);
  }

  // Curried form: match(okFn, errFn)(result)
  const ok = okOrResult as (value: T) => U | Promise<U>;
  const err = errOrOk as (error: E) => U | Promise<U>;
  return (result: AsyncResult<T, E>): Promise<U> => {
    return matchWrap(result, ok, err);
  };
}
