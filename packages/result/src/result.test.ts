import { assertEquals, assertInstanceOf, assertThrows } from "std/assert";
import { Result } from "./main.ts";

class ValidationError extends Result.taggedError("ValidationError")<{
  field: string;
}> {}

class NetworkError extends Result.taggedError("NetworkError")<{
  status: number;
}> {}

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

Deno.test("Result.orElseMatch recovers handled errors", () => {
  const result: Result<number, ValidationError | NetworkError> = Result.err(
    new ValidationError({ field: "email" }),
  );

  const recovered = result.orElseMatch({
    ValidationError: (error) => Result.ok(`invalid:${error.field}`),
    NetworkError: (error) => Result.err(error.status === 503),
  });

  assertEquals(recovered, Result.ok("invalid:email"));
});

Deno.test("Result.orElseMatch can remap handled errors", () => {
  const result: Result<number, ValidationError | NetworkError> = Result.err(
    new ValidationError({ field: "email" }),
  );

  const recovered = result.orElseMatch({
    ValidationError: (error) => Result.err(`invalid:${error.field}`),
    NetworkError: (error) => Result.err(`retry:${error.status}`),
  });

  assertEquals(recovered, Result.err("invalid:email"));
});

Deno.test("Result.orElseMatch leaves ok results unchanged", () => {
  const result: Result<number, ValidationError | NetworkError> = Result.ok(123);

  const recovered = result.orElseMatch({
    ValidationError: (error) => Result.ok(`invalid:${error.field}`),
    NetworkError: (error) => Result.err(`retry:${error.status}`),
  });

  assertEquals(recovered, Result.ok(123));
});

Deno.test("Result.orElseMatchSome recovers handled errors", () => {
  const result: Result<number, ValidationError | NetworkError> = Result.err(
    new ValidationError({ field: "email" }),
  );

  const recovered = result.orElseMatchSome({
    ValidationError: (error) => Result.ok(`invalid:${error.field}`),
  });

  assertEquals(recovered, Result.ok("invalid:email"));
});

Deno.test("Result.orElseMatchSome can remap handled errors", () => {
  const result = Result.err(new ValidationError({ field: "email" }));

  const recovered = result.orElseMatchSome({
    ValidationError: (error) => Result.err(`invalid:${error.field}`),
  });

  assertEquals(recovered, Result.err("invalid:email"));
});

Deno.test("Result.orElseMatchSome leaves unhandled errors unchanged", () => {
  const result: Result<number, ValidationError | NetworkError> = Result.err(
    new NetworkError({ status: 503 }),
  );

  const remaining = result.orElseMatchSome({
    ValidationError: (error) => Result.ok(`invalid:${error.field}`),
  });

  assertEquals(remaining.isErr(), true);

  if (remaining.isErr()) {
    assertInstanceOf(remaining.error, NetworkError);
    assertEquals(remaining.error.status, 503);
  }
});

Deno.test("Result.orElseMatchSome leaves ok results unchanged", () => {
  const result: Result<number, ValidationError | NetworkError> = Result.ok(123);

  const remaining = result.orElseMatchSome({
    ValidationError: (error) => Result.ok(error.field),
  });

  assertEquals(remaining, Result.ok(123));
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

Deno.test("Result.wrap", async () => {
  assertEquals(
    Result.wrap({
      try: () => 2,
      catch: () => "boom",
    }),
    Result.ok(2),
  );

  assertEquals(
    Result.wrap({
      try: (): number => {
        throw new Error("boom");
      },
      catch: (error) =>
        error instanceof Error ? error.message : String(error),
    }),
    Result.err("boom"),
  );

  assertEquals(
    await Result.wrap({
      try: () => Promise.resolve(2),
      catch: () => "boom",
    }),
    Result.ok(2),
  );

  assertEquals(
    await Result.wrap({
      try: () => Promise.reject(new Error("boom")),
      catch: (error) =>
        error instanceof Error ? error.message : String(error),
    }),
    Result.err("boom"),
  );
});

Deno.test("Result.taggedError", () => {
  class JsonParseError extends Result.taggedError("JsonParseError")<{
    input: string;
  }> {}
  const cause = new SyntaxError("boom");

  const error = new JsonParseError({
    input: "not json",
    message: "Failed to parse JSON",
    cause,
  });

  assertInstanceOf(error, Error);
  assertInstanceOf(error, JsonParseError);
  assertEquals(error._tag, "JsonParseError");
  assertEquals(error.name, "JsonParseError");
  assertEquals(error.message, "Failed to parse JSON");
  assertEquals(error.cause, cause);
  assertEquals(error.input, "not json");

  const defaultMessageError = new JsonParseError({ input: "still not json" });
  assertEquals(defaultMessageError.message, "JsonParseError");

  const result = Result.wrap({
    try: (): number => {
      throw cause;
    },
    catch: (caught) =>
      new JsonParseError({
        input: "still not json",
        cause: caught,
      }),
  });

  assertEquals(result.isErr(), true);

  if (result.isErr()) {
    assertInstanceOf(result.error, JsonParseError);
    assertEquals(result.error._tag, "JsonParseError");
    assertEquals(result.error.message, "JsonParseError");
    assertEquals(result.error.input, "still not json");
    assertEquals(result.error.cause, cause);
  }
});

Deno.test("Result.run", () => {
  assertEquals(
    Result.run(function* () {
      const first = yield* Result.ok(2);
      const second = yield* Result.ok(3);
      return Result.ok(first + second);
    }),
    Result.ok(5),
  );

  let reached = false;
  assertEquals(
    Result.run(function* () {
      yield* Result.err("boom");
      reached = true;
      return Result.ok(1);
    }),
    Result.err("boom"),
  );
  assertEquals(reached, false);

  assertThrows(
    () =>
      // deno-lint-ignore require-yield
      Result.run(function* () {
        throw new Error("boom");
      }),
    Error,
    "Error in Result.run generator: Error: boom",
  );
});
