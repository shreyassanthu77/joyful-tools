const ITERATIONS = 1000; // Keep low to keep ASM readable, but high enough to optimize
const input = "hello_world_invariant_string";

// 1. The Closure Approach (The "Fast" one)
function testClosure(str: string) {
  let total = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    // V8 might hoist this entire expression out of the loop
    let res = ((s) => s.toUpperCase())(str);
    total += res.length;
  }
  return total;
}

// 2. The Inline Approach (The "Slow" one)
function testInline(str: string) {
  let total = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    // V8 might be re-evaluating this every time
    let res = str.toUpperCase();
    total += res.length;
  }
  return total;
}

// Warmup
for (let i = 0; i < 5000; i++) {
  testClosure(input);
  testInline(input);
}

// Run
testClosure(input);
testInline(input);
