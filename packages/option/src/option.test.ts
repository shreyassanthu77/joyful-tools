import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import {
  andThen,
  fromNullable,
  map,
  match,
  None,
  Option,
  orElse,
  Some,
} from "./option.ts";

Deno.test("Some behaves correctly", () => {
  const s = new Some(10);
  assert(s.isSome());
  assert(!s.isNone());
  assertEquals(s.unwrap(), 10);
  assertEquals(s.unwrapOr(20), 10);
});

Deno.test("None behaves correctly", () => {
  const n = None;
  assert(!n.isSome());
  assert(n.isNone());
  assertThrows(() => n.unwrap(), Error, "called `unwrap` on a `None` value");
  assertEquals(n.unwrapOr(20), 20);
});

Deno.test("fromNullable behaves correctly", () => {
  const s = fromNullable(10);
  assert(s.isSome());
  assertEquals(s.unwrap(), 10);

  const n1 = fromNullable(null);
  assert(n1.isNone());

  const n2 = fromNullable(undefined);
  assert(n2.isNone());
});

Deno.test("map behaves correctly", () => {
  const s = new Some(10);
  const m = map(s, (x) => x * 2);
  assert(m.isSome());
  assertEquals(m.unwrap(), 20);

  const n = None;
  const m2 = map(n, (x: number) => x * 2);
  assert(m2.isNone());

  // Curried
  const doubler = map((x: number) => x * 2);
  const m3 = doubler(s);
  assertEquals(m3.unwrap(), 20);
});

Deno.test("andThen behaves correctly", () => {
  const s = new Some(10);
  const m = andThen(s, (x) => new Some(x * 2));
  assert(m.isSome());
  assertEquals(m.unwrap(), 20);

  const n = None;
  const m2 = andThen(n, (x: number) => new Some(x * 2));
  assert(m2.isNone());

  const m3 = andThen(s, (_: number) => None);
  assert(m3.isNone());

  // Curried
  const doubler = andThen((x: number) => new Some(x * 2));
  const m4 = doubler(s);
  assertEquals(m4.unwrap(), 20);
});

Deno.test("orElse behaves correctly", () => {
  const s = new Some(10);
  const m = orElse(s, () => new Some(20));
  assert(m.isSome());
  assertEquals(m.unwrap(), 10);

  const n = None;
  const m2 = orElse(n, () => new Some(20));
  assert(m2.isSome());
  assertEquals(m2.unwrap(), 20);

  // Curried
  const defaulter = orElse(() => new Some(20));
  const m3 = defaulter(n);
  assertEquals(m3.unwrap(), 20);
});

Deno.test("match behaves correctly", () => {
  const s = new Some(10);
  const m = match(
    s,
    (x) => `Got ${x}`,
    () => "Got nothing",
  );
  assertEquals(m, "Got 10");

  const n = None;
  const m2 = match(
    n,
    (x: number) => `Got ${x}`,
    () => "Got nothing",
  );
  assertEquals(m2, "Got nothing");

  // Curried
  const matcher = match(
    (x: number) => `Got ${x}`,
    () => "Got nothing",
  );
  assertEquals(matcher(s), "Got 10");
});

// Pipe compatibility test (simulated)
function pipe<T, U, V>(val: T, f1: (v: T) => U, f2: (v: U) => V): V {
  return f2(f1(val));
}

Deno.test("works with pipe", () => {
  const result = pipe(
    new Some(5),
    map((x) => x * 2),
    (opt) => opt.unwrapOr(0),
  );
  assertEquals(result, 10);
});
