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

describe("andThen", () => {
  it("should chain Ok values with AsyncResult return (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const chained = await pipe(
      ok,
      AsyncResult.andThen((value) => {
        return AsyncResult.fromResult(new Result.Ok(value.toUpperCase()));
      }),
    );

    expect(chained.ok()).toBe(true);
    expect(chained.unwrap()).toBe("HELLO");
  });

  it("should chain Ok values with Result return (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const chained = await pipe(
      ok,
      AsyncResult.andThen((value) => {
        return new Result.Ok(value.toUpperCase());
      }),
    );

    expect(chained.ok()).toBe(true);
    expect(chained.unwrap()).toBe("HELLO");
  });

  it("should chain Ok values with AsyncResult return (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const chained = await AsyncResult.andThen(ok, (value) => {
      return AsyncResult.fromResult(new Result.Ok(value.toUpperCase()));
    });

    expect(chained.ok()).toBe(true);
    expect(chained.unwrap()).toBe("HELLO");
  });

  it("should chain Ok values with Result return (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const chained = await AsyncResult.andThen(ok, (value) => {
      return new Result.Ok(value.toUpperCase());
    });

    expect(chained.ok()).toBe(true);
    expect(chained.unwrap()).toBe("HELLO");
  });

  it("should short-circuit on Err values (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err<string, string>("error"));
    const chained = await pipe(
      err,
      AsyncResult.andThen((value) => {
        return AsyncResult.fromResult(new Result.Ok(value.toUpperCase()));
      }),
    );

    expect(chained.ok()).toBe(false);
    expect(chained.unwrapErr()).toBe("error");
  });

  it("should short-circuit on Err values (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err<string, string>("error"));
    const chained = await AsyncResult.andThen(err, (value) => {
      return AsyncResult.fromResult(new Result.Ok(value.toUpperCase()));
    });

    expect(chained.ok()).toBe(false);
    expect(chained.unwrapErr()).toBe("error");
  });
});

describe("orElse", () => {
  it("should provide fallback for Err values with AsyncResult return (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("error"));
    const fallback = await pipe(
      err,
      AsyncResult.orElse((error) => {
        return AsyncResult.fromResult(new Result.Ok(`fallback: ${error}`));
      }),
    );

    expect(fallback.ok()).toBe(true);
    expect(fallback.unwrap()).toBe("fallback: error");
  });

  it("should provide fallback for Err values with Result return (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("error"));
    const fallback = await pipe(
      err,
      AsyncResult.orElse((error) => {
        return new Result.Ok(`fallback: ${error}`);
      }),
    );

    expect(fallback.ok()).toBe(true);
    expect(fallback.unwrap()).toBe("fallback: error");
  });

  it("should provide fallback for Err values with AsyncResult return (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("error"));
    const fallback = await AsyncResult.orElse(err, (error) => {
      return AsyncResult.fromResult(new Result.Ok(`fallback: ${error}`));
    });

    expect(fallback.ok()).toBe(true);
    expect(fallback.unwrap()).toBe("fallback: error");
  });

  it("should provide fallback for Err values with Result return (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("error"));
    const fallback = await AsyncResult.orElse(err, (error) => {
      return new Result.Ok(`fallback: ${error}`);
    });

    expect(fallback.ok()).toBe(true);
    expect(fallback.unwrap()).toBe("fallback: error");
  });

  it("should not affect Ok values (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("success"));
    const unchanged = await pipe(
      ok,
      AsyncResult.orElse((error) => {
        return AsyncResult.fromResult(new Result.Ok(`fallback: ${error}`));
      }),
    );

    expect(unchanged.ok()).toBe(true);
    expect(unchanged.unwrap()).toBe("success");
  });

  it("should not affect Ok values (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("success"));
    const unchanged = await AsyncResult.orElse(ok, (error) => {
      return AsyncResult.fromResult(new Result.Ok(`fallback: ${error}`));
    });

    expect(unchanged.ok()).toBe(true);
    expect(unchanged.unwrap()).toBe("success");
  });
});

describe("match", () => {
  it("should match Ok values (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const result = await pipe(
      ok,
      AsyncResult.match(
        async (value) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return `Success: ${value.toUpperCase()}`;
        },
        async (error) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return `Error: ${error}`;
        },
      ),
    );

    expect(result).toBe("Success: HELLO");
  });

  it("should match Ok values (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const result = await AsyncResult.match(
      ok,
      async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return `Success: ${value.toUpperCase()}`;
      },
      async (error) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return `Error: ${error}`;
      },
    );

    expect(result).toBe("Success: HELLO");
  });

  it("should match Err values (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("error"));
    const result = await pipe(
      err,
      AsyncResult.match(
        async (value) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return `Success: ${value}`;
        },
        async (error) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return `Error: ${error.toUpperCase()}`;
        },
      ),
    );

    expect(result).toBe("Error: ERROR");
  });

  it("should match Err values (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("error"));
    const result = await AsyncResult.match(
      err,
      async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return `Success: ${value}`;
      },
      async (error) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return `Error: ${error.toUpperCase()}`;
      },
    );

    expect(result).toBe("Error: ERROR");
  });
});
