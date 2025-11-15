export function pipe<T, U>(value: T, f: (value: T) => U): U;
export function pipe<T, U, V>(value: T, f: (value: T) => U, g: (value: U) => V): V;
export function pipe<T, U, V, W>(
	value: T,
	f: (value: T) => U,
	g: (value: U) => V,
	h: (value: V) => W
): W;
export function pipe<T, U, V, W, X>(
	value: T,
	f: (value: T) => U,
	g: (value: U) => V,
	h: (value: V) => W,
	i: (value: W) => X
): X;
export function pipe<T, U, V, W, X, Y>(
	value: T,
	f: (value: T) => U,
	g: (value: U) => V,
	h: (value: V) => W,
	i: (value: W) => X,
	j: (value: X) => Y
): Y;
export function pipe<T, U, V, W, X, Y, Z>(
	value: T,
	f: (value: T) => U,
	g: (value: U) => V,
	h: (value: V) => W,
	i: (value: W) => X,
	j: (value: X) => Y,
	k: (value: Y) => Z
): Z;
export function pipe<T, U, V, W, X, Y, Z, A>(
	value: T,
	f: (value: T) => U,
	g: (value: U) => V,
	h: (value: V) => W,
	i: (value: W) => X,
	j: (value: X) => Y,
	k: (value: Y) => Z,
	l: (value: Z) => A
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
	m: (value: A) => B
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
	n: (value: B) => C
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
	o: (value: C) => D
): D;
export function pipe<T, const Rest extends readonly ((a: any) => any)[]>(value: T, ...fns: Rest) {
	let result = value;
	for (const fn of fns) {
		result = fn(result);
	}
	return result;
}
