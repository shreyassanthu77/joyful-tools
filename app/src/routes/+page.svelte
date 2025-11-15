<script lang="ts">
	import { jsonParse } from '$lib/utils/json';
	import { validate } from '$lib/utils/validator';
	import * as v from 'valibot';

	const schema = v.object({
		a: v.string(),
		b: v.number()
	});

	let value = $state('{"a":"hello", "b": 123}');
	let parsed = $derived(
		await jsonParse(value)
			.mapOrDefault({})
			.andThen((v) => validate(schema, v))
			.toAsync()
			.map(async (v) => {
				await new Promise((r) => setTimeout(r, 1000));
				return `${v.a} ${v.b}`;
			})
	);
</script>

<input type="text" bind:value />

{#if parsed.err()}
	<p>Errors: {parsed.error.issues.map((i) => i.message).join(', ')}</p>
{:else}
	<p>Valid {parsed.value}</p>
{/if}
