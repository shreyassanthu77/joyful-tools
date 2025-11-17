/**
 * Pipes a value through a series of functions.
 *
 * This is the implementation that handles any number of functions.
 * The overloads above provide type safety for up to 15 functions.
 *
 * @param value - The initial value to pipe through the functions
 * @param fns - Functions to apply in sequence
 * @returns The final result after applying all functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 *
 * // Works with any number of functions
 * pipe(2, double, square, addFive, double); // returns 52
 * ```
 */
export function pipe<T, U>(value: T, f: (value: T) => U): U;
export function pipe<T, U, V>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
): V;
export function pipe<T, U, V, W>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
): W;
export function pipe<T, U, V, W, X>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
): X;
export function pipe<T, U, V, W, X, Y>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
): Y;
export function pipe<T, U, V, W, X, Y, Z>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
): Z;
export function pipe<T, U, V, W, X, Y, Z, A>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
): A;
export function pipe<T, U, V, W, X, Y, Z, A, B>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
  m: (value: A) => B,
): B;
export function pipe<T, U, V, W, X, Y, Z, A, B, C>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
  m: (value: A) => B,
  n: (value: B) => C,
): C;
export function pipe<T, U, V, W, X, Y, Z, A, B, C, D>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
  m: (value: A) => B,
  n: (value: B) => C,
  o: (value: C) => D,
): D;
export function pipe<T, U, V, W, X, Y, Z, A, B, C, D, E>(
  value: T,
  fn: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
  m: (value: A) => B,
  n: (value: B) => C,
  o: (value: C) => D,
  p: (value: D) => E,
): E;
export function pipe<T, U, V, W, X, Y, Z, A, B, C, D, E, F>(
  value: T,
  fn: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
  m: (value: A) => B,
  n: (value: B) => C,
  o: (value: C) => D,
  p: (value: D) => E,
  q: (value: E) => F,
): F;
export function pipe<T, U, V, W, X, Y, Z, A, B, C, D, E, F, G>(
  value: T,
  fn: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
  m: (value: A) => B,
  n: (value: B) => C,
  o: (value: C) => D,
  p: (value: D) => E,
  q: (value: E) => F,
  r: (value: F) => G,
): G;
export function pipe<T, U, V, W, X, Y, Z, A, B, C, D, E, F, G, H>(
  value: T,
  fn: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
  m: (value: A) => B,
  n: (value: B) => C,
  o: (value: C) => D,
  p: (value: D) => E,
  q: (value: E) => F,
  r: (value: F) => G,
  s: (value: G) => H,
): H;
export function pipe<T, U, V, W, X, Y, Z, A, B, C, D, E, F, G, H, I>(
  value: T,
  fn: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
  l: (value: Z) => A,
  m: (value: A) => B,
  n: (value: B) => C,
  o: (value: C) => D,
  p: (value: D) => E,
  q: (value: E) => F,
  r: (value: F) => G,
  s: (value: G) => H,
  t: (value: H) => I,
): I;
// deno-lint-ignore no-explicit-any
export function pipe<T, const Rest extends readonly ((a: any) => any)[]>(
  value: T,
  ...fns: Rest
) {
  let result = value;
  for (const fn of fns) {
    result = fn(result);
  }
  return result;
}
