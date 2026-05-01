import type { Err, Ok } from "./result.ts";

// deno-lint-ignore no-empty-interface
interface NoFields {}

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

interface YieldableTaggedError {
  [Symbol.iterator](): Generator<this, never, unknown>;
}

/**
 * An `Error` with a fixed `_tag` discriminator and typed custom fields.
 */
export type TaggedError<
  Tag extends string,
  Fields extends object = NoFields,
> = Error & Readonly<{ _tag: Tag } & Fields> & YieldableTaggedError;

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
  readonly prototype: Error & { readonly _tag: Tag } & YieldableTaggedError;
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

    *[Symbol.iterator](): Generator<this, never, unknown> {
      yield this;
      throw "unreachable";
    }
  }

  return TaggedResultError as unknown as TaggedErrorFactory<Tag>;
}

export type MatchableError = Error & { readonly _tag: string };

type SyncResult<T, E> = Ok<T, E> | Err<T, E>;
type Resolved<T> = T extends PromiseLike<infer U> ? Resolved<U> : T;

export type MatchHandlers<E extends MatchableError> = {
  // deno-lint-ignore no-explicit-any
  [K in E["_tag"]]: (error: Extract<E, { _tag: K }>) => any;
};

export type MatchSomeHandlers<E extends MatchableError> = Partial<
  MatchHandlers<E>
>;

export type MatchResultValue<Handlers> = {
  [K in keyof Handlers]: Handlers[K] extends // deno-lint-ignore no-explicit-any
  (...args: any[]) => infer R
    // deno-lint-ignore no-explicit-any
    ? Resolved<R> extends SyncResult<infer T, any> ? T
    : never
    : never;
}[keyof Handlers];

export type MatchResultError<Handlers> = {
  [K in keyof Handlers]: Handlers[K] extends // deno-lint-ignore no-explicit-any
  (...args: any[]) => infer R
    // deno-lint-ignore no-explicit-any
    ? Resolved<R> extends SyncResult<any, infer E> ? E
    : never
    : never;
}[keyof Handlers];

export type RemainingMatchErrors<
  E extends MatchableError,
  Handlers extends Partial<Record<string, unknown>>,
> = Exclude<E, { _tag: Extract<keyof Handlers, string> }>;
