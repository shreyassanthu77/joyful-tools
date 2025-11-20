import { pipe } from "@joyful/pipe";
import { Result } from "@joyful/result";
import { describe, expect, it } from "vitest";

describe("Core", () => {
  it("ok and err", () => {
    const ok = new Result.Ok("hello");
    expect(ok.ok()).toBe(true);
    expect(ok.err()).toBe(false);

    const err = new Result.Err("hello");
    expect(err.ok()).toBe(false);
    expect(err.err()).toBe(true);
  });

  it("unwrap and unwrapErr", () => {
    const ok = new Result.Ok("hello");
    expect(ok.unwrap()).toBe("hello");
    expect(() => ok.unwrapErr()).toThrow();

    const err = new Result.Err("hello");
    expect(() => err.unwrap()).toThrow();
    expect(err.unwrapErr()).toBe("hello");
  });

  it("unwrapOr", () => {
    const ok = new Result.Ok("hello");
    expect(ok.unwrapOr("world")).toBe("hello");

    const err = new Result.Err<string, string>("hello");
    expect(err.unwrapOr("world")).toBe("world");
  });
});

describe("map", () => {
  it("should map an Ok value (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.map((value) => value + 1),
    );

    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("should map an Ok value (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.map(ok, (value) => value + 1);

    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("should not map an Err value (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.map((value) => value + 1),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });

  it("should not map an Err value (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.map(err, (value) => value + 1);
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });
});

describe("mapErr", () => {
  it("should map an Err value (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.mapErr((error) => error + 1),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });

  it("should map an Err value (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.mapErr(err, (error) => error + 1);
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });

  it("should not map an Ok value (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.mapErr((error) => error + 1),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });

  it("should not map an Ok value (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.mapErr(ok, (error) => error + 1);
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });
});

describe("andThen", () => {
  it("Ok + Ok1 => Ok1 (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.andThen((value) => new Result.Ok(value + 1)),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("Ok + Ok1 => Ok1 (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.andThen(ok, (value) => new Result.Ok(value + 1));
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("Ok + Err => Err (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.andThen((value) => new Result.Err(value + 1)),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });

  it("Ok + Err => Err (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.andThen(ok, (value) => new Result.Err(value + 1));
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });

  it("Err + Ok => Err (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.andThen((value) => new Result.Ok(value + 1)),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });

  it("Err + Ok => Err (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.andThen(err, (value) => new Result.Ok(value + 1));
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });

  it("Err + Err1 => Err (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.andThen((value) => new Result.Err(value + 1)),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });

  it("Err + Err1 => Err (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.andThen(err, (value) => new Result.Err(value + 1));
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });
});

describe("orElse", () => {
  it("Ok + Ok1 => Ok (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.orElse((error) => new Result.Ok(error + 1)),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });

  it("Ok + Ok1 => Ok (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.orElse(ok, (error) => new Result.Ok(error + 1));
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });

  it("Ok + Err => Ok (curried)", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.orElse((error) => new Result.Err(error + 1)),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });

  it("Ok + Err => Ok (binary)", () => {
    const ok = new Result.Ok(1);
    const mapped = Result.orElse(ok, (error) => new Result.Err(error + 1));
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });

  it("Err + Ok => Ok (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.orElse((error) => new Result.Ok(error + 1)),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("Err + Ok => Ok (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.orElse(err, (error) => new Result.Ok(error + 1));
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("Err + Err1 => Err1 (curried)", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.orElse((error) => new Result.Err(error + 1)),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });

  it("Err + Err1 => Err1 (binary)", () => {
    const err = new Result.Err(1);
    const mapped = Result.orElse(err, (error) => new Result.Err(error + 1));
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });
});

describe("match", () => {
  it("should match Ok (curried)", () => {
    const ok = new Result.Ok(1);
    const matched = pipe(
      ok,
      Result.match(
        (value) => value + 1,
        (error) => error + 2,
      ),
    );
    expect(matched).toBe(2);
  });

  it("should match Ok (binary)", () => {
    const ok = new Result.Ok(1);
    const matched = Result.match(
      ok,
      (value) => value + 1,
      (error) => error + 2,
    );
    expect(matched).toBe(2);
  });

  it("should match Err (curried)", () => {
    const err = new Result.Err(1);
    const matched = pipe(
      err,
      Result.match(
        (value) => value + 1,
        (error) => error + 2,
      ),
    );
    expect(matched).toBe(3);
  });

  it("should match Err (binary)", () => {
    const err = new Result.Err(1);
    const matched = Result.match(
      err,
      (value) => value + 1,
      (error) => error + 2,
    );
    expect(matched).toBe(3);
  });
});

describe("fromThrowable", () => {
  it("should return Ok when function succeeds", () => {
    const result = Result.fromThrowable(() => 42, (e) => String(e));
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  it("should return Err when function throws", () => {
    const result = Result.fromThrowable(() => {
      throw new Error("test error");
    }, (e) => (e as Error).message);
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe("test error");
  });

  it("should handle different error types", () => {
    const result = Result.fromThrowable(() => {
      throw "string error";
    }, (e) => String(e));
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe("string error");
  });

  it("should work with complex return types", () => {
    const result = Result.fromThrowable(() => ({ name: "test", value: 123 }), (e) => String(e));
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toEqual({ name: "test", value: 123 });
  });
});

describe("Error messages", () => {
  it("should throw correct error message when calling unwrap on Err", () => {
    const err = new Result.Err("test error");
    expect(() => err.unwrap()).toThrow("called `unwrap` on an `Err` value");
  });

  it("should throw correct error message when calling unwrapErr on Ok", () => {
    const ok = new Result.Ok("test value");
    expect(() => ok.unwrapErr()).toThrow("called `unwrapErr` on an `Ok` value");
  });
});

describe("Type narrowing", () => {
  it("should narrow type after ok() check", () => {
    const result = Math.random() > 0.5 
      ? new Result.Ok("success") 
      : new Result.Err(404);
    
    if (result.ok()) {
      expect(typeof result.unwrap()).toBe("string");
      expect(result.unwrap()).toBe("success");
    } else {
      expect(typeof result.unwrapErr()).toBe("number");
      expect(result.unwrapErr()).toBe(404);
    }
  });

  it("should narrow type after err() check", () => {
    const result = Math.random() > 0.5 
      ? new Result.Ok(42) 
      : new Result.Err("error");
    
    if (result.err()) {
      expect(typeof result.unwrapErr()).toBe("string");
      expect(result.unwrapErr()).toBe("error");
    } else {
      expect(typeof result.unwrap()).toBe("number");
      expect(result.unwrap()).toBe(42);
    }
  });
});

describe("Complex chaining", () => {
  it("should chain multiple operations", () => {
    const result = pipe(
      new Result.Ok(42),
      Result.map((n) => n * 2),
      Result.andThen((n) => new Result.Ok(n + 10))
    );

    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(94);
  });

  it("should short-circuit on errors", () => {
    const result = pipe(
      new Result.Err("initial error"),
      Result.map((n) => n * 2),
      Result.andThen((n) => new Result.Ok(n + 10))
    );

    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe("initial error");
  });

  it("should handle mixed map and andThen operations", () => {
    const result = pipe(
      new Result.Ok("hello"),
      Result.map((s) => s.length),
      Result.andThen((n) => n > 3 ? new Result.Ok(n * 2) : new Result.Err("Too short")),
      Result.mapErr((e) => `Error: ${e}`)
    );

    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(10);
  });
});

describe("Integration scenarios", () => {
  it("should handle JSON parsing with validation", () => {
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
          : new Result.Ok({ name: obj.name, age: obj.age })
      )
    );

    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toEqual({ name: "Alice", age: 30 });
  });

  it("should handle file processing workflow", () => {
    const result = pipe(
      new Result.Ok("file content"),
      Result.andThen((content) => {
        const lines = content.split("\n").filter((line) => line.trim());
        if (lines.length === 0) return new Result.Err("INVALID_FORMAT");
        return new Result.Ok(
          lines.map((line, i) => ({ line: i + 1, content: line.trim() })),
        );
      }),
      Result.andThen((data) => new Result.Ok(data.length))
    );

    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(1);
  });
});
