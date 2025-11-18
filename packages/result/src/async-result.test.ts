import { pipe } from "@joyful/pipe";
import { AsyncResult, Result } from "@joyful/result";
import { describe, expect, it } from "vitest";

describe("AsyncResult", () => {
  it("should wrap a successful promise", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(42)),
    );
    const result = await asyncResult.promise;

    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  it("should wrap a failed promise", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err("error")),
    );
    const result = await asyncResult.promise;

    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe("error");
  });
});

describe("fromThrowable", () => {
  it("should handle successful promise (direct)", async () => {
    const asyncResult = AsyncResult.fromThrowable(
      Promise.resolve(42),
      (e) => `Error: ${e}`,
    );

    const result = await asyncResult.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  it("should handle failed promise (direct)", async () => {
    const asyncResult = AsyncResult.fromThrowable(
      Promise.reject(new Error("boom")),
      (e) => `Error: ${e}`,
    );

    const result = await asyncResult.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe("Error: Error: boom");
  });

  it("should handle successful promise function", async () => {
    const asyncResult = AsyncResult.fromThrowable(
      () => Promise.resolve(42),
      (e) => `Error: ${e}`,
    );

    const result = await asyncResult.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  it("should handle failed promise function", async () => {
    const asyncResult = AsyncResult.fromThrowable(
      () => Promise.reject(new Error("boom")),
      (e) => `Error: ${e}`,
    );

    const result = await asyncResult.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe("Error: Error: boom");
  });

  it("should handle function that throws synchronously", async () => {
    const asyncResult = AsyncResult.fromThrowable(
      () => {
        throw new Error("sync boom");
      },
      (e) => `Error: ${e}`,
    );

    const result = await asyncResult.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe("Error: Error: sync boom");
  });
});

describe("map", () => {
  it("should map an Ok value (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.map((value: number) => value + 1),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("should map an Ok value (binary)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = AsyncResult.map(asyncResult, (value: number) => value + 1);

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("should map an Ok value with async function", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.map((value: number) => value + 1),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("should not map an Err value (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.map((value: number) => value + 1),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe(1);
  });

  it("should not map an Err value (binary)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const mapped = AsyncResult.map(asyncResult, (value: number) => value + 1);

    const result = await mapped.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe(1);
  });
});

describe("andThen", () => {
  it("Ok + Ok => Ok (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.andThen((value: number) => new Result.Ok(value + 1)),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("Ok + Ok => Ok (binary)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = AsyncResult.andThen(
      asyncResult,
      (value: number) => new Result.Ok(value + 1),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("Ok + AsyncResult => AsyncResult (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.andThen(
        (value: number) =>
          new AsyncResult.AsyncResult(
            Promise.resolve(new Result.Ok(value + 1)),
          ),
      ),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("Ok + Promise<Result> => Result (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.andThen((value: number) =>
        Promise.resolve(new Result.Ok(value + 1)),
      ),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("Ok + Err => Err (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.andThen((value: number) => new Result.Err(value + 1)),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe(2);
  });

  it("Err + Ok => Err (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.andThen((value: number) => new Result.Ok(value + 1)),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe(1);
  });

  it("Err + Ok => Err (binary)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const mapped = AsyncResult.andThen(
      asyncResult,
      (value: number) => new Result.Ok(value + 1),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe(1);
  });
});

describe("orElse", () => {
  it("Ok + Ok => Ok (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.orElse((error: number) => new Result.Ok(error + 1)),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(1);
  });

  it("Ok + Ok => Ok (binary)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = AsyncResult.orElse(
      asyncResult,
      (error: number) => new Result.Ok(error + 1),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(1);
  });

  it("Err + Ok => Ok (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.orElse((error: number) => new Result.Ok(error + 1)),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("Err + AsyncResult => AsyncResult (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.orElse(
        (error: number) =>
          new AsyncResult.AsyncResult(
            Promise.resolve(new Result.Ok(error + 1)),
          ),
      ),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("Err + Promise<Result> => Result (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.orElse((error: number) =>
        Promise.resolve(new Result.Ok(error + 1)),
      ),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("Err + Err => Err (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.orElse((error: number) => new Result.Err(error + 1)),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(false);
    expect(result.unwrapErr()).toBe(2);
  });

  it("Ok + Err => Ok (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const mapped = pipe(
      asyncResult,
      AsyncResult.orElse((error: number) => new Result.Err(error + 1)),
    );

    const result = await mapped.promise;
    expect(result.ok()).toBe(true);
    expect(result.unwrap()).toBe(1);
  });
});

describe("match", () => {
  it("should match Ok (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const matched = pipe(
      asyncResult,
      AsyncResult.match(
        (value: number) => value + 1,
        (error: number) => error + 2,
      ),
    );

    await expect(matched).resolves.toBe(2);
  });

  it("should match Ok (binary)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const matched = AsyncResult.match(
      asyncResult,
      (value: number) => value + 1,
      (error: number) => error + 2,
    );

    await expect(matched).resolves.toBe(2);
  });

  it("should match Ok with async function", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Ok(1)),
    );
    const matched = pipe(
      asyncResult,
      AsyncResult.match(
        (value: number) => value + 1,
        (error: number) => error + 2,
      ),
    );

    await expect(matched).resolves.toBe(2);
  });

  it("should match Err (curried)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const matched = pipe(
      asyncResult,
      AsyncResult.match(
        (value: number) => value + 1,
        (error: number) => error + 2,
      ),
    );

    await expect(matched).resolves.toBe(3);
  });

  it("should match Err (binary)", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const matched = AsyncResult.match(
      asyncResult,
      (value: number) => value + 1,
      (error: number) => error + 2,
    );

    await expect(matched).resolves.toBe(3);
  });

  it("should match Err with async function", async () => {
    const asyncResult = new AsyncResult.AsyncResult(
      Promise.resolve(new Result.Err(1)),
    );
    const matched = pipe(
      asyncResult,
      AsyncResult.match(
        (value: number) => value + 1,
        (error: number) => error + 2,
      ),
    );

    await expect(matched).resolves.toBe(3);
  });
});

