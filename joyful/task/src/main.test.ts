import { assertEquals, assertInstanceOf } from "std/assert";
import { Err, Ok, taggedError } from "@joyful/result";
import { Cancelled, RetriesExhausted, Task, TaskRun } from "./main.ts";

class TransientError extends taggedError("TransientError")<{
  code: number;
}> {}

class PermanentError extends taggedError("PermanentError")<{
  reason: string;
}> {}

Deno.test("Task is lazy and runs to a Result", async () => {
  let calls = 0;
  const task = new Task(() => {
    calls++;
    return new Ok(42);
  });

  assertEquals(calls, 0);
  assertEquals(await task.run(), new Ok(42));
  assertEquals(calls, 1);
});

Deno.test("Task.wrap catches sync throws and async rejections", async () => {
  const sync = Task.wrap(
    () => {
      throw new Error("boom");
    },
    (error) => (error instanceof Error ? error.message : String(error)),
  );

  assertEquals(await sync.run(), new Err("boom"));

  const asyncTask = Task.wrap(
    () => Promise.reject(new Error("async boom")),
    (error) => (error instanceof Error ? error.message : String(error)),
  );

  assertEquals(await asyncTask.run(), new Err("async boom"));
});

Deno.test("Task.do supports Result, TaskRun, and parameters", async () => {
  const add = new Task<[number, number], number, never>((_, a, b) => {
    return new Ok(a + b);
  });

  const program = Task.do(async function* (offset: number) {
    const a = yield* new Ok(2);
    const b = yield* add.run(3, 4);
    const c = yield* new TaskRun(Promise.resolve(new Ok(5)));
    return offset + a + b + c;
  });

  assertEquals(await program.run(10), new Ok(24));
});

Deno.test("Task.do short-circuits on yielded Err", async () => {
  let reached = false;
  const program = Task.do(async function* () {
    yield* new Err("boom");
    reached = true;
    return 1;
  });

  assertEquals(await program.run(), new Err("boom"));
  assertEquals(reached, false);
});

Deno.test("Task.all collects all task results", async () => {
  const run = Task.all({
    count: new Task(() => new Ok(42)).run(),
    message: new Task(() => new Err("nope")).run(),
  });

  assertEquals(
    await run,
    new Ok({
      count: new Ok(42),
      message: new Err("nope"),
    }),
  );
});

Deno.test("Task.orElseMatch recovers from tagged errors", async () => {
  const task = new Task<[], number, TransientError | PermanentError>(() => {
    return new Err(new TransientError({ code: 503 }));
  });

  const recovered = task.orElseMatch({
    TransientError: (error) => new Ok(error.code),
    PermanentError: (error) => new Err(error.reason),
  });

  assertEquals(await recovered.run(), new Ok(503));
});

Deno.test("Task.orElseMatchSome leaves unmatched tagged errors", async () => {
  const error = new PermanentError({ reason: "missing" });
  const task = new Task<[], number, TransientError | PermanentError>(() => {
    return new Err(error);
  });

  const recovered = task.orElseMatchSome({
    TransientError: (error) => new Ok(error.code),
  });

  assertEquals(await recovered.run(), new Err(error));
});

Deno.test("Task constructor receives the run signal", async () => {
  const signal = AbortSignal.abort("timeout");
  const result = new Task((_ctx) => {
    assertEquals(_ctx.signal, signal);
    return new Ok(1);
  }).runWith({
    signal,
  });

  assertEquals(await result, new Ok(1));
});

Deno.test(
  "Task.wrap returns Cancelled when signal is already aborted",
  async () => {
    const result = await Task.wrap(() => 1, String).runWith({
      signal: AbortSignal.abort("timeout"),
    });

    assertEquals(result.isErr(), true);
    if (result.isErr()) assertInstanceOf(result.error, Cancelled);
  },
);

Deno.test("Task.runWith retry succeeds after transient failures", async () => {
  let calls = 0;
  const task = new Task(() => {
    calls++;
    if (calls < 3) return new Err(new TransientError({ code: 503 }));
    return new Ok("recovered");
  });

  const result = await task.runWith({ retry: { schedule: [1, 1, 1] } });

  assertEquals(result, new Ok("recovered"));
  assertEquals(calls, 3);
});

Deno.test(
  "Task.runWith retry returns RetriesExhausted when schedule is exhausted",
  async () => {
    const task = new Task(() => new Err(new TransientError({ code: 503 })));
    const result = await task.runWith({ retry: { schedule: [1, 1] } });

    assertEquals(result.isErr(), true);
    if (result.isErr()) {
      assertInstanceOf(result.error, RetriesExhausted);
      assertEquals(result.error.attempts, 3);
    }
  },
);

Deno.test("Task.runWith retry stops early when while returns false", async () => {
  let calls = 0;
  const task = new Task(() => {
    calls++;
    return new Err(new PermanentError({ reason: "not found" }));
  });

  const result = await task.runWith({
    retry: {
      schedule: [1, 1, 1],
      while: (error) => !(error instanceof PermanentError),
    },
  });

  assertEquals(result.isErr(), true);
  if (result.isErr()) assertInstanceOf(result.error, PermanentError);
  assertEquals(calls, 1);
});
