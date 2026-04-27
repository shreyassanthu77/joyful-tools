# @joyful/task

Lazy work and hot task runs that resolve to `Result` values.

`Result<T, E>` is an outcome. `Task<Args, T, E>` is reusable work that can
produce an outcome. `TaskRun<T, E>` is one started execution that can be awaited
or used with `yield*`.

## Install

```sh
deno add jsr:@joyful/task
npm install @joyful-tools/task
```

## Quick Start

```ts
import { Ok } from "@joyful/result";
import { Task } from "@joyful/task";

const program = Task.do(async function* (amount: number) {
  const value = yield* new Ok(41);
  return value + amount;
});

const result = await program.run(1);
```

## Creating Tasks

Use the constructor when your factory already returns a `Result`:

```ts
import { Ok } from "@joyful/result";

const task = new Task<[number], number, never>((_ctx, value) => {
  return new Ok(value + 1);
});

const result = await task.run(123);
```

Use `Task.wrap` at normal JS async boundaries:

```ts
const task = Task.wrap(
  async ({ signal }) => {
    const response = await fetch("/api/user", { signal });
    return await response.json() as User;
  },
  (cause) => new Error("request failed", { cause }),
);

const result = await task.runWith({ signal: AbortSignal.timeout(5000) });
```

Cancellation returns `Cancelled` when the run signal is already aborted or when
wrapped work throws an `AbortError`.

## Composition

Tasks are lazy through chains:

```ts
const userName = fetchUserTask
  .map((user) => user.name)
  .mapErr((error) => new Error("could not load user", { cause: error }));
```

Use `andThen` to continue with another task run or result-producing operation:

```ts
const settings = fetchUserTask.andThen((user) =>
  fetchSettingsTask.run(user.id)
);
```

## Task.do

`Task.do` builds a lazy task from an async generator. Use `yield*` with `Result`
and `TaskRun` values to unwrap successes and short-circuit on errors.

```ts
import { Ok } from "@joyful/result";

const program = Task.do(async function* (userId: string) {
  const user = yield* fetchUserTask.run(userId);
  const settings = yield* fetchSettingsTask.run(user.id);
  const theme = yield* new Ok(settings.theme);

  return theme;
});

const result = await program.run("123");
```

## Task.all

`Task.all` awaits concrete `TaskRun` values and returns all individual results.
It is intentionally closer to `Promise.allSettled` than `Promise.all` because
errors are values.

```ts
import { Err, Ok } from "@joyful/result";

const result = await Task.all({
  count: new Task(() => new Ok(42)).run(),
  message: new Task(() => new Err("nope")).run(),
});

// Ok({ count: Ok(42), message: Err("nope") })
```

## Retry

`runWith({ retry })` retries a task run until it succeeds, the schedule is
exhausted, the `while` predicate returns false, or cancellation is observed.

```ts
const result = await fetchConfigTask.runWith({
  retry: { schedule: [100, 500, 1000] },
});
```

When retries are exhausted, the task returns `RetriesExhausted` with the attempt
count and last error.

## License

MIT
