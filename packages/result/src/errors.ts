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
export type TaggedError<Tag extends string, Fields extends object = NoFields> =
  Error & Readonly<{ _tag: Tag } & Fields>;

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
export function taggedError<
  Tag extends string = string,
>(
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
