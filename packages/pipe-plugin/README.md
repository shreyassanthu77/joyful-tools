# @joyful/pipe-plugin

Vite plugin for [@joyful/pipe](https://jsr.io/@joyful/pipe).

This plugin optimizes `pipe` calls by transforming them into nested function calls at build time, eliminating runtime overhead.

## Installation

```bash
deno add @joyful/pipe-plugin
```

## Usage

```typescript
import { defineConfig } from "vite";
import { pipePlugin } from "@joyful/pipe-plugin";

export default defineConfig({
  plugins: [pipePlugin()],
});
```
