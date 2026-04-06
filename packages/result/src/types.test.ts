// deno-lint-ignore-file
import { AsyncResult } from "./async-result.ts";
import { Result } from "./main.ts";
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
    class A extends Result.taggedError("A") {}
    class B extends Result.taggedError("B") {}

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
    class A extends Result.taggedError("A") {}
    class B extends Result.taggedError("B") {}

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
    class A extends Result.taggedError("A") {}
    class B extends Result.taggedError("B") {}

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
    class A extends Result.taggedError("A") {}
    class B extends Result.taggedError("B") {}

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
  class A extends Result.taggedError("A") {}
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
    class A extends Result.taggedError("A") {}
    class B extends Result.taggedError("B") {}

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
    class A extends Result.taggedError("A") {}
    class B extends Result.taggedError("B") {}

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
    class A extends Result.taggedError("A") {}
    class B extends Result.taggedError("B") {}

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
    class A extends Result.taggedError("A") {}
    class B extends Result.taggedError("B") {}

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
    class A extends Result.taggedError("A") {}
    const v: AsyncResult<string, A> = Result.err<A, string>(new A({})).async();
    attest<AsyncResult<string | number, never>>(
      v.orElseMatchSome({
        A: () => Result.ok(123),
      }),
    );
  },
);
