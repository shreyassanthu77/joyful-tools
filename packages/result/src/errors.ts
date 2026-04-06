import type { Err, Ok } from "./result.ts";

type NoFields = Record<PropertyKey, never>;

type TaggedErrorArgs<Fields extends object> = keyof Fields extends never
  ? [init?: TaggedErrorInit<Fields>]
  : [init: TaggedErrorInit<Fields>];

/**
 * Initialization data for a tagged error.
 *
 * `message` and `cause` are treated like normal `Error` fields. Any remaining
 * properties are copied onto the created error instance.
 */
export type TaggedErrorInit<Fields extends object = NoFields> = Fields & {
  message?: string;
  cause?: unknown;
};

/**
 * An `Error` with a fixed `_tag` discriminator and typed custom fields.
 */
export type TaggedError<
  Tag extends string,
  Fields extends object = NoFields,
> = Error & Readonly<{ _tag: Tag } & Fields>;

/**
 * Constructor returned by {@link taggedError}.
 */
export interface TaggedErrorClass<
  Tag extends string,
  Fields extends object = NoFields,
> {
  new (...args: TaggedErrorArgs<Fields>): TaggedError<Tag, Fields>;
  readonly prototype: TaggedError<Tag, Fields>;
}

/**
 * Generic class factory returned by {@link taggedError}.
 */
export interface TaggedErrorFactory<Tag extends string> {
  new <Fields extends object = NoFields>(
    ...args: TaggedErrorArgs<Fields>
  ): TaggedError<Tag, Fields>;
  readonly prototype: Error & { readonly _tag: Tag };
}

/**
 * Creates an `Error` subclass with a fixed `_tag` and typed custom fields.
 *
 * The generated constructor accepts a single object containing your domain
 * fields plus optional `message` and `cause` properties. `message` defaults to
 * the provided tag.
 *
 * @example
 * ```typescript
 * class JsonParseError extends taggedError("JsonParseError")<{
 *   input: string;
 * }> {}
 *
 * const error = new JsonParseError({
 *   input: "not json",
 *   message: "Failed to parse JSON",
 *   cause: new SyntaxError("Unexpected token"),
 * });
 * ```
 */
export function taggedError<Tag extends string = string>(
  tag: Tag,
): TaggedErrorFactory<Tag> {
  class TaggedResultError extends Error {
    readonly _tag = tag;

    constructor(...args: TaggedErrorArgs<NoFields>) {
      const init = args[0];
      const { message, cause } = (init ?? {}) as TaggedErrorInit<object>;

      super(message ?? tag, { cause });
      this.name = tag;

      if (init) {
        const fields = { ...init } as Record<string, unknown>;
        delete fields._tag;
        delete fields.name;
        delete fields.stack;
        delete fields.message;
        delete fields.cause;
        Object.assign(this, fields);
      }
    }
  }

  return TaggedResultError as unknown as TaggedErrorFactory<Tag>;
}

export type MatchableError = Error & { readonly _tag: string };
// deno-lint-ignore no-explicit-any
type AnyFn = (...args: any[]) => unknown;
type SyncResult<T, E> = Ok<T, E> | Err<T, E>;
type ResolvedMatchResult<T> = T extends PromiseLike<infer U>
  ? ResolvedMatchResult<U>
  : T;

export type MatchReturn<Handlers> = ReturnType<
  Extract<Handlers[keyof Handlers], AnyFn>
>;

export type MatchHandlers<E extends MatchableError> = {
  [K in E["_tag"]]: (error: Extract<E, { _tag: K }>) => unknown;
};

export type MatchValueHandlers<E extends MatchableError, R> = {
  [K in E["_tag"]]: (error: Extract<E, { _tag: K }>) => R;
};

export type MatchResultHandlers<E extends MatchableError> = {
  [K in E["_tag"]]: (error: Extract<E, { _tag: K }>) => SyncResult<any, any>;
};

export type MatchSomeResultHandlers<E extends MatchableError> = Partial<
  MatchResultHandlers<E>
>;

export type MatchResultValue<Handlers> = MatchReturn<Handlers> extends SyncResult<
  infer T,
  unknown
> ? T
  : never;

export type MatchResultError<Handlers> = MatchReturn<Handlers> extends SyncResult<
  unknown,
  infer E
> ? E
  : never;

export type MatchAsyncResultHandlers<E extends MatchableError> = {
  [K in E["_tag"]]: (error: Extract<E, { _tag: K }>) =>
    | SyncResult<any, any>
    | PromiseLike<SyncResult<any, any>>;
};

export type MatchSomeAsyncResultHandlers<E extends MatchableError> = Partial<
  MatchAsyncResultHandlers<E>
>;

export type MatchAsyncResultValue<Handlers> = ResolvedMatchResult<
  MatchReturn<Handlers>
> extends SyncResult<infer T, unknown> ? T
  : never;

export type MatchAsyncResultError<Handlers> = ResolvedMatchResult<
  MatchReturn<Handlers>
> extends SyncResult<unknown, infer E> ? E
  : never;

export type RemainingMatchErrors<
  E extends MatchableError,
  Handlers extends Partial<Record<string, unknown>>,
> = Exclude<E, { _tag: Extract<keyof Handlers, string> }>;

/**
 * Matches a tagged error result against a complete set of handlers.
 *
 * Each handler key must match one `_tag` in the error union. The selected
 * handler receives the corresponding narrowed error type, and the return type
 * is inferred as the union of all handler return types.
 *
 * @param error Failed result containing a tagged error.
 * @param handlers Mapping from `_tag` values to handler functions.
 * @returns The value returned by the matching handler.
 *
 * @example
 * ```typescript
 * class ValidationError extends taggedError("ValidationError")<{
 *   field: string;
 * }> {}
 * class NetworkError extends taggedError("NetworkError")<{
 *   status: number;
 * }> {}
 *
 * const result = new Err<never, ValidationError | NetworkError>(
 *   new NetworkError({ status: 503 }),
 * );
 *
 * const message = matchError(result, {
 *   ValidationError: (error) => `invalid:${error.field}`,
 *   NetworkError: (error) => `retry:${error.status}`,
 * });
 * ```
 */
export function matchError<
  const E extends MatchableError,
  const Handlers extends MatchHandlers<E>,
>(error: Err<unknown, E>, handlers: Handlers): MatchReturn<Handlers> {
  const handler = handlers[error.error._tag as E["_tag"]] as unknown as (
    error: E,
  ) => MatchReturn<Handlers>;

  return handler(error.error);
}

/**
 * Matches a tagged error result against a partial set of handlers.
 *
 * If no handler exists for the current `_tag`, `orElse` is called. The return
 * type is inferred as the union of the provided handler return types and the
 * fallback return type.
 *
 * @param error Failed result containing a tagged error.
 * @param handlers Partial mapping from `_tag` values to handler functions.
 * @param orElse Fallback used when no handler matches the current `_tag`.
 * @returns The value returned by the matching handler or the fallback.
 *
 * @example
 * ```typescript
 * class ValidationError extends taggedError("ValidationError")<{
 *   field: string;
 * }> {}
 * class NetworkError extends taggedError("NetworkError")<{
 *   status: number;
 * }> {}
 *
 * const result = new Err<never, ValidationError | NetworkError>(
 *   new NetworkError({ status: 503 }),
 * );
 *
 * const message = matchErrorPartial(
 *   result,
 *   {
 *     ValidationError: (error) => `invalid:${error.field}`,
 *   },
 *   () => "default",
 * );
 * ```
 */
export function matchErrorPartial<
  const E extends MatchableError,
  const Handlers extends Partial<MatchHandlers<E>>,
  OrElse,
>(
  error: Err<unknown, E>,
  handlers: Handlers,
  orElse: () => OrElse,
): MatchReturn<Handlers> | OrElse {
  const handler = handlers[error.error._tag as E["_tag"]] as unknown as
    | ((error: E) => MatchReturn<Handlers>)
    | undefined;

  if (!handler) return orElse();

  return handler(error.error);
}
