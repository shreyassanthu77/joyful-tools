import { assert, assertEquals, assertThrows } from "assert";
import { pipe } from "@joyful/pipe";
import { Option } from "@joyful/option";

Deno.test("Option", async (t) => {
  await t.step("Some behaves correctly", () => {
    const s = new Option.Some(10);
    assert(s.isSome());
    assert(!s.isNone());
    assertEquals(s.unwrap(), 10);
    assertEquals(s.unwrapOr(20), 10);
  });

  await t.step("None behaves correctly", () => {
    const n = Option.None;
    assert(!n.isSome());
    assert(n.isNone());
    assertThrows(() => n.unwrap(), Error, "called `unwrap` on a `None` value");
    assertEquals(n.unwrapOr(20), 20);
  });

  await t.step("fromNullable behaves correctly", () => {
    const s = Option.fromNullable(10);
    assert(s.isSome());
    assertEquals(s.unwrap(), 10);

    const n1 = Option.fromNullable(null);
    assert(n1.isNone());

    const n2 = Option.fromNullable(undefined);
    assert(n2.isNone());
  });

  await t.step("map behaves correctly", () => {
    const s = new Option.Some(10);
    const m = Option.map(s, (x) => x * 2);
    assert(m.isSome());
    assertEquals(m.unwrap(), 20);

    const n = Option.None;
    const m2 = Option.map(n, (x: number) => x * 2);
    assert(m2.isNone());

    // Curried
    const doubler = Option.map((x: number) => x * 2);
    const m3 = doubler(s);
    assertEquals(m3.unwrap(), 20);
  });

  await t.step("andThen behaves correctly", () => {
    const s = new Option.Some(10);
    const m = Option.andThen(s, (x) => new Option.Some(x * 2));
    assert(m.isSome());
    assertEquals(m.unwrap(), 20);

    const n = Option.None;
    const m2 = Option.andThen(n, (x: number) => new Option.Some(x * 2));
    assert(m2.isNone());

    const m3 = Option.andThen(s, (_: number) => Option.None);
    assert(m3.isNone());

    // Curried
    const doubler = Option.andThen((x: number) => new Option.Some(x * 2));
    const m4 = doubler(s);
    assertEquals(m4.unwrap(), 20);
  });

  await t.step("orElse behaves correctly", () => {
    const s = new Option.Some(10);
    const m = Option.orElse(s, () => new Option.Some(20));
    assert(m.isSome());
    assertEquals(m.unwrap(), 10);

    const n = Option.None;
    const m2 = Option.orElse(n, () => new Option.Some(20));
    assert(m2.isSome());
    assertEquals(m2.unwrap(), 20);

    // Curried
    const defaulter = Option.orElse(() => new Option.Some(20));
    const m3 = defaulter(n);
    assertEquals(m3.unwrap(), 20);
  });

  await t.step("match behaves correctly", () => {
    const s = new Option.Some(10);
    const m = Option.match(
      s,
      (x) => `Got ${x}`,
      () => "Got nothing",
    );
    assertEquals(m, "Got 10");

    const n = Option.None;
    const m2 = Option.match(
      n,
      (x: number) => `Got ${x}`,
      () => "Got nothing",
    );
    assertEquals(m2, "Got nothing");

    // Curried
    const matcher = Option.match(
      (x: number) => `Got ${x}`,
      () => "Got nothing",
    );
    assertEquals(matcher(s), "Got 10");
  });

  await t.step("works with pipe", () => {
    const result = pipe(
      new Option.Some(5),
      Option.map((x) => x * 2),
      (opt) => opt.unwrapOr(0),
    );
    assertEquals(result, 10);
  });
});
