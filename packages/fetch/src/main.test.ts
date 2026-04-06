import { assertEquals, assertInstanceOf } from "std/assert";
import { Result } from "@joyful/result";
import {
  AbortError,
  createFetch,
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

Deno.test("DOMException from fetch returns AbortError", async () => {
  const fetch = createFetch(
    failFetch(new DOMException("The operation was aborted", "AbortError")),
  );
  const result = await fetch("/api").json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, AbortError);
  }
});

Deno.test("AbortSignal.abort() returns AbortError", async () => {
  const fetch = createFetch(globalThis.fetch);
  const result = await fetch("https://example.com", {
    signal: AbortSignal.abort(),
  }).json();

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, AbortError);
  }
});

Deno.test(".response allows reading headers", async () => {
  const fetch = createFetch(() =>
    Promise.resolve(
      new Response("ok", {
        headers: { "x-request-id": "abc123" },
      }),
    )
  );

  const requestId = await fetch("/api")
    .response.map((res) => res.headers.get("x-request-id"))
    .unwrapOr(null);

  assertEquals(requestId, "abc123");
});

Deno.test(".response returns Err on failure", async () => {
  const fetch = createFetch(failFetch(new TypeError("failed")));

  const result = await fetch("/api").response;

  assertEquals(result.isErr(), true);
  if (result.isErr()) {
    assertInstanceOf(result.error, NetworkError);
  }
});

Deno.test("orElseMatch for exhaustive error recovery", async () => {
  const fetch = createFetch(jsonFetch({ error: "nope" }, { status: 403 }));
  const result = await fetch("/api")
    .json<string>()
    .orElseMatch({
      NetworkError: () => Result.ok("network-fallback"),
      AbortError: () => Result.ok("abort-fallback"),
      HttpError: (e) => Result.ok(`http-${e.status}`),
      ParseError: () => Result.ok("parse-fallback"),
    });

  assertEquals(result, Result.ok("http-403"));
});
