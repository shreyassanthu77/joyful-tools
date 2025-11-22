/**
 * A TypeScript implementation of the Option type for null/undefined handling.
 *
 * The Option type represents an optional value: every Option is either Some and contains a value,
 * or None, and does not. Option types are very common in functional programming languages
 * as they provide a safe way to handle cases where a value might be missing.
 *
 * @example
 * ```typescript
 * import { Option, Some, None, map } from "@joyful/option";
 *
 * const divide = (numerator: number, denominator: number): Option<number> => {
 *   if (denominator === 0) {
 *     return None;
 *   }
 *   return new Some(numerator / denominator);
 * };
 *
 * const result = divide(10, 2);
 * if (result.isSome()) {
 *   console.log("Result:", result.unwrap());
 * } else {
 *   console.log("Cannot divide by zero");
 * }
 * ```
 *
 * @module
 */

/**
 * Base interface for Option types.
 *
 * @template T - The type of the value contained in Some
 */
interface BaseOption<T> {
  /**
   * Returns true if the Option is a Some value.
   */
  isSome(): boolean;

  /**
   * Returns true if the Option is a None value.
   */
  isNone(): boolean;

  /**
   * Returns the contained Some value, or throws an error if it is None.
   * @throws Error if called on a None value
   */
  unwrap(): T;

  /**
   * Returns the contained Some value or a provided default.
   * @param defaultValue - The value to return if this is None
   */
  unwrapOr(defaultValue: T): T;
}

/**
 * Represents a value that exists.
 *
 * @template T - The type of the value
 */
export class Some<T extends NonNullable<unknown>> implements BaseOption<T> {
  constructor(public value: T) {}

  isSome(): this is Some<T> {
    return true;
  }

  isNone(): this is None {
    return false;
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_: T): T {
    return this.value;
  }
}

/**
 * Represents a value that does not exist.
 */
class NoneImpl implements BaseOption<never> {
  isSome(): this is Some<never> {
    return false;
  }

  isNone(): this is NoneImpl {
    return true;
  }

  unwrap(): never {
    throw new Error("called `unwrap` on a `None` value");
  }

  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }
}

/**
 * The singleton instance of None.
 */
export const None: None = new NoneImpl();

/**
 * Type alias for None to make it easier to use in type definitions.
 */
export type None = NoneImpl;

/**
 * Represents an optional value: every Option is either Some and contains a value,
 * or None, and does not.
 */
export type Option<T> = Some<T extends NonNullable<unknown> ? T : never> | None;

/**
 * Converts a nullable value (null or undefined) into an Option.
 *
 * @param value - The value to convert
 * @returns Some(value) if value is not null/undefined, otherwise None
 *
 * @example
 * ```typescript
 * const x = fromNullable("hello"); // Some("hello")
 * const y = fromNullable(null);    // None
 * ```
 */
export function fromNullable<T>(
  value: T | null | undefined,
): Option<NonNullable<T>> {
  return (
    value === null || value === undefined
      ? None
      : new Some(value as NonNullable<T>)
  ) as Option<NonNullable<T>>;
}

/**
 * Maps an Option<T> to Option<U> by applying a function to a contained value.
 *
 * @example
 * ```typescript
 * const maybeSome = new Some(5);
 * const doubled = map(maybeSome, x => x * 2); // Some(10)
 *
 * const maybeNone = None;
 * const mappedNone = map(maybeNone, x => x * 2); // None
 * ```
 */
export function map<
  T extends NonNullable<unknown>,
  U extends NonNullable<unknown>,
>(option: Option<T>, f: (value: T) => U): Option<U>;
export function map<
  T extends NonNullable<unknown>,
  U extends NonNullable<unknown>,
>(f: (value: T) => U): (option: Option<T>) => Option<U>;
export function map<
  T extends NonNullable<unknown>,
  U extends NonNullable<unknown>,
>(
  optionOrFn: Option<T> | ((value: T) => U),
  maybeFn?: (value: T) => U,
): Option<U> | ((option: Option<T>) => Option<U>) {
  if (maybeFn !== undefined) {
    const option = optionOrFn as Option<T>;
    const f = maybeFn;
    // @ts-ignore: TypeScript struggles to verify U extends NonNullable<unknown> here due to erasure, but logic guarantees U is result of f
    return option instanceof Some ? new Some(f(option.value)) : None;
  }

  const f = optionOrFn as (value: T) => U;
  return (option: Option<T>): Option<U> => {
    // @ts-ignore: Same as above
    return option instanceof Some ? new Some(f(option.value)) : None;
  };
}

/**
 * Returns None if the option is None, otherwise calls f with the wrapped value and returns the result.
 * Some languages call this flatMap.
 *
 * @example
 * ```typescript
 * const getSquareRoot = (x: number): Option<number> =>
 *   x >= 0 ? new Some(Math.sqrt(x)) : None;
 *
 * const x = new Some(4);
 * const y = andThen(x, getSquareRoot); // Some(2)
 *
 * const z = new Some(-1);
 * const w = andThen(z, getSquareRoot); // None
 * ```
 */
export function andThen<T extends NonNullable<unknown>, U>(
  option: Option<T>,
  f: (value: T) => Option<U>,
): Option<U>;
export function andThen<T extends NonNullable<unknown>, U>(
  f: (value: T) => Option<U>,
): (option: Option<T>) => Option<U>;
export function andThen<T extends NonNullable<unknown>, U>(
  optionOrFn: Option<T> | ((value: T) => Option<U>),
  maybeFn?: (value: T) => Option<U>,
): Option<U> | ((option: Option<T>) => Option<U>) {
  if (maybeFn !== undefined) {
    const option = optionOrFn as Option<T>;
    const f = maybeFn;
    return option instanceof Some ? f(option.value) : None;
  }

  const f = optionOrFn as (value: T) => Option<U>;
  return (option: Option<T>): Option<U> => {
    return option instanceof Some ? f(option.value) : None;
  };
}

/**
 * Returns the option if it contains a value, otherwise calls f and returns the result.
 *
 * @example
 * ```typescript
 * const x = None;
 * const y = orElse(x, () => new Some(5)); // Some(5)
 * ```
 */
export function orElse<T>(option: Option<T>, f: () => Option<T>): Option<T>;
export function orElse<T>(f: () => Option<T>): (option: Option<T>) => Option<T>;
export function orElse<T>(
  optionOrFn: Option<T> | (() => Option<T>),
  maybeFn?: () => Option<T>,
): Option<T> | ((option: Option<T>) => Option<T>) {
  if (maybeFn !== undefined) {
    const option = optionOrFn as Option<T>;
    const f = maybeFn;
    return option === None ? f() : option;
  }

  const f = optionOrFn as () => Option<T>;
  return (option: Option<T>): Option<T> => {
    return option === None ? f() : option;
  };
}

/**
 * Applies the `some` function to the contained value if the option is Some,
 * or returns the result of the `none` function if the option is None.
 *
 * @example
 * ```typescript
 * const x = new Some(5);
 * const result = match(x,
 *   val => `Got ${val}`,
 *   () => "Got nothing"
 * ); // "Got 5"
 * ```
 */
export function match<T extends NonNullable<unknown>, U>(
  option: Option<T>,
  some: (value: T) => U,
  none: () => U,
): U;
export function match<T extends NonNullable<unknown>, U>(
  some: (value: T) => U,
  none: () => U,
): (option: Option<T>) => U;
export function match<T extends NonNullable<unknown>, U>(
  optionOrSome: Option<T> | ((value: T) => U),
  someOrNone?: ((value: T) => U) | (() => U),
  maybeNone?: () => U,
): U | ((option: Option<T>) => U) {
  if (maybeNone !== undefined) {
    const option = optionOrSome as Option<T>;
    const some = someOrNone as (value: T) => U;
    const none = maybeNone;
    return option instanceof Some ? some(option.value) : none();
  }

  const some = optionOrSome as (value: T) => U;
  const none = someOrNone as () => U;
  return (option: Option<T>): U => {
    return option instanceof Some ? some(option.value) : none();
  };
}
