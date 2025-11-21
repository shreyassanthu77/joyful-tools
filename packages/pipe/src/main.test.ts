import { pipe } from "@joyful/pipe";
import { describe, expect, it } from "vitest";

const double = (value: number) => value * 2;
const square = (value: number) => value * value;
const add = (x: number) => (value: number) => value + x;

describe("pipe", () => {
  it("should work", () => {
    const result = pipe(4, double, square, add(5));
    expect(result).toBe(69);
  });
});
