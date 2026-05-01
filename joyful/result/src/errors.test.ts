import { assertEquals, assertInstanceOf } from "std/assert";
import { Result, taggedError } from "./main.ts";

class ValidationError extends taggedError("ValidationError")<{
  field: string;
}> {}

Deno.test("taggedError copies fields and preserves error metadata", () => {
  const cause = new SyntaxError("boom");
  const error = new ValidationError({
    field: "email",
    message: "Invalid email",
    cause,
  });

  assertInstanceOf(error, Error);
  assertInstanceOf(error, ValidationError);
  assertEquals(error._tag, "ValidationError");
  assertEquals(error.name, "ValidationError");
  assertEquals(error.message, "Invalid email");
  assertEquals(error.cause, cause);
  assertEquals(error.field, "email");
});

Deno.test("taggedError uses the tag as the default message", () => {
  const error = new ValidationError({ field: "email" });

  assertEquals(error.message, "ValidationError");
});

Deno.test("taggedError instances can be yielded in Result.run", () => {
  const error = new ValidationError({ field: "email" });
  let reached = false;

  const result = Result.run(function* () {
    yield* error;
    reached = true;
    return 1;
  });

  assertEquals(result, Result.err(error));
  assertEquals(reached, false);
});
