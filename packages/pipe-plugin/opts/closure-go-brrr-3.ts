const SIZE = 1_000_000;
const ITERATIONS = 10;

// 1. Pre-fill data to remove Math.random() noise
const data = new Float64Array(SIZE);
for (let i = 0; i < SIZE; i++) data[i] = Math.random();

const now =
  typeof performance !== "undefined" && performance.now
    ? () => performance.now()
    : () => Date.now();

function measure(name: string, fn: (arr: Float64Array) => number) {
  let total = 0;
  // Warmup
  fn(data);

  const start = now();
  for (let i = 0; i < ITERATIONS; i++) {
    total += fn(data);
  }
  const end = now();

  console.log(`${name.padEnd(25)}: ${(end - start).toFixed(2)}ms`);
  return total; // prevent dead code
}

console.log(
  `Processing ${SIZE.toLocaleString()} items x ${ITERATIONS} times...`,
);

// TEST 1: Closure (The "Naive" way)
// ((x) => x * 2)(val)
measure("Closure (IIFE)", (arr) => {
  let sink = 0;
  for (let i = 0; i < arr.length; i++) {
    sink += ((x) => x * 2)(arr[i]);
  }
  return sink;
});

// TEST 2: Direct Inline (The "Hybrid" way)
// val * 2
measure("Direct Inline", (arr) => {
  let sink = 0;
  for (let i = 0; i < arr.length; i++) {
    sink += arr[i] * 2;
  }
  return sink;
});
