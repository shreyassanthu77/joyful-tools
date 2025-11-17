# @joyful/pipe

A JavaScript/TypeScript utility for function composition that allows you to pipe values through a series of functions.

## Installation

```bash
# deno
deno add jsr:@joyful/pipe

# pnpm 10.9+
pnpm add jsr:@joyful/pipe

# yarn 4.9+
yarn add jsr:@joyful/pipe

# npm, bun, and older versions of yarn or pnpm
npx jsr add @joyful/pipe
```

## Usage

The `pipe` function takes a value and a series of functions, applying each function to the result of the previous one.

```typescript
import { pipe } from "@joyful/pipe";

const double = (x: number) => x * 2;
const square = (x: number) => x * x;
const addFive = (x: number) => x + 5;

// Basic usage
const result = pipe(4, double, square, addFive);
// result = 69
// Explanation: 4 → double(4) = 8 → square(8) = 64 → addFive(64) = 69
```

## API Reference

### `pipe(value, ...functions)`

**Parameters:**
- `value: T` - The initial value to pipe through the functions
- `...functions: ((value: T) => U)[]` - Functions to apply in sequence

**Returns:**
- The final result after applying all functions

## Example

### String Processing

```typescript
const trim = (s: string) => s.trim();
const toUpperCase = (s: string) => s.toUpperCase();
const addExclamation = (s: string) => s + "!";

const result = pipe("  hello world  ", trim, toUpperCase, addExclamation);
// result = "HELLO WORLD!"
```

## Benefits

- **Type Safety**: Full TypeScript support with proper type inference
- **Readability**: Left-to-right function composition is easier to read than nested function calls
- **Immutability**: Creates new values without mutating the original
- **Composable**: Easy to create reusable function pipelines

## Vite Plugin

This package also includes a Vite plugin that transforms `pipe` calls into nested function calls and eliminates the runtime overhead of the `pipe` function at build time for better performance.

### Installation

```typescript
// vite.config.ts
import { pipePlugin } from "@joyful/pipe/vite";

export default {
  plugins: [
    pipePlugin({
      // Optional: specify a different package alias
      pipePackage: "@joyful/pipe"
    })
  ]
};
```

### Plugin Options

```typescript
export type PipeOptions = {
  /** The package alias for `@joyful/pipe`. Use this if you have a different alias for this package
   *
   * default: "@joyful/pipe"
   */
  pipePackage?: string;
};
```

### How it Works

The plugin transforms `pipe` calls at build time:

```typescript
// Before transformation
pipe(4, double, square, addFive);

// After transformation
addFive(square(double(4)));
```

This eliminates the runtime overhead of the `pipe` function while maintaining the same functionality and type safety.

### Benefits

- **Zero Runtime**: No function call overhead at runtime
- **Tree Shaking**: Dead code elimination works better
- **Bundle Size**: Smaller bundles in production
- **Type Safety**: Maintains full TypeScript type checking

## License

MIT
