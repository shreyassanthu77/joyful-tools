import { render as ssrRender } from "svelte/server";
import index from "./index.svelte";

export function render() {
  const { head, body } = ssrRender(index);
  return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<link rel="icon" href="/favicon.png" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		${head}
	</head>
	<body>
		<div id="app">${body}</div>
		<script type="module" src="/src/entry.client.ts"></script>
	</body>
</html>`;
}
