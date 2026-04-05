import { assertEquals, assertRejects } from "std/assert";
import { AsyncResult } from "./async-result.ts";
import { Result } from "./main.ts";

Deno.test("AsyncResult Core", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).isOk(),
    true,
  );
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).isErr(),
    false,
  );
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err(2))).isOk(),
    false,
  );
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err(2))).isErr(),
    true,
  );
});

Deno.test("AsyncResult.unwrapOr", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).unwrapOr(1),
    2,
  );
  assertEquals(
    await new AsyncResult(
      Promise.resolve(Result.err<void, number>(undefined)),
    ).unwrapOr(1),
    1,
  );
});

Deno.test("AsyncResult.expect", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).expect("error"),
    2,
  );

  await assertRejects(
    () =>
      new AsyncResult(Promise.resolve(Result.err(undefined))).expect("error"),
    Error,
    "error",
  );
});

Deno.test("AsyncResult.expectErr", async () => {
  await assertRejects(
    () => new AsyncResult(Promise.resolve(Result.ok(2))).expectErr("error"),
    Error,
    "error",
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err(undefined))).expectErr(
      "error",
    ),
    undefined,
  );
});

Deno.test("AsyncResult.map", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).map((x) => x + 1),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).map(
      // deno-lint-ignore require-await
      async (x) => x + 1,
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(
      Promise.resolve(Result.err<void, number>(undefined)),
    ).map((x) => x + 1),
    Result.err(undefined),
  );
});

Deno.test("AsyncResult.mapErr", async () => {
  assertEquals(
    await new AsyncResult(
      Promise.resolve(Result.ok<void, number>(undefined)),
    ).mapErr((x) => x + 1),
    Result.ok(undefined),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).mapErr(
      (x) => x + 1,
    ),
    Result.err(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).mapErr(
      // deno-lint-ignore require-await
      async (x) => x + 1,
    ),
    Result.err(3),
  );
});

Deno.test("AsyncResult.andThen", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).andThen((x) =>
      Result.ok(x + 1)
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).andThen(
      (x) => new AsyncResult(Promise.resolve(Result.ok(x + 1))),
    ),
    Result.ok(3),
  );

  assertEquals(
    // deno-lint-ignore require-await
    await new AsyncResult(Promise.resolve(Result.ok(2))).andThen(async (x) =>
      Result.ok(x + 1)
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(
      Promise.resolve(Result.err<void, number>(undefined)),
    ).andThen((x) => Result.ok(x + 1)),
    Result.err(undefined),
  );
});

Deno.test("AsyncResult.orElse", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).orElse((x) =>
      Result.ok(x + 1)
    ),
    Result.ok(2),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).orElse(
      (x) => Result.ok(x + 1),
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).orElse(
      (x) => new AsyncResult(Promise.resolve(Result.ok(x + 1))),
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).orElse(
      // deno-lint-ignore require-await
      async (x) => Result.ok(x + 1),
    ),
    Result.ok(3),
  );
});

Deno.test("AsyncResult.inspect", async () => {
  let value = 0;
  await new AsyncResult(Promise.resolve(Result.ok(2))).inspect((x) => {
    value = x;
  });
  assertEquals(value, 2);

  value = 0;
  await new AsyncResult(
    Promise.resolve(Result.err<void, number>(undefined)),
  ).inspect((x) => {
    value = x;
  });
  assertEquals(value, 0);
});

Deno.test("AsyncResult.inspectErr", async () => {
  let value = 0;
  await new AsyncResult(
    Promise.resolve(Result.ok<void, number>(undefined)),
  ).inspectErr((x) => {
    value = x;
  });
  assertEquals(value, 0);

  value = 0;
  await new AsyncResult(Promise.resolve(Result.err(2))).inspectErr((x) => {
    value = x;
  });
  assertEquals(value, 2);
});
