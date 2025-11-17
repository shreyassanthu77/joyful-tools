import { Result } from "@joyful/result";
import { describe, expect, it } from "vitest";

describe("Result", () => {
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
});
