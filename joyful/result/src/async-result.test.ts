// deno-lint-ignore-file require-await require-yield

import { assertEquals, assertInstanceOf, assertRejects } from "std/assert";
import { AsyncResult } from "./async-result.ts";
import { Result, taggedError } from "./main.ts";

class ValidationError extends taggedError("ValidationError")<{
  field: string;
}> {}

class NetworkError extends taggedError("NetworkError")<{
  status: number;
}> {}

Deno.test("AsyncResult Core", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).isOk(),
    true,
  );
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).isErr(),
    false,
  );
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err(2))).isOk(),
    false,
  );
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err(2))).isErr(),
    true,
  );
});

Deno.test("AsyncResult.unwrapOr", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).unwrapOr(1),
    2,
  );
  assertEquals(
    await new AsyncResult(
      Promise.resolve(Result.err<void, number>(undefined)),
    ).unwrapOr(1),
    1,
  );
});

Deno.test("AsyncResult.expect", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).expect("error"),
    2,
  );

  await assertRejects(
    () =>
      new AsyncResult(Promise.resolve(Result.err(undefined))).expect("error"),
    Error,
    "error",
  );
});

Deno.test("AsyncResult.expectErr", async () => {
  await assertRejects(
    () => new AsyncResult(Promise.resolve(Result.ok(2))).expectErr("error"),
    Error,
    "error",
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err(undefined))).expectErr(
      "error",
    ),
    undefined,
  );
});

Deno.test("AsyncResult.map", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).map((x) => x + 1),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).map(
      async (x) => x + 1,
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(
      Promise.resolve(Result.err<void, number>(undefined)),
    ).map((x) => x + 1),
    Result.err(undefined),
  );
});

Deno.test("AsyncResult.mapErr", async () => {
  assertEquals(
    await new AsyncResult(
      Promise.resolve(Result.ok<void, number>(undefined)),
    ).mapErr((x) => x + 1),
    Result.ok(undefined),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).mapErr(
      (x) => x + 1,
    ),
    Result.err(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).mapErr(
      async (x) => x + 1,
    ),
    Result.err(3),
  );
});

Deno.test("AsyncResult.andThen", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).andThen((x) =>
      Result.ok(x + 1)
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).andThen(
      (x) => new AsyncResult(Promise.resolve(Result.ok(x + 1))),
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).andThen(async (x) =>
      Result.ok(x + 1)
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(
      Promise.resolve(Result.err<void, number>(undefined)),
    ).andThen((x) => Result.ok(x + 1)),
    Result.err(undefined),
  );
});

Deno.test("AsyncResult.orElse", async () => {
  assertEquals(
    await new AsyncResult(Promise.resolve(Result.ok(2))).orElse((x) =>
      Result.ok(x + 1)
    ),
    Result.ok(2),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).orElse(
      (x) => Result.ok(x + 1),
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).orElse(
      (x) => new AsyncResult(Promise.resolve(Result.ok(x + 1))),
    ),
    Result.ok(3),
  );

  assertEquals(
    await new AsyncResult(Promise.resolve(Result.err<number, void>(2))).orElse(
      async (x) => Result.ok(x + 1),
    ),
    Result.ok(3),
  );
});

Deno.test("AsyncResult.orElseMatch recovers handled errors", async () => {
  const result: AsyncResult<number, ValidationError | NetworkError> =
    new AsyncResult(
      Promise.resolve(Result.err(new ValidationError({ field: "email" }))),
    );

  const recovered: Result<number | string, boolean> = await result.orElseMatch({
    ValidationError: (error) => Result.ok(`invalid:${error.field}`),
    NetworkError: (error) => Result.err(error.status === 503),
  });

  assertEquals(recovered, Result.ok("invalid:email"));
});

Deno.test("AsyncResult.orElseMatch supports async handlers", async () => {
  const result: AsyncResult<number, ValidationError | NetworkError> =
    new AsyncResult(
      Promise.resolve(Result.err(new ValidationError({ field: "email" }))),
    );

  const recovered: Result<number | string, string> = await result.orElseMatch({
    ValidationError: (error) =>
      new AsyncResult(Promise.resolve(Result.err(`invalid:${error.field}`))),
    NetworkError: async (error) => Result.err(`retry:${error.status}`),
  });

  assertEquals(recovered, Result.err("invalid:email"));
});

Deno.test("AsyncResult.orElseMatch leaves ok results unchanged", async () => {
  const result: AsyncResult<number, ValidationError | NetworkError> =
    new AsyncResult(Promise.resolve(Result.ok(123)));

  const recovered = await result.orElseMatch({
    ValidationError: (error) => Result.ok(`invalid:${error.field}`),
    NetworkError: (error) => Result.err(`retry:${error.status}`),
  });

  assertEquals(recovered, Result.ok(123));
});

Deno.test("AsyncResult.orElseMatchSome recovers handled errors", async () => {
  const result: AsyncResult<number, ValidationError | NetworkError> =
    new AsyncResult(
      Promise.resolve(Result.err(new ValidationError({ field: "email" }))),
    );

  const recovered: Result<number | string, NetworkError> = await result
    .orElseMatchSome({
      ValidationError: (error) => Result.ok(`invalid:${error.field}`),
    });

  assertEquals(recovered, Result.ok("invalid:email"));
});

Deno.test("AsyncResult.orElseMatchSome can remap handled errors", async () => {
  const result: AsyncResult<number, ValidationError | NetworkError> =
    new AsyncResult(
      Promise.resolve(Result.err(new ValidationError({ field: "email" }))),
    );

  const recovered: Result<number | string, NetworkError | string> = await result
    .orElseMatchSome({
      ValidationError: async (error) => Result.err(`invalid:${error.field}`),
    });

  assertEquals(recovered, Result.err("invalid:email"));
});

Deno.test(
  "AsyncResult.orElseMatchSome leaves unhandled errors unchanged",
  async () => {
    const result: AsyncResult<number, ValidationError | NetworkError> =
      new AsyncResult(
        Promise.resolve(Result.err(new NetworkError({ status: 503 }))),
      );

    const remaining = await result.orElseMatchSome({
      ValidationError: (error) => Result.ok(`invalid:${error.field}`),
    });

    assertEquals(remaining.isErr(), true);

    if (remaining.isErr()) {
      assertInstanceOf(remaining.error, NetworkError);
      assertEquals(remaining.error.status, 503);
    }
  },
);

Deno.test(
  "AsyncResult.orElseMatchSome leaves ok results unchanged",
  async () => {
    const result: AsyncResult<number, ValidationError | NetworkError> =
      new AsyncResult(Promise.resolve(Result.ok(123)));

    const remaining = await result.orElseMatchSome({
      ValidationError: (error) => Result.ok(error.field),
    });

    assertEquals(remaining, Result.ok(123));
  },
);

Deno.test("AsyncResult.inspect", async () => {
  let value = 0;
  await new AsyncResult(Promise.resolve(Result.ok(2))).inspect((x) => {
    value = x;
  });
  assertEquals(value, 2);

  value = 0;
  await new AsyncResult(
    Promise.resolve(Result.err<void, number>(undefined)),
  ).inspect((x) => {
    value = x;
  });
  assertEquals(value, 0);
});

Deno.test("AsyncResult.inspectErr", async () => {
  let value = 0;
  await new AsyncResult(
    Promise.resolve(Result.ok<void, number>(undefined)),
  ).inspectErr((x) => {
    value = x;
  });
  assertEquals(value, 0);

  value = 0;
  await new AsyncResult(Promise.resolve(Result.err(2))).inspectErr((x) => {
    value = x;
  });
  assertEquals(value, 2);
});

Deno.test("AsyncResult.wrap", async () => {
  assertEquals(
    await AsyncResult.wrap({
      try: () => Promise.resolve(2),
      catch: () => "boom",
    }),
    Result.ok(2),
  );

  assertEquals(
    await AsyncResult.wrap({
      try: () => Promise.reject(new Error("boom")),
      catch: (error) => error instanceof Error ? error.message : String(error),
    }),
    Result.err("boom"),
  );

  assertEquals(
    await AsyncResult.wrap({
      try: (): Promise<number> => {
        throw new Error("boom");
      },
      catch: (error) => error instanceof Error ? error.message : String(error),
    }),
    Result.err("boom"),
  );
});

Deno.test("AsyncResult.wrapAbortable", async () => {
  const controller = new AbortController();

  assertEquals(
    await AsyncResult.wrapAbortable(
      {
        try: async (signal) => {
          assertEquals(signal, controller.signal);
          return 2;
        },
        catch: () => "boom",
      },
      { signal: controller.signal },
    ),
    Result.ok(2),
  );

  const cancelled = await AsyncResult.wrapAbortable(
    {
      try: async (signal) => {
        signal.throwIfAborted?.();
        return 1;
      },
      catch: () => "boom",
    },
    { signal: AbortSignal.abort("timeout") },
  );

  assertEquals(cancelled.isErr(), true);
  if (cancelled.isErr()) {
    assertInstanceOf(cancelled.error, AsyncResult.Cancelled);
  }

  const abortedByReject = await AsyncResult.wrapAbortable(
    {
      try: () => Promise.reject(new DOMException("aborted", "AbortError")),
      catch: () => "boom",
    },
    { signal: new AbortController().signal },
  );

  assertEquals(abortedByReject.isErr(), true);
  if (abortedByReject.isErr()) {
    assertInstanceOf(abortedByReject.error, AsyncResult.Cancelled);
  }

  const laterController = new AbortController();
  const cancelledWhilePending = AsyncResult.wrapAbortable(
    {
      try: () => new Promise<number>(() => {}),
      catch: () => "boom",
    },
    { signal: laterController.signal },
  );

  laterController.abort("stop");
  const laterResult = await cancelledWhilePending;
  assertEquals(laterResult.isErr(), true);
  if (laterResult.isErr()) {
    assertInstanceOf(laterResult.error, AsyncResult.Cancelled);
  }
});

Deno.test("AsyncResult.run", async () => {
  assertEquals(
    await Result.run(async function* () {
      const first = yield* Result.ok(2).async();
      const second = yield* new AsyncResult(Promise.resolve(Result.ok(3)));
      return first + second;
    }),
    Result.ok(5),
  );

  assertEquals(
    await Result.run(async function* () {
      const first = yield* Result.ok(2).async();
      return Result.ok(first + 3);
    }),
    Result.ok(5),
  );

  assertEquals(
    await Result.run(async function* () {
      const first = yield* Result.ok(2).async();
      return Result.err(`boom:${first}`);
    }),
    Result.err("boom:2"),
  );

  let reached = false;
  assertEquals(
    await Result.run(async function* () {
      yield* new AsyncResult(Promise.resolve(Result.err("boom")));
      reached = true;
      return 1;
    }),
    Result.err("boom"),
  );
  assertEquals(reached, false);

  const validationError = new ValidationError({ field: "email" });
  assertEquals(
    await Result.run(async function* () {
      yield* validationError;
      return "unreachable";
    }),
    Result.err(validationError),
  );

  await assertRejects(
    () =>
      Result.run(async function* () {
        throw new Error("boom");
      }).expect("unreachable"),
    Error,
    "Error in Result.run generator: Error: boom",
  );
});
