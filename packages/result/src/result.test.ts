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
  it("should map an Ok value", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.map((value) => value + 1),
    );

    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("should not map an Err value", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.map((value) => value + 1),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });
});

describe("mapErr", () => {
  it("should map an Err value", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.mapErr((error) => error + 1),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });

  it("should not map an Ok value", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.mapErr((error) => error + 1),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });
});

describe("andThen", () => {
  it("Ok + Ok1 => Ok1", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.andThen((value) => new Result.Ok(value + 1)),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("Ok + Err => Err", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.andThen((value) => new Result.Err(value + 1)),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });

  it("Err + Ok => Err", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.andThen((value) => new Result.Ok(value + 1)),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });

  it("Err + Err1 => Err", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.andThen((value) => new Result.Err(value + 1)),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(1);
  });
});

describe("orElse", () => {
  it("Ok + Ok1 => Ok", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.orElse((error) => new Result.Ok(error + 1)),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });

  it("Ok + Err => Ok", () => {
    const ok = new Result.Ok(1);
    const mapped = pipe(
      ok,
      Result.orElse((error) => new Result.Err(error + 1)),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(1);
  });

  it("Err + Ok => Ok", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.orElse((error) => new Result.Ok(error + 1)),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe(2);
  });

  it("Err + Err1 => Err1", () => {
    const err = new Result.Err(1);
    const mapped = pipe(
      err,
      Result.orElse((error) => new Result.Err(error + 1)),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe(2);
  });
});
