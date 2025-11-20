import { pipe } from "@joyful/pipe";
import { AsyncResult, Result } from "@joyful/result";
import { describe, expect, it } from "vitest";

describe("AsyncResult", () => {
  it("fromResult", async () => {
    const result = new Result.Ok("hello");
    const asyncResult = await AsyncResult.fromResult(result);
    expect(asyncResult.ok()).toBe(true);
    expect(asyncResult.unwrap()).toBe("hello");
  });

  it("fromThrowable with a promise factory", async () => {
    const result = await AsyncResult.fromThrowable(() =>
      Promise.resolve("hello"),
    );
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe("hello");
  });

  it("fromThrowable with a promise factory that throws", async () => {
    const result = await AsyncResult.fromThrowable(() => {
      throw "hello";
    });
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe("hello");
  });
});

describe("map", () => {
  it("should map an Ok value (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const mapped = await pipe(
      ok,
      AsyncResult.map(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return value.toUpperCase();
      }),
    );

    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe("HELLO");
  });

  it("should map an Ok value (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const mapped = await AsyncResult.map(ok, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return value.toUpperCase();
    });

    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe("HELLO");
  });

  it("should not map an Err value (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err<string, string>("hello"));
    const mapped = await pipe(
      err,
      AsyncResult.map(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return value.toUpperCase();
      }),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe("hello");
  });

  it("should not map an Err value (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err<string, string>("hello"));
    const mapped = await AsyncResult.map(err, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return value.toUpperCase();
    });
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe("hello");
  });
});

describe("mapErr", () => {
  it("should map an Err value (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("hello"));
    const mapped = await pipe(
      err,
      AsyncResult.mapErr(async (error) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return error.toUpperCase();
      }),
    );
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe("HELLO");
  });

  it("should map an Err value (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("hello"));
    const mapped = await AsyncResult.mapErr(err, async (error) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return error.toUpperCase();
    });
    expect(mapped.ok()).toBe(false);
    expect(mapped.unwrapErr()).toBe("HELLO");
  });

  it("should not map an Ok value (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok<string, string>("hello"));
    const mapped = await pipe(
      ok,
      AsyncResult.mapErr(async (error) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return error.toUpperCase();
      }),
    );
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe("hello");
  });

  it("should not map an Ok value (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok<string, string>("hello"));
    const mapped = await AsyncResult.mapErr(ok, async (error) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return error.toUpperCase();
    });
    expect(mapped.ok()).toBe(true);
    expect(mapped.unwrap()).toBe("hello");
  });
});
