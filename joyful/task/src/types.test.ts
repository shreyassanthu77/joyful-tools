// deno-lint-ignore-file
import { Err, Ok, type Result } from "@joyful/result";
import { attest, setup, teardown } from "@ark/attest";
import { Cancelled, Task, TaskRun } from "./main.ts";

Deno.test.beforeAll(() => void setup());
Deno.test.afterAll(() => void teardown());

Deno.test("Task.map should change the success type", () => {
  const task = new Task<[], number, string>(() => new Ok(2));
  attest<Task<[], string, string>>(
    task.map((value) => value.toString()),
  );
});

Deno.test("Task.do should preserve parameter types", () => {
  const task = Task.do(async function* (id: string, count: number) {
    const suffix = yield* new Ok(count.toString());
    return `${id}:${suffix}`;
  });

  attest<Task<[string, number], string, Cancelled>>(task);
});

Deno.test("Task.all should return all individual results", () => {
  const task = Task.all({
    count: new Task<[], number, string>(() => new Ok(2)).run(),
    message: new Task<[], string, number>(() => new Err(123)).run(),
  });

  attest<
    TaskRun<
      {
        count: Result<number, string>;
        message: Result<string, number>;
      },
      never
    >
  >(task);
});
