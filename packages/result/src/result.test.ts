import { pipe } from "@joyful/pipe";
import { Result } from "@joyful/result";
import { assertEquals, assertThrows } from "assert";

Deno.test("Core", async (t) => {
  await t.step("ok and err", () => {
    const ok = new Result.Ok("hello");
    assertEquals(ok.ok(), true);
    assertEquals(ok.err(), false);

    const err = new Result.Err("hello");
    assertEquals(err.ok(), false);
    assertEquals(err.err(), true);
  });

  await t.step("unwrap and unwrapErr", () => {
    const ok = new Result.Ok("hello");
    assertEquals(ok.unwrap(), "hello");
    assertThrows(() => ok.unwrapErr());

    const err = new Result.Err("hello");
    assertThrows(() => err.unwrap());
    assertEquals(err.unwrapErr(), "hello");
  });

  await t.step("unwrapOr", () => {
    const ok = new Result.Ok("hello");
    assertEquals(ok.unwrapOr("world"), "hello");

    const err = new Result.Err<string, string>("hello");
    assertEquals(err.unwrapOr("world"), "world");
  });
});

Deno.test("map", async (t) => {
  await t.step("should map an Ok value (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.map((value) => value + 1),
    );

    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 2);
  });

  await t.step("should map an Ok value (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.map(ok, (value) => value + 1);

    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 2);
  });

  await t.step("should not map an Err value (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.map((value) => value + 1),
    );
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 1);
  });

  await t.step("should not map an Err value (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.map(err, (value) => value + 1);
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 1);
  });
});

Deno.test("mapErr", async (t) => {
  await t.step("should map an Err value (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.mapErr((error) => error + 1),
    );
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 2);
  });

  await t.step("should map an Err value (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.mapErr(err, (error) => error + 1);
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 2);
  });

  await t.step("should not map an Ok value (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.mapErr((error) => error + 1),
    );
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 1);
  });

  await t.step("should not map an Ok value (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.mapErr(ok, (error) => error + 1);
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 1);
  });
});

Deno.test("andThen", async (t) => {
  await t.step("Ok + Ok1 => Ok1 (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.andThen((value) => new Result.Ok(value + 1)),
    );
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 2);
  });

  await t.step("Ok + Ok1 => Ok1 (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.andThen(ok, (value) => new Result.Ok(value + 1));
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 2);
  });

  await t.step("Ok + Err => Err (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.andThen((value) => new Result.Err(value + 1)),
    );
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 2);
  });

  await t.step("Ok + Err => Err (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.andThen(ok, (value) => new Result.Err(value + 1));
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 2);
  });

  await t.step("Err + Ok => Err (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.andThen((value) => new Result.Ok(value + 1)),
    );
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 1);
  });

  await t.step("Err + Ok => Err (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.andThen(err, (value) => new Result.Ok(value + 1));
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 1);
  });

  await t.step("Err + Err1 => Err (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.andThen((value) => new Result.Err(value + 1)),
    );
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 1);
  });

  await t.step("Err + Err1 => Err (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.andThen(err, (value) => new Result.Err(value + 1));
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 1);
  });
});

Deno.test("orElse", async (t) => {
  await t.step("Ok + Ok1 => Ok (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.orElse((error) => new Result.Ok(error + 1)),
    );
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 1);
  });

  await t.step("Ok + Ok1 => Ok (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.orElse(ok, (error) => new Result.Ok(error + 1));
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 1);
  });

  await t.step("Ok + Err => Ok (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.orElse((error) => new Result.Err(error + 1)),
    );
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 1);
  });

  await t.step("Ok + Err => Ok (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.orElse(ok, (error) => new Result.Err(error + 1));
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 1);
  });

  await t.step("Err + Ok => Ok (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.orElse((error) => new Result.Ok(error + 1)),
    );
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 2);
  });

  await t.step("Err + Ok => Ok (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.orElse(err, (error) => new Result.Ok(error + 1));
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), 2);
  });

  await t.step("Err + Err1 => Err1 (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.orElse((error) => new Result.Err(error + 1)),
    );
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 2);
  });

  await t.step("Err + Err1 => Err1 (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.orElse(err, (error) => new Result.Err(error + 1));
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), 2);
  });
});

Deno.test("match", async (t) => {
  await t.step("should match Ok (curried)", () => {
    const ok = new Result.Ok(1);
    const matched = pipe(
      ok,
      Result.match(
        (value) => value + 1,
        (error) => error + 2,
      ),
    );
    assertEquals(matched, 2);
  });

  await t.step("should match Ok (binary)", () => {
    const ok = new Result.Ok(1);
    const matched = Result.match(
      ok,
      (value) => value + 1,
      (error) => error + 2,
    );
    assertEquals(matched, 2);
  });

  await t.step("should match Err (curried)", () => {
    const err = new Result.Err(1);
    const matched = pipe(
      err,
      Result.match(
        (value) => value + 1,
        (error) => error + 2,
      ),
    );
    assertEquals(matched, 3);
  });

  await t.step("should match Err (binary)", () => {
    const err = new Result.Err(1);
    const matched = Result.match(
      err,
      (value) => value + 1,
      (error) => error + 2,
    );
    assertEquals(matched, 3);
  });
});

Deno.test("fromThrowable", async (t) => {
  await t.step("should return Ok when function succeeds", () => {
    const result = Result.fromThrowable(
      () => 42,
      (e) => String(e),
    );
    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), 42);
  });

  await t.step("should return Err when function throws", () => {
    const result = Result.fromThrowable(
      () => {
        throw new Error("test error");
      },
      (e) => (e as Error).message,
    );
    assertEquals(result.ok(), false);
    assertEquals(result.unwrapErr(), "test error");
  });

  await t.step("should handle different error types", () => {
    const result = Result.fromThrowable(
      () => {
        throw "string error";
      },
      (e) => String(e),
    );
    assertEquals(result.ok(), false);
    assertEquals(result.unwrapErr(), "string error");
  });

  await t.step("should work with complex return types", () => {
    const result = Result.fromThrowable(
      () => ({ name: "test", value: 123 }),
      (e) => String(e),
    );
    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), { name: "test", value: 123 });
  });
});

Deno.test("Error messages", async (t) => {
  await t.step(
    "should throw correct error message when calling unwrap on Err",
    () => {
      const err = new Result.Err("test error");
      assertThrows(() => err.unwrap(), "called `unwrap` on an `Err` value");
    },
  );

  await t.step(
    "should throw correct error message when calling unwrapErr on Ok",
    () => {
      const ok = new Result.Ok("test value");
      assertThrows(() => ok.unwrapErr(), "called `unwrapErr` on an `Ok` value");
    },
  );
});

Deno.test("Type narrowing", async (t) => {
  await t.step("should narrow type after ok() check", () => {
    const result =
      Math.random() > 0.5 ? new Result.Ok("success") : new Result.Err(404);

    if (result.ok()) {
      assertEquals(typeof result.unwrap(), "string");
      assertEquals(result.unwrap(), "success");
    } else {
      assertEquals(typeof result.unwrapErr(), "number");
      assertEquals(result.unwrapErr(), 404);
    }
  });

  await t.step("should narrow type after err() check", () => {
    const result =
      Math.random() > 0.5 ? new Result.Ok(42) : new Result.Err("error");

    if (result.err()) {
      assertEquals(typeof result.unwrapErr(), "string");
      assertEquals(result.unwrapErr(), "error");
    } else {
      assertEquals(typeof result.unwrap(), "number");
      assertEquals(result.unwrap(), 42);
    }
  });
});

Deno.test("Complex chaining", async (t) => {
  await t.step("should chain multiple operations", () => {
    const result = pipe(
      new Result.Ok(42),
      Result.map((n) => n * 2),
      Result.andThen((n) => new Result.Ok(n + 10)),
    );

    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), 94);
  });

  await t.step("should short-circuit on errors", () => {
    const result = pipe(
      new Result.Err("initial error"),
      Result.map((n) => n * 2),
      Result.andThen((n) => new Result.Ok(n + 10)),
    );

    assertEquals(result.ok(), false);
    assertEquals(result.unwrapErr(), "initial error");
  });

  await t.step("should handle mixed map and andThen operations", () => {
    const result = pipe(
      new Result.Ok("hello"),
      Result.map((s) => s.length),
      Result.andThen((n) =>
        n > 3 ? new Result.Ok(n * 2) : new Result.Err("Too short"),
      ),
      Result.mapErr((e) => `Error: ${e}`),
    );

    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), 10);
  });
});

Deno.test("Integration scenarios", async (t) => {
  await t.step("should handle JSON parsing with validation", () => {
    const json = '{"name": "Alice", "age": 30}';
    const result = pipe(
      Result.fromThrowable(
        () => JSON.parse(json),
        (e) => `Invalid JSON: ${(e as Error).message}`,
      ),
      Result.andThen((obj) =>
        !obj.name || typeof obj.name !== "string"
          ? new Result.Err("Missing or invalid name")
          : !obj.age || typeof obj.age !== "number"
            ? new Result.Err("Missing or invalid age")
            : new Result.Ok({ name: obj.name, age: obj.age }),
      ),
    );

    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), { name: "Alice", age: 30 });
  });

  await t.step("should handle file processing workflow", () => {
    const result = pipe(
      new Result.Ok("file content") as Result.Result<string, string>,
      Result.andThen((content) => {
        const lines = content.split("\n").filter((line) => line.trim());
        if (lines.length === 0) return new Result.Err("INVALID_FORMAT");
        return new Result.Ok(
          lines.map((line, i) => ({ line: i + 1, content: line.trim() })),
        );
      }),
      Result.andThen((data) => new Result.Ok(data.length)),
    );

    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), 1);
  });
});
