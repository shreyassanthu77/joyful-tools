import { pipe } from "@joyful/pipe";
import { AsyncResult, Result } from "@joyful/result";
import { assertEquals, assertInstanceOf } from "assert";

Deno.test("AsyncResult", async (t) => {
  await t.step("fromResult", async () => {
    const result = new Result.Ok("hello");
    const asyncResult = await AsyncResult.fromResult(result);
    assertEquals(asyncResult.ok(), true);
    assertEquals(asyncResult.unwrap(), "hello");
  });

  await t.step("fromThrowable with a promise factory", async () => {
    const result = await AsyncResult.fromThrowable(() =>
      Promise.resolve("hello"),
    );
    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), "hello");
  });

  await t.step("fromThrowable with a promise factory that throws", async () => {
    const result = await AsyncResult.fromThrowable(() => {
      throw "hello";
    });
    assertEquals(result.ok(), false);
    assertEquals(result.unwrapErr(), "hello");
  });

  await t.step("fromThrowable with custom error handler", async () => {
    const result = await AsyncResult.fromThrowable(
      () => {
        throw new Error("custom error");
      },
      (e) => `Handled: ${(e as Error).message}`,
    );
    assertEquals(result.ok(), false);
    assertEquals(result.unwrapErr(), "Handled: custom error");
  });

  await t.step(
    "fromThrowable with sync function returning promise",
    async () => {
      const result = await AsyncResult.fromThrowable(() =>
        Promise.resolve("async value"),
      );
      assertEquals(result.ok(), true);
      assertEquals(result.unwrap(), "async value");
    },
  );

  await t.step("fromThrowable with sync function throwing", async () => {
    const result = await AsyncResult.fromThrowable(() => {
      throw new Error("sync error");
    });
    assertEquals(result.ok(), false);
    assertInstanceOf(result.unwrapErr(), Error);
  });

  await t.step("fromThrowable with async function that rejects", async () => {
    const result = await AsyncResult.fromThrowable(async () => {
      throw new Error("async error");
    });
    assertEquals(result.ok(), false);
    assertInstanceOf(result.unwrapErr(), Error);
  });
});

Deno.test("map", async (t) => {
  await t.step("should map an Ok value (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const mapped = await pipe(
      ok,
      AsyncResult.map(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return value.toUpperCase();
      }),
    );

    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), "HELLO");
  });

  await t.step("should map an Ok value (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("hello"));
    const mapped = await AsyncResult.map(ok, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return value.toUpperCase();
    });

    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), "HELLO");
  });

  await t.step("should not map an Err value (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err<string, string>("hello"));
    const mapped = await pipe(
      err,
      AsyncResult.map(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return value.toUpperCase();
      }),
    );
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), "hello");
  });

  await t.step("should not map an Err value (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err<string, string>("hello"));
    const mapped = await AsyncResult.map(err, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return value.toUpperCase();
    });
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), "hello");
  });
});

Deno.test("mapErr", async (t) => {
  await t.step("should map an Err value (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("hello"));
    const mapped = await pipe(
      err,
      AsyncResult.mapErr(async (error) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return error.toUpperCase();
      }),
    );
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), "HELLO");
  });

  await t.step("should map an Err value (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err("hello"));
    const mapped = await AsyncResult.mapErr(err, async (error) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return error.toUpperCase();
    });
    assertEquals(mapped.ok(), false);
    assertEquals(mapped.unwrapErr(), "HELLO");
  });

  await t.step("should not map an Ok value (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok<string, string>("hello"));
    const mapped = await pipe(
      ok,
      AsyncResult.mapErr(async (error) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return error.toUpperCase();
      }),
    );
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), "hello");
  });

  await t.step("should not map an Ok value (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok<string, string>("hello"));
    const mapped = await AsyncResult.mapErr(ok, async (error) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return error.toUpperCase();
    });
    assertEquals(mapped.ok(), true);
    assertEquals(mapped.unwrap(), "hello");
  });
});

Deno.test("andThen", async (t) => {
  await t.step(
    "should chain Ok values with AsyncResult return (curried)",
    async () => {
      const ok = AsyncResult.fromResult(new Result.Ok("hello"));
      const chained = await pipe(
        ok,
        AsyncResult.andThen((value) => {
          return AsyncResult.fromResult(new Result.Ok(value.toUpperCase()));
        }),
      );

      assertEquals(chained.ok(), true);
      assertEquals(chained.unwrap(), "HELLO");
    },
  );

  await t.step(
    "should chain Ok values with Result return (curried)",
    async () => {
      const ok = AsyncResult.fromResult(new Result.Ok("hello"));
      const chained = await pipe(
        ok,
        AsyncResult.andThen((value) => {
          return new Result.Ok(value.toUpperCase());
        }),
      );

      assertEquals(chained.ok(), true);
      assertEquals(chained.unwrap(), "HELLO");
    },
  );

  await t.step(
    "should chain Ok values with AsyncResult return (binary)",
    async () => {
      const ok = AsyncResult.fromResult(new Result.Ok("hello"));
      const chained = await AsyncResult.andThen(ok, (value) => {
        return AsyncResult.fromResult(new Result.Ok(value.toUpperCase()));
      });

      assertEquals(chained.ok(), true);
      assertEquals(chained.unwrap(), "HELLO");
    },
  );

  await t.step(
    "should chain Ok values with Result return (binary)",
    async () => {
      const ok = AsyncResult.fromResult(new Result.Ok("hello"));
      const chained = await AsyncResult.andThen(ok, (value) => {
        return new Result.Ok(value.toUpperCase());
      });

      assertEquals(chained.ok(), true);
      assertEquals(chained.unwrap(), "HELLO");
    },
  );

  await t.step("should short-circuit on Err values (curried)", async () => {
    const err = AsyncResult.fromResult(new Result.Err<string, string>("error"));
    const chained = await pipe(
      err,
      AsyncResult.andThen((value) => {
        return AsyncResult.fromResult(new Result.Ok(value.toUpperCase()));
      }),
    );

    assertEquals(chained.ok(), false);
    assertEquals(chained.unwrapErr(), "error");
  });

  await t.step("should short-circuit on Err values (binary)", async () => {
    const err = AsyncResult.fromResult(new Result.Err<string, string>("error"));
    const chained = await AsyncResult.andThen(err, (value) => {
      return AsyncResult.fromResult(new Result.Ok(value.toUpperCase()));
    });

    assertEquals(chained.ok(), false);
    assertEquals(chained.unwrapErr(), "error");
  });
});

Deno.test("orElse", async (t) => {
  await t.step(
    "should provide fallback for Err values with AsyncResult return (curried)",
    async () => {
      const err = AsyncResult.fromResult(new Result.Err("error"));
      const fallback = await pipe(
        err,
        AsyncResult.orElse((error) => {
          return AsyncResult.fromResult(new Result.Ok(`fallback: ${error}`));
        }),
      );

      assertEquals(fallback.ok(), true);
      assertEquals(fallback.unwrap(), "fallback: error");
    },
  );

  await t.step(
    "should provide fallback for Err values with Result return (curried)",
    async () => {
      const err = AsyncResult.fromResult(new Result.Err("error"));
      const fallback = await pipe(
        err,
        AsyncResult.orElse((error) => {
          return new Result.Ok(`fallback: ${error}`);
        }),
      );

      assertEquals(fallback.ok(), true);
      assertEquals(fallback.unwrap(), "fallback: error");
    },
  );

  await t.step(
    "should provide fallback for Err values with AsyncResult return (binary)",
    async () => {
      const err = AsyncResult.fromResult(new Result.Err("error"));
      const fallback = await AsyncResult.orElse(err, (error) => {
        return AsyncResult.fromResult(new Result.Ok(`fallback: ${error}`));
      });

      assertEquals(fallback.ok(), true);
      assertEquals(fallback.unwrap(), "fallback: error");
    },
  );

  await t.step(
    "should provide fallback for Err values with Result return (binary)",
    async () => {
      const err = AsyncResult.fromResult(new Result.Err("error"));
      const fallback = await AsyncResult.orElse(err, (error) => {
        return new Result.Ok(`fallback: ${error}`);
      });

      assertEquals(fallback.ok(), true);
      assertEquals(fallback.unwrap(), "fallback: error");
    },
  );

  await t.step("should not affect Ok values (curried)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("success"));
    const unchanged = await pipe(
      ok,
      AsyncResult.orElse((error) => {
        return AsyncResult.fromResult(new Result.Ok(`fallback: ${error}`));
      }),
    );

    assertEquals(unchanged.ok(), true);
    assertEquals(unchanged.unwrap(), "success");
  });

  await t.step("should not affect Ok values (binary)", async () => {
    const ok = AsyncResult.fromResult(new Result.Ok("success"));
    const unchanged = await AsyncResult.orElse(ok, (error) => {
      return AsyncResult.fromResult(new Result.Ok(`fallback: ${error}`));
    });

    assertEquals(unchanged.ok(), true);
    assertEquals(unchanged.unwrap(), "success");
  });
});

Deno.test("match", async (t) => {
  await t.step("should match Ok values (curried)", async () => {
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

    assertEquals(result, "Success: HELLO");
  });

  await t.step("should match Ok values (binary)", async () => {
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

    assertEquals(result, "Success: HELLO");
  });

  await t.step("should match Err values (curried)", async () => {
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

    assertEquals(result, "Error: ERROR");
  });

  await t.step("should match Err values (binary)", async () => {
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

    assertEquals(result, "Error: ERROR");
  });
});

Deno.test("AsyncResult complex chaining", async (t) => {
  await t.step("should chain multiple async operations", async () => {
    const fetchUser = async (id: number) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (id === 1) return { id, name: "Alice" };
      throw new Error("User not found");
    };

    const result = await pipe(
      AsyncResult.fromThrowable(() => fetchUser(1)),
      AsyncResult.andThen((user) => {
        if (!user.name) return new Result.Err("Invalid user");
        return new Result.Ok(user);
      }),
      AsyncResult.map((user) => `Hello, ${user.name}!`),
    );

    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), "Hello, Alice!");
  });

  await t.step("should handle mixed sync and async operations", async () => {
    const result = await pipe(
      AsyncResult.fromResult(new Result.Ok("test")),
      AsyncResult.andThen(async (data: string) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return new Result.Ok(`processed: ${data}`);
      }),
      AsyncResult.map((data: string) => data.toUpperCase()),
    );

    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), "PROCESSED: TEST");
  });

  await t.step("should short-circuit on async errors", async () => {
    const failingAsyncOp = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      throw new Error("Async failure");
    };

    const result = await pipe(
      AsyncResult.fromThrowable(failingAsyncOp),
      AsyncResult.map((data) => `This should not run: ${data}`),
      AsyncResult.andThen((data) =>
        AsyncResult.fromResult(new Result.Ok(`Final: ${data}`)),
      ),
    );

    assertEquals(result.ok(), false);
    assertInstanceOf(result.unwrapErr(), Error);
  });
});

Deno.test("AsyncResult error handling", async (t) => {
  await t.step(
    "should handle promise rejections in fromThrowable",
    async () => {
      const result = await AsyncResult.fromThrowable(() =>
        Promise.reject(new Error("Promise rejected")),
      );

      assertEquals(result.ok(), false);
      assertInstanceOf(result.unwrapErr(), Error);
    },
  );

  await t.step("should handle nested AsyncResults", async () => {
    const innerResult = AsyncResult.fromResult(new Result.Ok("inner"));
    const outerResult = await AsyncResult.fromThrowable(async () => {
      const result = await innerResult;
      return `wrapped: ${result.unwrap()}`;
    });

    assertEquals(outerResult.ok(), true);
    assertEquals(outerResult.unwrap(), "wrapped: inner");
  });

  await t.step("should handle complex error transformations", async () => {
    const result = await pipe(
      AsyncResult.fromThrowable(() => {
        throw new Error("Original error");
      }),
      AsyncResult.mapErr((e: unknown) => `Mapped: ${(e as Error).message}`),
      AsyncResult.orElse((error: string) =>
        AsyncResult.fromResult(new Result.Ok(`Recovered from: ${error}`)),
      ),
    );

    assertEquals(result.ok(), true);
    assertEquals(result.unwrap(), "Recovered from: Mapped: Original error");
  });
});
