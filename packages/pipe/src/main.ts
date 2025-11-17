/**
 * A functional programming utility for composing functions in a readable, left-to-right pipeline.
 * 
 * This module provides a `pipe` function that allows you to chain multiple functions
 * together, passing the result of each function as input to the next. This creates
 * a clean, declarative way to express data transformations.
 * 
 * The pipe function is fully type-safe with TypeScript, providing overloaded signatures
 * for up to 15 functions to maintain precise type inference throughout the pipeline.
 * 
 * @example
 * ```typescript
 * import { pipe } from "@joyful/pipe";
 * 
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * 
 * // Chain operations in a readable way
 * const result = pipe(2, double, square, addFive); // returns 13
 * 
 * // Works with any number of functions
 * const complex = pipe(2, double, square, addFive, double, toString); // returns "26"
 * ```
 * 
 * @module
 */

/**
 * Pipes a value through a single function.
 *
 * @param value - The initial value to pipe through the function
 * @param f - Function to apply to the value
 * @returns The result after applying the function
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * pipe(5, double); // returns 10
 * ```
 */
export function pipe<T, U>(value: T, f: (value: T) => U): U;
/**
 * Pipes a value through two functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @returns The result after applying both functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const addFive = (x: number) => x + 5;
 * pipe(5, double, addFive); // returns 15
 * ```
 */
export function pipe<T, U, V>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
): V;
/**
 * Pipes a value through three functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @param h - Third function to apply to the result of g
 * @returns The result after applying all three functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * pipe(2, double, square, addFive); // returns 13
 * ```
 */
export function pipe<T, U, V, W>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
): W;
/**
 * Pipes a value through four functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @returns The result after applying all four functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * pipe(2, double, square, addFive, toString); // returns "13"
 * ```
 */
export function pipe<T, U, V, W, X>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
): X;

/**
 * Pipes a value through five functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @returns The result after applying all five functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * pipe(2, double, square, addFive, toString, length); // returns 2
 * ```
 */
export function pipe<T, U, V, W, X, Y>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
): Y;

/**
 * Pipes a value through six functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @returns The result after applying all six functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * pipe(2, double, square, addFive, toString, length, isEven); // returns true
 * ```
 */
export function pipe<T, U, V, W, X, Y, Z>(
  value: T,
  f: (value: T) => U,
  g: (value: U) => V,
  h: (value: V) => W,
  i: (value: W) => X,
  j: (value: X) => Y,
  k: (value: Y) => Z,
): Z;

/**
 * Pipes a value through seven functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @returns The result after applying all seven functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber); // returns 1
 * ```
 */
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

/**
 * Pipes a value through eight functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @param m - Eighth function to apply to the result of l
 * @returns The result after applying all eight functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * const doubleAgain = (n: number) => n * 2;
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber, doubleAgain); // returns 2
 * ```
 */
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

/**
 * Pipes a value through nine functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @param m - Eighth function to apply to the result of l
 * @param n - Ninth function to apply to the result of m
 * @returns The result after applying all nine functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * const doubleAgain = (n: number) => n * 2;
 * const toStringAgain = (n: number) => n.toString();
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber, doubleAgain, toStringAgain); // returns "2"
 * ```
 */
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

/**
 * Pipes a value through ten functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param f - First function to apply to the value
 * @param g - Second function to apply to the result of f
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @param m - Eighth function to apply to the result of l
 * @param n - Ninth function to apply to the result of m
 * @param o - Tenth function to apply to the result of n
 * @returns The result after applying all ten functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * const doubleAgain = (n: number) => n * 2;
 * const toStringAgain = (n: number) => n.toString();
 * const lengthAgain = (s: string) => s.length;
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber, doubleAgain, toStringAgain, lengthAgain); // returns 1
 * ```
 */
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

/**
 * Pipes a value through eleven functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param fn - First function to apply to the value
 * @param g - Second function to apply to the result of fn
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @param m - Eighth function to apply to the result of l
 * @param n - Ninth function to apply to the result of m
 * @param o - Tenth function to apply to the result of n
 * @param p - Eleventh function to apply to the result of o
 * @returns The result after applying all eleven functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * const doubleAgain = (n: number) => n * 2;
 * const toStringAgain = (n: number) => n.toString();
 * const lengthAgain = (s: string) => s.length;
 * const isPositive = (n: number) => n > 0;
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber, doubleAgain, toStringAgain, lengthAgain, isPositive); // returns true
 * ```
 */
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

/**
 * Pipes a value through twelve functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param fn - First function to apply to the value
 * @param g - Second function to apply to the result of fn
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @param m - Eighth function to apply to the result of l
 * @param n - Ninth function to apply to the result of m
 * @param o - Tenth function to apply to the result of n
 * @param p - Eleventh function to apply to the result of o
 * @param q - Twelfth function to apply to the result of p
 * @returns The result after applying all twelve functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * const doubleAgain = (n: number) => n * 2;
 * const toStringAgain = (n: number) => n.toString();
 * const lengthAgain = (s: string) => s.length;
 * const isPositive = (n: number) => n > 0;
 * const toNumberAgain = (b: boolean) => b ? 1 : 0;
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber, doubleAgain, toStringAgain, lengthAgain, isPositive, toNumberAgain); // returns 1
 * ```
 */
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

/**
 * Pipes a value through thirteen functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param fn - First function to apply to the value
 * @param g - Second function to apply to the result of fn
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @param m - Eighth function to apply to the result of l
 * @param n - Ninth function to apply to the result of m
 * @param o - Tenth function to apply to the result of n
 * @param p - Eleventh function to apply to the result of o
 * @param q - Twelfth function to apply to the result of p
 * @param r - Thirteenth function to apply to the result of q
 * @returns The result after applying all thirteen functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * const doubleAgain = (n: number) => n * 2;
 * const toStringAgain = (n: number) => n.toString();
 * const lengthAgain = (s: string) => s.length;
 * const isPositive = (n: number) => n > 0;
 * const toNumberAgain = (b: boolean) => b ? 1 : 0;
 * const doubleFinal = (n: number) => n * 2;
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber, doubleAgain, toStringAgain, lengthAgain, isPositive, toNumberAgain, doubleFinal); // returns 2
 * ```
 */
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

/**
 * Pipes a value through fourteen functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param fn - First function to apply to the value
 * @param g - Second function to apply to the result of fn
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @param m - Eighth function to apply to the result of l
 * @param n - Ninth function to apply to the result of m
 * @param o - Tenth function to apply to the result of n
 * @param p - Eleventh function to apply to the result of o
 * @param q - Twelfth function to apply to the result of p
 * @param r - Thirteenth function to apply to the result of q
 * @param s - Fourteenth function to apply to the result of r
 * @returns The result after applying all fourteen functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * const doubleAgain = (n: number) => n * 2;
 * const toStringAgain = (n: number) => n.toString();
 * const lengthAgain = (s: string) => s.length;
 * const isPositive = (n: number) => n > 0;
 * const toNumberAgain = (b: boolean) => b ? 1 : 0;
 * const doubleFinal = (n: number) => n * 2;
 * const toStringFinal = (n: number) => n.toString();
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber, doubleAgain, toStringAgain, lengthAgain, isPositive, toNumberAgain, doubleFinal, toStringFinal); // returns "2"
 * ```
 */
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

/**
 * Pipes a value through fifteen functions in sequence.
 *
 * @param value - The initial value to pipe through the functions
 * @param fn - First function to apply to the value
 * @param g - Second function to apply to the result of fn
 * @param h - Third function to apply to the result of g
 * @param i - Fourth function to apply to the result of h
 * @param j - Fifth function to apply to the result of i
 * @param k - Sixth function to apply to the result of j
 * @param l - Seventh function to apply to the result of k
 * @param m - Eighth function to apply to the result of l
 * @param n - Ninth function to apply to the result of m
 * @param o - Tenth function to apply to the result of n
 * @param p - Eleventh function to apply to the result of o
 * @param q - Twelfth function to apply to the result of p
 * @param r - Thirteenth function to apply to the result of q
 * @param s - Fourteenth function to apply to the result of r
 * @param t - Fifteenth function to apply to the result of s
 * @returns The result after applying all fifteen functions
 *
 * @example
 * ```typescript
 * const double = (x: number) => x * 2;
 * const square = (x: number) => x * x;
 * const addFive = (x: number) => x + 5;
 * const toString = (x: number) => x.toString();
 * const length = (s: string) => s.length;
 * const isEven = (n: number) => n % 2 === 0;
 * const toNumber = (b: boolean) => b ? 1 : 0;
 * const doubleAgain = (n: number) => n * 2;
 * const toStringAgain = (n: number) => n.toString();
 * const lengthAgain = (s: string) => s.length;
 * const isPositive = (n: number) => n > 0;
 * const toNumberAgain = (b: boolean) => b ? 1 : 0;
 * const doubleFinal = (n: number) => n * 2;
 * const toStringFinal = (n: number) => n.toString();
 * const lengthFinal = (s: string) => s.length;
 * pipe(2, double, square, addFive, toString, length, isEven, toNumber, doubleAgain, toStringAgain, lengthAgain, isPositive, toNumberAgain, doubleFinal, toStringFinal, lengthFinal); // returns 1
 * ```
 */
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
