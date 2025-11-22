const ITERATIONS = 10_000_000;
let globalSink = 0;

const now =
  typeof performance !== "undefined" && performance.now
    ? () => performance.now()
    : () => Date.now();

function measure(name: string, fn: () => void) {
  // Warmup
  for (let i = 0; i < 1000; i++) fn();

  const start = now();
  for (let i = 0; i < ITERATIONS; i++) {
    fn();
  }
  const end = now();

  console.log(`${name.padEnd(30)}: ${(end - start).toFixed(2)}ms`);
}

console.log(`Running ${ITERATIONS.toLocaleString()} iterations...\n`);

// =================================================================
// TEST 1: PURE MATH (The majority of pipes)
// pipe(i, x => x * 2)
// =================================================================
console.log("--- CATEGORY 1: Simple Math (x * 2) ---");

// A: The "Naive" IIFE
measure("A. Closure (IIFE)", () => {
  const i = Math.random();
  // ((x) => x * 2)(i)
  const res = ((x) => x * 2)(i);
  globalSink += res;
});

// B: The "Hoisted" Temp Var
measure("B. Temp Var (Sequence)", () => {
  const i = Math.random();
  let _t;
  // (_t = i, _t * 2)
  const res = ((_t = i), _t * 2);
  globalSink += res;
});

// C: The "Hybrid" Inlining (Our optimization)
measure("C. Direct Inline", () => {
  const i = Math.random();
  // i * 2
  const res = i * 2;
  globalSink += res;
});

console.log("\n");

// =================================================================
// TEST 2: COMPLEX / ALLOCATING
// pipe(createObj(), x => [x, x])
// =================================================================
console.log("--- CATEGORY 2: Object Creation (Reuse) ---");

const createObj = () => ({ a: 1 });

// A: The "Naive" IIFE (V8 native opt)
measure("A. Closure (IIFE)", () => {
  // ((x) => [x, x])(createObj())
  let res = ((x) => [x, x])(createObj());
  globalSink += res[0].a;
});

// B: The "Hoisted" Temp Var (Manual opt)
measure("B. Temp Var (Sequence)", () => {
  let _t;
  // (_t = createObj(), [_t, _t])
  let res = ((_t = createObj()), [_t, _t]);
  globalSink += res[0].a;
});

console.log(`\nDone. Checksum: ${globalSink}`);
