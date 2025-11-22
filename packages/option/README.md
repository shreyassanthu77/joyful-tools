# @joyful/option

A TypeScript implementation of the Option type for handling nullable values in a functional way.

This module provides a robust `Option<T>` type that represents either a value (`Some`) or no value (`None`). It serves as a safer alternative to `null` and `undefined`, forcing explicit handling of missing values and supporting functional composition.

## Installation

```bash
deno add @joyful/option
```

## Features

- **Type Safety**: forces you to handle the case where a value might be missing.
- **Functional Composition**: Chain operations with `map`, `andThen`, and `orElse`.
- **Pipeable**: Designed to work seamlessly with `@joyful/pipe`.
- **Zero Dependencies**: Lightweight and tree-shakeable.

## Usage

### Basic Example

```typescript
import { Option, Some, None, fromNullable } from "@joyful/option";

// Creating Options
const someValue = new Some(42);
const noValue = None;
const fromNull = fromNullable(null); // None

// Safe unwrapping
if (someValue.isSome()) {
  console.log(someValue.unwrap()); // 42
}

// Providing defaults
console.log(noValue.unwrapOr(0)); // 0
```

### Functional Transformations

```typescript
import { Option, map, andThen, match } from "@joyful/option";
import { pipe } from "@joyful/pipe";

const divide = (n: number, d: number): Option<number> =>
  d === 0 ? None : new Some(n / d);

const result = pipe(
  new Some(20),
  // Map unwrapped value: 20 -> 10
  map(n => n / 2),
  // Chain operation that might fail
  andThen(n => divide(n, 2)), // Some(5)
  // Pattern match to get final result
  match(
    val => `Result: ${val}`,
    () => "Calculation failed"
  )
);

console.log(result); // "Result: 5"
```

### Helper Functions

- `map(fn)`: Transform the inner value if it exists.
- `andThen(fn)`: Chain another Option-returning function (flatMap).
- `orElse(fn)`: Provide a fallback Option if the current one is None.
- `match(someFn, noneFn)`: Handle both cases and return a value.
- `fromNullable(val)`: Convert `null` or `undefined` to `None`.
