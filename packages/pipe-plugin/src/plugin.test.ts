import { pipe } from "@joyful/pipe";
import { describe, expect, it } from "vitest";
import * as pipens from "@joyful/pipe";

const double = (value: number) => value * 2;
const square = (value: number) => value * value;
const add = (x: number) => (value: number) => value + x;

describe("pipe", () => {
  it("should work with regular import", () => {
    const result = pipe(4, double, square, add(5));
    expect(result).toBe(69);
  });

  it("should work with namespace import", () => {
    const result = pipens.pipe(4, double, square, add(5));
    expect(result).toBe(69);
  });

  it("should work with namespace import + a computed property", () => {
    const result = pipens["pipe"](4, double, square, add(5));
    expect(result).toBe(69);
  });
});
