# @joyful/pipe-plugin

A Vite plugin that optimizes [`@joyful/pipe`](https://jsr.io/@joyful/pipe) calls at build time by transforming them into nested function calls.

## Installation

```bash
# deno
deno add jsr:@joyful/pipe-plugin

# pnpm 10.9+
pnpm add jsr:@joyful/pipe-plugin

# yarn 4.9+
yarn add jsr:@joyful/pipe-plugin

# npm, bun, and older versions of yarn or pnpm
npx jsr add @joyful/pipe-plugin
```

## Overview

The `@joyful/pipe` utility is great for readability, but function composition can introduce slight runtime overhead. This plugin eliminates that overhead completely by transforming your code during the build process.

### How it works

The plugin statically analyzes your code and transforms `pipe` calls into standard nested function calls.

**Input Code:**
```typescript
import { pipe } from "@joyful/pipe";

const result = pipe(
  input,
  func1,
  func2,
  func3
);
```

**Transformed Code (Build Output):**
```typescript
const result = func3(func2(func1(input)));
```

This means you get the **readability** of pipes with the **performance** of raw function calls.

## Usage

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import { pipePlugin } from "@joyful/pipe-plugin";

export default defineConfig({
  plugins: [
    pipePlugin()
  ],
});
```

## Configuration

The plugin accepts an options object:

```typescript
pipePlugin({
  // Optional: Specify a custom import path if you're re-exporting pipe
  // Default: "@joyful/pipe"
  importPath: "@my/custom/pipe",
})
```

### Options

| Option | Type | Default | Description |
|:---|:---|:---|:---|
| `importPath` | `string` | `"@joyful/pipe"` | The module ID to look for when detecting pipe imports. Useful if you wrap or re-export the pipe function. |

## Limitations

The transformation happens at build time using static analysis (AST). The optimization will apply when:
1. The `pipe` function is imported from `@joyful/pipe` (or configured `importPath`).
2. The function call is direct (e.g., `pipe(...)` or `P.pipe(...)`).
3. The function call is not a dynamic import.
3. Arguments are not spread (e.g., `pipe(val, ...funcs)` is **not** optimized).
4. There are at least 2 arguments (value + at least one function).

If these conditions aren't met, the code is left as-is and will work normally using the runtime `pipe` function.

## License

MIT
