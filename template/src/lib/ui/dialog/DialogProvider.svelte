<script lang="ts">
	import { dialogState } from "./dialog_state.svelte.ts";
	import Dialog from "./Dialog.svelte";

	const dialogs = $derived(dialogState.dialogs);
</script>

{#each dialogs as dialog}
	<Dialog {dialog} />
{/each}
