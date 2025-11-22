const ITERATIONS = 1_000_000;

// Setup: A constant string
const input = "hello_world_typical_variable_name";

const now =
  typeof performance !== "undefined" && performance.now
    ? () => performance.now()
    : () => Date.now();

function measure(name: string, fn: (str: string) => string) {
  let totalLen = 0;
  // Warmup
  for (let k = 0; k < 1000; k++) fn(input);

  const start = now();
  for (let i = 0; i < ITERATIONS; i++) {
    totalLen += fn(input).length;
  }
  const end = now();

  console.log(`${name.padEnd(25)}: ${(end - start).toFixed(2)}ms`);
  return totalLen;
}

console.log(`Processing Strings x ${ITERATIONS.toLocaleString()}...`);

// SCENARIO: pipe(str, s => s.toUpperCase())

// 1. Closure (IIFE)
measure("Closure (IIFE)", (str) => {
  // ((s) => s.toUpperCase())(str)
  return ((s) => s.toUpperCase())(str);
});

// 2. Direct Inline
measure("Direct Inline", (str) => {
  // str.toUpperCase()
  return str.toUpperCase();
});
