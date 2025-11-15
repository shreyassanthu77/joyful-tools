<script lang="ts">
	import { jsonParse } from '$lib/utils/json';
	import { Result } from '$lib/utils/result';
	import { validate } from '$lib/utils/validator';
	import * as v from 'valibot';

	const schema = v.object({
		a: v.string(),
		b: v.number()
	});

	let value = $state('{"a":"hello"}');
	let parsed = $derived(
		jsonParse(value)
			.mapOrDefault({})
			.andThen((v) => validate(schema, v))
	);
</script>

<input type="text" bind:value />

{#if parsed.err()}
	<p>Errors: {parsed.error.issues.map((i) => i.message).join(', ')}</p>
{:else}
	<p>Valid</p>
{/if}
