const ITERATIONS = 10_000_000;
let globalSink = 0; // Prevents dead-code elimination optimization

// Universal timer
const now =
  typeof performance !== "undefined" && performance.now
    ? () => performance.now()
    : () => Date.now();

function measure(name: string, fn: () => void) {
  // Warmup (lets the JIT compiler optimize the function)
  for (let i = 0; i < 1000; i++) fn();

  const start = now();
  for (let i = 0; i < ITERATIONS; i++) {
    fn();
  }
  const end = now();

  console.log(`${name.padEnd(25)}: ${(end - start).toFixed(2)}ms`);
}

console.log(
  `Environment: ${typeof window !== "undefined" ? "Browser" : "Runtime"}`,
);
console.log(`Running ${ITERATIONS.toLocaleString()} iterations per test...\n`);

// -------------------------------------------------------
// SCENARIO 1: The Naive Transform (IIFE / Closure)
// Generates: ((x) => [x, x])(Math.random())
// -------------------------------------------------------
measure("Closure (IIFE)", () => {
  const res = ((x) => [x, x])(Math.random());
  globalSink += res[0];
});

// -------------------------------------------------------
// SCENARIO 2: The Clean Transform (Temp Var + Sequence)
// Generates: let _t; (_t = Math.random(), [_t, _t])
// -------------------------------------------------------
measure("Temp Var (Sequence)", () => {
  let _t;
  const res = ((_t = Math.random()), [_t, _t]);
  globalSink += res[0];
});

// -------------------------------------------------------
// SCENARIO 3: Named Function (Static)
// Generates: helper(Math.random())
// -------------------------------------------------------
function helper(x: number) {
  return [x, x];
}
measure("Named Function", () => {
  const res = helper(Math.random());
  globalSink += res[0];
});

console.log(`\nDone. Global Checksum: ${globalSink}`);
