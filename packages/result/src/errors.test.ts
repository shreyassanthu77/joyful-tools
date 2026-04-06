import { assertEquals, assertInstanceOf } from "std/assert";
import { Err } from "./result.ts";
import { matchError, matchErrorPartial, taggedError } from "./errors.ts";

class ValidationError extends taggedError("ValidationError")<{
  field: string;
}> {}

class NetworkError extends taggedError("NetworkError")<{
  status: number;
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

Deno.test("matchError dispatches by tagged error", () => {
  const result = new Err<unknown, ValidationError | NetworkError>(
    new NetworkError({ status: 503 }),
  );

  const value = matchError(result, {
    ValidationError: (error) => `invalid:${error.field}`,
    NetworkError: (error) => `retry:${error.status}`,
  });

  assertEquals(value, "retry:503");
});

Deno.test("matchErrorPartial falls back when a handler is missing", () => {
  const result = new Err<unknown, ValidationError | NetworkError>(
    new NetworkError({ status: 503 }),
  );

  const value = matchErrorPartial(
    result,
    {
      ValidationError: (error) => `invalid:${error.field}`,
    },
    () => "default",
  );

  assertEquals(value, "default");
});

Deno.test("matchErrorPartial uses the matching handler when present", () => {
  const result = new Err<unknown, ValidationError | NetworkError>(
    new ValidationError({ field: "email" }),
  );

  const value = matchErrorPartial(
    result,
    {
      ValidationError: (error) => `invalid:${error.field}`,
    },
    () => "default",
  );

  assertEquals(value, "invalid:email");
});
