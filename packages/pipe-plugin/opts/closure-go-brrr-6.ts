const ITERATIONS = 10_000;
const input = 10.5;

// 1. The Closure Approach
function testClosure(x: number) {
  let res = 0;
  // We simulate the loop here to see how the JIT handles the closure inside a loop
  for (let i = 0; i < ITERATIONS; i++) {
    res += ((val) => val * 2)(x);
  }
  return res;
}

// 2. The Inline Approach
function testInline(x: number) {
  let res = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    res += x * 2;
  }
  return res;
}

// Warmup (Force JIT compilation)
// V8 usually optimizes after ~2 invocations if the function is hot,
// or after a certain tick count. We just spam it.
for (let i = 0; i < 5000; i++) {
  testClosure(i);
  testInline(i);
}

// Actual run (to ensure it stays optimized)
testClosure(input);
testInline(input);
