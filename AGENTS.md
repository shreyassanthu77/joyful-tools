# AGENTS.md

## Repository Shape

- Monorepo managed by Deno workspace (`deno.json` at repo root).
- Source packages are grouped by family under `joyful/` and `joypack/`.
- Build/publish scripts live in `scripts/`.
- NPM-ready artifacts are generated into `dist/` (do not hand-edit generated
  files).
- Tests live next to source files as `*.test.ts`.

## Environment And Tooling

- Runtime/tooling: Deno 2.x.
- Language: TypeScript (ESM, explicit `.ts` local import specifiers).
- Node/npm are required for build packaging (`scripts/build.ts` runs
  `npm install` inside `dist/*`).
- Deno lockfile is committed (`deno.lock`); keep it consistent with dependency
  changes.

## Commands

Run all commands from repo root unless noted.

```bash
# install dependencies used by workspace + scripts
deno install

# full test suite (root task)
deno task test

# equivalent direct test command
deno test -A

# run tests for a single package
deno test -A joyful/result/src
deno test -A joyful/fetch/src
deno test -A joyful/pipe/src

# run one test file
deno test -A joyful/result/src/result.test.ts

# run one test case by name (substring/regex)
deno test -A joyful/result/src/result.test.ts --filter "Result.run"
deno test -A joyful/fetch/src/main.test.ts --filter "HttpError.response"

# lint (no dedicated task defined; run directly)
deno lint

# format
deno fmt

# type-check examples
deno check joyful/result/src/main.ts
deno check joyful/fetch/src/main.ts
```

## CI Notes

- CI test gate (GitHub Actions `publish.yml`) runs:
  - `deno install`
  - `deno task test`
- Publish workflow is triggered by tags matching `release-*`.
- NPM publishing depends on `scripts/build.ts` output in `dist/`.

## Test Authoring Conventions

- Use `Deno.test("descriptive name", ...)` with sentence-style names.
- Use assertions from `std/assert` (`assertEquals`, `assertInstanceOf`,
  `assertThrows`, `assertRejects`).
- Keep unit tests deterministic; mock `fetch` in `fetch` package tests.
- For result-flow tests, verify both value and type narrowing behavior when
  relevant.
- Type-level tests use `@ark/attest` in `joyful/result/src/types.test.ts`.
- If adding type-level assertions, follow existing `setup()` / `teardown()`
  pattern.
- Prefer focused test files near the implementation under test.

## Code Style Guidelines

### Types And API Design

- Prefer explicit public types for exported APIs.
- Use `satisfies` when it improves compile-time guarantees without widening.

### Error Handling

- Prefer `Result` / `AsyncResult` for expected failures.
- Prefer `taggedError("Tag")` for domain errors that need structured matching.
- Keep `_tag`-based matching exhaustive via `orElseMatch` when all cases must be
  handled.
- Use `orElseMatchSome` when intentionally handling only part of an error union.
- Reserve throwing for truly exceptional/programmer-error paths or script-fatal
  conditions.
- Preserve original error causes (`cause`) when wrapping failures.

### Classes And State

- Use `#privateField` for internal mutable state in classes (as in `Turboq`).
- Keep public methods small and explicit about side effects.
- Emit typed events for lifecycle/state transitions when extending event-driven
  APIs.

### Documentation

- Public exports should have concise JSDoc.
- Include examples for all APIs.
- Keep README/API docs aligned with actual runtime behavior and exported types.

## Change Checklist For Agents

- Run targeted tests for touched files first.
- Run full `deno task test` for broad or cross-package changes.
- Run `deno fmt` and `deno lint` before finalizing non-trivial edits.
- If exports change, update package `README.md` and relevant `src/main.ts`
  exports.
- If build/publish behavior changes, validate with `deno task build`.
