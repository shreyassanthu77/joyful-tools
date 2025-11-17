import { pipe } from "@joyful/pipe";

const double = (x: number) => x * 2;
const square = (x: number) => x * x;
const addFive = (x: number) => x + 5;

// Basic usage
const result = pipe(4, double, square, addFive);
console.log(result);
