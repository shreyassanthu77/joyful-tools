import { assertEquals, assertInstanceOf } from "std/assert";
import { Result } from "@joyful/result";
import {
  Cancelled,
  createFetch,
  FetchedResponse,
  HttpError,
  NetworkError,
  ParseError,
} from "./main.ts";

function mockFetch(
  body: BodyInit | null,
  init?: ResponseInit,
): typeof globalThis.fetch {
  return () => Promise.resolve(new Response(body, init));
}

function jsonFetch(
  data: unknown,
  init?: ResponseInit,
): typeof globalThis.fetch {
  return () => Promise.resolve(Response.json(data, init));
}

function failFetch(error: unknown): typeof globalThis.fetch {
  return () => Promise.reject(error);
}

Deno.test("createFetch returns Ok for 200 response", async () => {
  const fetch = createFetch(jsonFetch({ ok: true }));
  const result = await fetch("/api");

  assertEquals(result.isOk(), true);
  if (result.isOk()) {
    assertEquals(result.value.status, 200);
  }
});

Deno.test("non-2xx response returns HttpError", async () => {
  const fetch = createFetch(jsonFetch({ error: "not found" }, { status: 404 }));
  const result = await fetch("/api").json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, HttpError);
    assertEquals(result.error.status, 404);
  }
});

Deno.test("json() parses JSON body", async () => {
  const fetch = createFetch(jsonFetch({ name: "Alice" }));
  const result = await fetch("/api").json<{ name: string }>();

  assertEquals(result.isOk(), true);
  if (result.isOk()) {
    assertEquals(result.value.name, "Alice");
  }
});

Deno.test("invalid JSON body returns ParseError", async () => {
  const fetch = createFetch(mockFetch("not json"));
  const result = await fetch("/api").json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, ParseError);
  }
});

Deno.test("HttpError.response can read the error body", async () => {
  const fetch = createFetch(
    jsonFetch({ message: "unauthorized" }, { status: 401 }),
  );
  const result = await fetch("/api").json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, HttpError);
    const body = await result.error.response.json<{ message: string }>();
    assertEquals(body.isOk(), true);
    if (body.isOk()) {
      assertEquals(body.value.message, "unauthorized");
    }
  }
});

Deno.test("TypeError from fetch returns NetworkError", async () => {
  const fetch = createFetch(failFetch(new TypeError("Failed to fetch")));
  const result = await fetch("/api").json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, NetworkError);
  }
});

Deno.test("generic error from fetch returns NetworkError", async () => {
  const fetch = createFetch(failFetch(new Error("connection refused")));
  const result = await fetch("/api").json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, NetworkError);
  }
});

Deno.test("DOMException from fetch returns Cancelled", async () => {
  const fetch = createFetch(
    failFetch(new DOMException("The operation was aborted", "AbortError")),
  );
  const result = await fetch("/api").json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, Cancelled);
  }
});

Deno.test(
  "non-abort DOMException from fetch returns NetworkError",
  async () => {
    const fetch = createFetch(
      failFetch(new DOMException("Quota exceeded", "QuotaExceededError")),
    );
    const result = await fetch("/api").json();

    assertEquals(result.isErr(), true);
    if (result.isErr()) {
      assertInstanceOf(result.error, NetworkError);
    }
  },
);

Deno.test("AbortSignal.abort() returns Cancelled", async () => {
  const fetch = createFetch(globalThis.fetch);
  const result = await fetch("https://example.com", {
    signal: AbortSignal.abort(),
  }).json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, Cancelled);
  }
});

Deno.test("await fetch returns HttpError with FetchedResponse", async () => {
  const fetch = createFetch(jsonFetch({ error: "not found" }, { status: 404 }));
  const result = await fetch("/api");

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, HttpError);
    assertInstanceOf(result.error.response, FetchedResponse);
    assertEquals(result.error.status, 404);
  }
});

Deno.test("orElseMatch for exhaustive error recovery", async () => {
  const fetch = createFetch(jsonFetch({ error: "nope" }, { status: 403 }));
  const result = await fetch("/api")
    .json<string>()
    .orElseMatch({
      NetworkError: () => Result.ok("network-fallback"),
      Cancelled: () => Result.ok("abort-fallback"),
      HttpError: (e) => Result.ok(`http-${e.status}`),
      ParseError: () => Result.ok("parse-fallback"),
    });

  assertEquals(result, Result.ok("http-403"));
});

Deno.test("yield* jfetch returns FetchedResponse on success", async () => {
  const fetch = createFetch(jsonFetch({ name: "Alice" }));

  const result = await Result.run(async function* () {
    const res = yield* fetch("/api");
    assertInstanceOf(res, FetchedResponse);
    return Result.ok(res.status);
  });

  assertEquals(result, Result.ok(200));
});

Deno.test("FetchedResponse.json() parses JSON body", async () => {
  const fetch = createFetch(jsonFetch({ name: "Bob" }));

  const result = await Result.run(async function* () {
    const res = yield* fetch("/api");
    const data = yield* res.json<{ name: string }>();
    return Result.ok(data);
  });

  assertEquals(result, Result.ok({ name: "Bob" }));
});

Deno.test(
  "FetchedResponse.json() returns ParseError or Cancelled (no ResponseError)",
  async () => {
    const fetch = createFetch(mockFetch("not json"));

    const result = await Result.run(async function* () {
      const res = yield* fetch("/api");
      const data = yield* res.json();
      return Result.ok(data);
    });

    assertEquals(result.isErr(), true);
    if (result.isErr()) {
      assertInstanceOf(result.error, ParseError);
    }
  },
);

Deno.test(
  "FetchedResponse.json() returns Cancelled on body-read abort",
  async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new DOMException("Body aborted", "AbortError"));
        },
      }),
    );

    const fetch = createFetch(() => Promise.resolve(response));
    const result = await Result.run(async function* () {
      const res = yield* fetch("/api");
      const data = yield* res.json();
      return Result.ok(data);
    });

    assertEquals(result.isErr(), true);
    if (result.isErr()) {
      assertInstanceOf(result.error, Cancelled);
    }
  },
);

Deno.test("FetchedResponse.text() returns text body", async () => {
  const fetch = createFetch(mockFetch("hello world"));

  const result = await Result.run(async function* () {
    const res = yield* fetch("/api");
    const text = yield* res.text();
    return Result.ok(text);
  });

  assertEquals(result, Result.ok("hello world"));
});
