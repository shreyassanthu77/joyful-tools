import { assertEquals, assertInstanceOf } from "std/assert";
import { Result, taggedError } from "./main.ts";

class TransientError extends taggedError("TransientError")<{
  code: number;
}> {}

class PermanentError extends taggedError("PermanentError")<{
  reason: string;
}> {}

Deno.test("Result.retry succeeds on first attempt", async () => {
  let calls = 0;
  const result = await Result.retry(
    () => {
      calls++;
      return Result.ok(42);
    },
    { schedule: [10, 20] },
  );

  assertEquals(result, Result.ok(42));
  assertEquals(calls, 1);
});

Deno.test("Result.retry succeeds after transient failures", async () => {
  let calls = 0;
  const result = await Result.retry(
    () => {
      calls++;
      if (calls < 3) {
        return Result.err(new TransientError({ code: 503 }));
      }
      return Result.ok("recovered");
    },
    { schedule: [10, 20, 30] },
  );

  assertEquals(result.isOk(), true);
  if (result.isOk()) {
    assertEquals(result.value, "recovered");
  }
  assertEquals(calls, 3);
});

Deno.test(
  "Result.retry returns RetriesExhausted when schedule is exhausted",
  async () => {
    let calls = 0;
    const result = await Result.retry(
      () => {
        calls++;
        return Result.err(new TransientError({ code: 503 }));
      },
      { schedule: [10, 20] },
    );

    assertEquals(result.isErr(), true);
    if (result.isErr()) {
      assertInstanceOf(result.error, Result.RetriesExhausted);
      assertEquals(result.error.attempts, 3); // 1 initial + 2 retries
      assertInstanceOf(result.error.lastError, TransientError);
    }
    assertEquals(calls, 3);
  },
);

Deno.test("Result.retry stops early when while returns false", async () => {
  let calls = 0;
  const result = await Result.retry(
    () => {
      calls++;
      return Result.err(new PermanentError({ reason: "not found" }));
    },
    {
      schedule: [10, 20, 30],
      while: (err) => !(err instanceof PermanentError),
    },
  );

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    // Should return the original error, not RetriesExhausted
    assertInstanceOf(result.error, PermanentError);
  }
  assertEquals(calls, 1);
});

Deno.test("Result.retry while predicate receives attempt number", async () => {
  const attempts: number[] = [];
  await Result.retry(
    (_attempt) => {
      return Result.err(new TransientError({ code: 503 }));
    },
    {
      schedule: [10, 20, 30],
      while: (_err, attempt) => {
        attempts.push(attempt);
        return attempt < 2;
      },
    },
  );

  assertEquals(attempts, [0, 1, 2]);
});

Deno.test("Result.retry passes attempt number to factory", async () => {
  const attempts: number[] = [];
  await Result.retry(
    (attempt) => {
      attempts.push(attempt);
      if (attempt === 2) return Result.ok("done");
      return Result.err(new TransientError({ code: 503 }));
    },
    { schedule: [10, 20, 30] },
  );

  assertEquals(attempts, [0, 1, 2]);
});

Deno.test("Result.retry works with AsyncResult factory", async () => {
  let calls = 0;
  const result = await Result.retry(
    () => {
      calls++;
      if (calls < 2) {
        return Result.err(new TransientError({ code: 500 })).async();
      }
      return Result.ok("async-ok").async();
    },
    { schedule: [10, 20] },
  );

  assertEquals(result.isOk(), true);
  if (result.isOk()) {
    assertEquals(result.value, "async-ok");
  }
  assertEquals(calls, 2);
});

Deno.test("Result.retry with empty schedule does not retry", async () => {
  let calls = 0;
  const result = await Result.retry(
    () => {
      calls++;
      return Result.err(new TransientError({ code: 503 }));
    },
    { schedule: [] },
  );

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, Result.RetriesExhausted);
    assertEquals(result.error.attempts, 1);
  }
  assertEquals(calls, 1);
});

Deno.test("Result.retry composes with Result.run via yield*", async () => {
  let retryCalls = 0;
  const result = await Result.run(async function* () {
    const value = yield* Result.retry(
      () => {
        retryCalls++;
        if (retryCalls < 2) {
          return Result.err(new TransientError({ code: 503 }));
        }
        return Result.ok(42);
      },
      { schedule: [10, 20] },
    );

    return value * 2;
  });

  assertEquals(result, Result.ok(84));
  assertEquals(retryCalls, 2);
});

Deno.test(
  "Result.retry RetriesExhausted composes with orElseMatch",
  async () => {
    const result = await Result.retry(
      () => Result.err(new TransientError({ code: 503 })),
      { schedule: [10] },
    ).orElseMatchSome({
      RetriesExhausted: (err) => Result.ok(`gave up after ${err.attempts}`),
    });

    assertEquals(result.isOk(), true);
    if (result.isOk()) {
      assertEquals(result.value, "gave up after 2");
    }
  },
);

Deno.test("Result.retry supports async while predicate", async () => {
  let calls = 0;
  const result = await Result.retry(
    () => {
      calls++;
      return Result.err(
        new PermanentError({ reason: "not found" }),
      );
    },
    {
      schedule: [10, 20, 30],
      while: async (err) => {
        // Simulate async check (e.g. probing a device)
        await new Promise((r) => setTimeout(r, 5));
        return err._tag !== "PermanentError";
      },
    },
  );

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, PermanentError);
  }
  assertEquals(calls, 1);
});
