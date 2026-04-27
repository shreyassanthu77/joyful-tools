import type { Err, Result } from "@joyful/result";
import type { TaskRun } from "./main.ts";

/** A result value or promise-like result produced by a task. */
export type MaybeResult<T, E> = Result<T, E> | PromiseLike<Result<T, E>>;

/** Values that task combinators can flatten into a result. */
export type Taskish<T, E> =
  | TaskRun<T, E>
  | Result<T, E>
  | PromiseLike<Result<T, E>>;

/** Extracts the result tuple produced by {@link Task.all} for arrays. */
export type TaskResultArray<
  Tasks extends readonly TaskRun<unknown, unknown>[],
> = {
  [I in keyof Tasks]: Tasks[I] extends TaskRun<infer T, infer E> ? Result<T, E>
    : never;
};

/** Extracts the result record produced by {@link Task.all} for records. */
export type TaskResultRecord<
  Tasks extends Record<string, TaskRun<unknown, unknown>>,
> = {
  [I in keyof Tasks]: Tasks[I] extends TaskRun<infer T, infer E> ? Result<T, E>
    : never;
};

/** Error type that supports `_tag`-based matching. */
export type MatchableError = Error & { readonly _tag: string };

/** Exhaustive tagged-error handlers for {@link Task.orElseMatch}. */
export type MatchHandlers<E extends MatchableError> = {
  [K in E["_tag"]]: (
    error: Extract<E, { _tag: K }>,
  ) => Taskish<unknown, unknown>;
};

/** Partial tagged-error handlers for {@link Task.orElseMatchSome}. */
export type MatchSomeHandlers<E extends MatchableError> = Partial<
  MatchHandlers<E>
>;

/** Extracts success values returned by tagged-error handlers. */
export type MatchResultValue<Handlers> = {
  [K in keyof Handlers]: Handlers[K] extends (...args: never[]) => Taskish<
    infer T,
    unknown
  > ? T
    : never;
}[keyof Handlers];

/** Extracts error values returned by tagged-error handlers. */
export type MatchResultError<Handlers> = {
  [K in keyof Handlers]: Handlers[K] extends (...args: never[]) => Taskish<
    unknown,
    infer E
  > ? E
    : never;
}[keyof Handlers];

/** Removes tagged errors handled by {@link Task.orElseMatchSome}. */
export type RemainingMatchErrors<
  E extends MatchableError,
  Handlers,
> = Exclude<E, { _tag: keyof Handlers }>;

/** Error type produced by {@link Task.orElseMatchSome}. */
export type MatchSomeResultError<E, Handlers> =
  | (E extends MatchableError ? RemainingMatchErrors<E, Handlers> : E)
  | MatchResultError<Handlers>;

/** Extracts the error type yielded by a workflow iterator. */
export type WorkflowError<E extends Err<never, unknown>> = E extends
  Err<never, infer Error> ? Error
  : never;
