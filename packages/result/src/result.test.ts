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
