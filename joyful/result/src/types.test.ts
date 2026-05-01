// deno-lint-ignore-file
import { AsyncResult } from "./async-result.ts";
import { Result, taggedError } from "./main.ts";
import { attest, setup, teardown } from "@ark/attest";

Deno.test.beforeAll(() => void setup());
Deno.test.afterAll(() => void teardown());

Deno.test("Result<T, E>.(ok | err)", () => {
  attest<Result<string, never>>(Result.ok("foo"));
  attest<Result<never, string>>(Result.err("bar"));
});

Deno.test("Result.map should change the success type", () => {
  const ok: Result<number, string> = Result.ok(2);
  attest<Result<string, string>>(ok.map((value) => value.toString()));
});

Deno.test("Result.mapErr should change the error type", () => {
  const err: Result<number, string> = Result.err("boom");
  attest<Result<number, number>>(err.mapErr((error) => error.length));
});

Deno.test("Result.unwrapOr should widen the return type", () => {
  const ok: Result<string, Error> = Result.ok("hello");
  attest<string | null>(ok.unwrapOr(null));
  attest<string | 42>(ok.unwrapOr(42));

  const err: Result<string, Error> = Result.err(new Error("boom"));
  attest<string | null>(err.unwrapOr(null));
  attest<string | undefined>(err.unwrapOr(undefined));
});

Deno.test(
  "Result.andThen should change the success type and extend the error type",
  () => {
    const ok: Result<number, string> = Result.ok(2);
    attest<Result<string, string | number>>(
      ok.andThen((value) => Result.ok<string, number>(value.toString())),
    );
  },
);

Deno.test(
  "Result.orElse should change the error type and extend the success type",
  () => {
    const err: Result<number, string> = Result.err("boom");
    attest<Result<string | number, number>>(
      err.orElse((error) => Result.ok<string, number>(error)),
    );
  },
);

Deno.test(
  "Result.orElseMatch should change the error type and extend the success type",
  () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const v = Result.err<A | B, string>(new A({}));
    const res = v.orElseMatch({
      A: () => Result.ok("a"),
      B: () => Result.err(123),
    });
    attest(res).type.toString.snap("Result<string, number>");
  },
);

Deno.test(
  "Result.orElseMatch handlers should properly narrow the error type",
  () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    Result.err<A | B>(new A({})).orElseMatch({
      A: (a) => void attest(a).type.toString.snap("A"),
      B: () => Result.ok<never>(undefined as never),
    });

    Result.err<A | B>(new B({})).orElseMatch({
      A: () => Result.ok<never>(undefined as never),
      B: (b) => void attest(b).type.toString.snap("B"),
    });
  },
);

Deno.test(
  "Result.orElseMatchSome should remove the handled errors from the error type",
  () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const v = Result.err<A | B, string>(new A({}));
    const res = v.orElseMatchSome({
      A: () => Result.ok("a"),
    });
    attest(res).type.toString.snap("Result<string, B>"); // A is handled so removed from error type

    const v2 = Result.err<A | B, string>(new B({}));
    const res2 = v2.orElseMatchSome({
      A: () => Result.ok("a"),
      B: () => Result.ok("b"),
    });
    attest(res2).type.toString.snap("Result<string, never>"); // B is handled so removed from error type
  },
);

Deno.test(
  "Result.orElseMatchSome handlers should properly narrow the error type",
  () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    Result.err<A | B>(new A({})).orElseMatchSome({
      A: (a) => void attest(a).type.toString.snap("A"),
      B: () => Result.ok<never>(undefined as never),
    });

    Result.err<A | B>(new B({})).orElseMatchSome({
      A: () => Result.ok<never>(undefined as never),
      B: (b) => void attest(b).type.toString.snap("B"),
    });
  },
);

Deno.test("Result.orElseMatchSome should extend the success type", () => {
  class A extends taggedError("A") {}
  const v = Result.err<A, string>(new A({}));
  attest<Result<string | number, never>>(
    v.orElseMatchSome({
      A: () => Result.ok(123),
    }),
  );
});

// --- AsyncResult type tests ---

Deno.test("AsyncResult<T, E>.(map | mapErr)", async () => {
  const ok: AsyncResult<number, string> = Result.ok(2).async();
  attest<AsyncResult<string, string>>(ok.map((value) => value.toString()));

  const err: AsyncResult<number, string> = Result.err("boom").async();
  attest<AsyncResult<number, number>>(err.mapErr((error) => error.length));
});

Deno.test("AsyncResult.unwrapOr should widen the return type", async () => {
  const ok: AsyncResult<string, Error> = Result.ok("hello").async();
  attest<Promise<string | null>>(ok.unwrapOr(null));
  attest<Promise<string | number>>(ok.unwrapOr(42));

  const err: AsyncResult<string, Error> = Result.err(new Error("boom")).async();
  attest<Promise<string | null>>(err.unwrapOr(null));
  attest<Promise<string | undefined>>(err.unwrapOr(undefined));
});

Deno.test(
  "AsyncResult.andThen should change the success type and extend the error type",
  async () => {
    const ok: AsyncResult<number, string> = Result.ok(2).async();
    attest<AsyncResult<string, string | number>>(
      ok.andThen((value) => Result.ok<string, number>(value.toString())),
    );
  },
);

Deno.test(
  "AsyncResult.orElse should change the error type and extend the success type",
  async () => {
    const err: AsyncResult<number, string> = Result.err("boom").async();
    attest<AsyncResult<string | number, number>>(
      err.orElse((error) => Result.ok<string, number>(error)),
    );
  },
);

Deno.test(
  "AsyncResult.orElseMatch should change the error type and extend the success type",
  async () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const v: AsyncResult<string, A | B> = Result.err<A | B, string>(
      new A({}),
    ).async();
    const res = v.orElseMatch({
      A: () => Result.ok("a"),
      B: () => Result.err(123),
    });
    attest(res).type.toString.snap("AsyncResult<string, number>");
  },
);

Deno.test(
  "AsyncResult.orElseMatch handlers should properly narrow the error type",
  async () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const v1: AsyncResult<never, A | B> = Result.err<A | B>(new A({})).async();
    await v1.orElseMatch({
      A: (a) => void attest(a).type.toString.snap("A"),
      B: () => Result.ok<never>(undefined as never),
    });

    const v2: AsyncResult<never, A | B> = Result.err<A | B>(new B({})).async();
    await v2.orElseMatch({
      A: () => Result.ok<never>(undefined as never),
      B: (b) => void attest(b).type.toString.snap("B"),
    });
  },
);

Deno.test(
  "AsyncResult.orElseMatchSome should remove the handled errors from the error type",
  async () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const v: AsyncResult<string, A | B> = Result.err<A | B, string>(
      new A({}),
    ).async();
    const res = v.orElseMatchSome({
      A: () => Result.ok("a"),
    });
    attest(res).type.toString.snap("AsyncResult<string, B>");

    const v2: AsyncResult<string, A | B> = Result.err<A | B, string>(
      new B({}),
    ).async();
    const res2 = v2.orElseMatchSome({
      A: () => Result.ok("a"),
      B: () => Result.ok("b"),
    });
    attest(res2).type.toString.snap("AsyncResult<string, never>");
  },
);

Deno.test(
  "AsyncResult.orElseMatchSome handlers should properly narrow the error type",
  async () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const v1: AsyncResult<never, A | B> = Result.err<A | B>(new A({})).async();
    await v1.orElseMatchSome({
      A: (a) => void attest(a).type.toString.snap("A"),
      B: () => Result.ok<never>(undefined as never),
    });

    const v2: AsyncResult<never, A | B> = Result.err<A | B>(new B({})).async();
    await v2.orElseMatchSome({
      A: () => Result.ok<never>(undefined as never),
      B: (b) => void attest(b).type.toString.snap("B"),
    });
  },
);

Deno.test(
  "AsyncResult.orElseMatchSome should extend the success type",
  async () => {
    class A extends taggedError("A") {}
    const v: AsyncResult<string, A> = Result.err<A, string>(new A({})).async();
    attest<AsyncResult<string | number, never>>(
      v.orElseMatchSome({
        A: () => Result.ok(123),
      }),
    );
  },
);

// --- Result.run type tests ---

Deno.test("Result.run with all-ok yields returns Result<T, never>", () => {
  const res = Result.run(function* () {
    const a = yield* Result.ok(2);
    const b = yield* Result.ok("hello");
    return a + b.length;
  });
  attest(res).type.toString.snap("Result<number, never>");
});

Deno.test("Result.run propagates yield error types", () => {
  const res = Result.run(function* () {
    const a = yield* Result.ok<number, string>(2);
    return a;
  });
  attest(res).type.toString.snap("Result<number, string>");
});

Deno.test("Result.run accumulates error types from multiple yields", () => {
  const res = Result.run(function* () {
    const a = yield* Result.ok<number, string>(2);
    const b = yield* Result.ok<string, number>(String(a));
    return b;
  });
  attest(res).type.toString.snap("Result<string, string | number>");
});

Deno.test("Result.run supports yielding tagged errors directly", () => {
  class TooBig extends taggedError("TooBig") {}

  const res = Result.run(function* () {
    const a = yield* Result.ok(2);
    if (a > 10) yield* new TooBig({});
    return a;
  });
  attest(res).type.toString.snap("Result<number, TooBig>");
});

Deno.test("Result.run yield* after orElseMatch narrows error types", () => {
  class A extends taggedError("A") {}
  class B extends taggedError("B") {}

  const res = Result.run(function* () {
    const a = yield* Result.ok<number, A | B>(2).orElseMatch({
      A: () => Result.ok(0),
      B: () => Result.ok(-1),
    });
    return a;
  });
  attest(res).type.toString.snap("Result<number, never>");
});

Deno.test(
  "Result.run yield* after orElseMatchSome keeps unhandled errors",
  () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const res = Result.run(function* () {
      const a = yield* Result.ok<number, A | B>(2).orElseMatchSome({
        A: () => Result.ok(0),
      });
      return a;
    });
    attest(res).type.toString.snap("Result<number, B>");
  },
);

// --- Async Result.run type tests ---

Deno.test(
  "Async Result.run with all-ok yields returns AsyncResult<T, never>",
  async () => {
    const res = Result.run(async function* () {
      const a = yield* Result.ok(2).async();
      const b = yield* Result.ok("hello").async();
      return a + b.length;
    });
    attest(res).type.toString.snap("AsyncResult<number, never>");
  },
);

Deno.test("Async Result.run propagates yield error types", async () => {
  const res = Result.run(async function* () {
    const a = yield* Result.ok<number, string>(2).async();
    return a;
  });
  attest(res).type.toString.snap("AsyncResult<number, string>");
});

Deno.test(
  "Async Result.run accumulates error types from multiple yields",
  async () => {
    const res = Result.run(async function* () {
      const a = yield* Result.ok<number, string>(2).async();
      const b = yield* Result.ok<string, number>(String(a)).async();
      return b;
    });
    attest(res).type.toString.snap("AsyncResult<string, string | number>");
  },
);

Deno.test(
  "Async Result.run supports yielding tagged errors directly",
  async () => {
    class TooBig extends taggedError("TooBig") {}

    const res = Result.run(async function* () {
      const a = yield* Result.ok(2).async();
      if (a > 10) yield* new TooBig({});
      return a;
    });
    attest(res).type.toString.snap("AsyncResult<number, TooBig>");
  },
);

Deno.test(
  "Async Result.run yield* after orElseMatch narrows error types",
  async () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const res = Result.run(async function* () {
      const a = yield* Result.ok<number, A | B>(2)
        .orElseMatch({
          A: () => Result.ok(0),
          B: () => Result.ok(-1),
        })
        .async();
      return a;
    });
    attest(res).type.toString.snap("AsyncResult<number, never>");
  },
);

Deno.test(
  "Async Result.run yield* after orElseMatchSome keeps unhandled errors",
  async () => {
    class A extends taggedError("A") {}
    class B extends taggedError("B") {}

    const res = Result.run(async function* () {
      const a = yield* Result.ok<number, A | B>(2)
        .orElseMatchSome({
          A: () => Result.ok(0),
        })
        .async();
      return a;
    });
    attest(res).type.toString.snap("AsyncResult<number, B>");
  },
);

Deno.test("AsyncResult.wrap returns AsyncResult", () => {
  const res = AsyncResult.wrap({
    try: async () => 1,
    catch: () => "boom" as const,
  });

  attest<AsyncResult<number, "boom">>(res);
});

Deno.test("AsyncResult.wrapAbortable adds Cancelled", () => {
  const res = AsyncResult.wrapAbortable(
    {
      try: async (_sig) => 1,
      catch: () => "boom" as const,
    },
    { signal: new AbortController().signal },
  );

  attest<AsyncResult<number, AsyncResult.Cancelled | "boom">>(res);
});
