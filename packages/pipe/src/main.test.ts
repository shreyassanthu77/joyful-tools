import { pipe } from "@joyful/pipe";
import { assertEquals } from "assert";

const double = (value: number) => value * 2;
const square = (value: number) => value * value;
const add = (x: number) => (value: number) => value + x;

Deno.test("pipe", () => {
  const result = pipe(4, double, square, add(5));
  assertEquals(result, 69);
});
