import { assertEquals, assertThrows } from "std/assert";
import { Result } from "./result.ts";

Deno.test("Result Core", () => {
  assertEquals(Result.ok(2).isOk(), true);
  assertEquals(Result.ok(2).isErr(), false);
  assertEquals(Result.err(2).isOk(), false);
  assertEquals(Result.err(2).isErr(), true);
});

Deno.test("Result.unwrapOr", () => {
  assertEquals(Result.ok(2).unwrapOr(1), 2);
  assertEquals(Result.err<void, number>(undefined).unwrapOr(1), 1);
});

Deno.test("Result.expect", () => {
  assertEquals(Result.ok(2).expect("error"), 2);

  assertThrows(() => Result.err(undefined).expect("error"), Error, "error");
});

Deno.test("Result.expectErr", () => {
  assertThrows(() => Result.ok(2).expectErr("error"), Error, "error");

  assertEquals(Result.err(undefined).expectErr("error"), undefined);
});

Deno.test("Result.map", () => {
  assertEquals(
    Result.ok(2).map((x) => x + 1),
    Result.ok(3),
  );

  assertEquals(
    Result.err<void, number>(undefined).map((x) => x + 1),
    Result.err(undefined),
  );
});

Deno.test("Result.mapErr", () => {
  assertEquals(
    Result.ok<void, number>(undefined).mapErr((x) => x + 1),
    Result.ok(undefined),
  );

  assertEquals(
    Result.err<number, void>(2).mapErr((x) => x + 1),
    Result.err(3),
  );
});

Deno.test("Result.andThen", () => {
  assertEquals(
    Result.ok(2).andThen((x) => Result.ok(x + 1)),
    Result.ok(3),
  );

  assertEquals(
    Result.err<void, number>(undefined).andThen((x) => Result.ok(x + 1)),
    Result.err(undefined),
  );
});

Deno.test("Result.orElse", () => {
  assertEquals(
    Result.ok(2).orElse((x) => Result.ok(x + 1)),
    Result.ok(2),
  );

  assertEquals(
    Result.err<number, void>(2).orElse((x) => Result.ok(x + 1)),
    Result.ok(3),
  );
});

Deno.test("Result.inspect", () => {
  let value = 0;
  Result.ok(2).inspect((x) => {
    value = x;
  });
  assertEquals(value, 2);

  value = 0;
  Result.err<void, number>(undefined).inspect((x) => {
    value = x;
  });
  assertEquals(value, 0);
});

Deno.test("Result.inspectErr", () => {
  let value = 0;
  Result.ok<void, number>(undefined).inspectErr((x) => {
    value = x;
  });
  assertEquals(value, 0);

  value = 0;
  Result.err(2).inspectErr((x) => {
    value = x;
  });
  assertEquals(value, 2);
});
