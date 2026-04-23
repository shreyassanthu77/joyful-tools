import { assertEquals, assertInstanceOf } from "std/assert";
import { taggedError } from "./errors.ts";

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
