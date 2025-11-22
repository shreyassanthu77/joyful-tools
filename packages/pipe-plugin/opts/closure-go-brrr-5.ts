const SIZE = 100_000; // Smaller size, heavier work
const ITERATIONS = 100;

// 1. Generate UNIQUE inputs so V8 can't constant-fold the result
const inputs = Array.from(
  { length: SIZE },
  (_, i) => `variable_string_${i}_${Math.random()}`,
);

const now =
  typeof performance !== "undefined" && performance.now
    ? () => performance.now()
    : () => Date.now();

function measure(name: string, fn: (str: string) => string) {
  let totalLen = 0;
  // Warmup
  for (let k = 0; k < 10; k++) fn(inputs[k]);

  const start = now();
  for (let i = 0; i < ITERATIONS; i++) {
    for (let j = 0; j < SIZE; j++) {
      // actually perform the work on dynamic data
      totalLen += fn(inputs[j]).length;
    }
  }
  const end = now();

  console.log(`${name.padEnd(25)}: ${(end - start).toFixed(2)}ms`);
  return totalLen;
}

console.log(
  `Processing ${SIZE.toLocaleString()} unique strings x ${ITERATIONS} times...`,
);

// TEST 1: Closure
measure("Closure (IIFE)", (str) => {
  return ((s) => s.toUpperCase())(str);
});

// TEST 2: Direct Inline
measure("Direct Inline", (str) => {
  return str.toUpperCase();
});
