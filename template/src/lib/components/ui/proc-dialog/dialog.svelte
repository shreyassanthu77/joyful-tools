<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog";
	import { dialogState } from "./dialog-state.svelte.ts";
	import type { DialogBaseProps, Dialog as DialogT } from "./index.ts";

	interface Props {
		dialog: DialogT;
	}

	let { dialog }: Props = $props();

	let open = $state(true);

	function close(result: any = undefined) {
		open = false;
		dialog.resolvers.resolve(result);
	}

	function handleOpenChangeComplete(open: boolean) {
		if (!open) {
			dialogState.remove(dialog.id);
		}
	}

	const baseProps: DialogBaseProps<any> = {
		close,
	};
</script>

<Dialog.Root
	bind:open
	onOpenChangeComplete={handleOpenChangeComplete}
	onOpenChange={(v) => !v && close()}
>
	{#if dialog.kind === "snippet"}
		{@render dialog.snippet.s({
			...baseProps,
			data: dialog.snippet.props,
		})}
	{:else if dialog.kind === "component"}
		<dialog.component {...dialog.props} {...baseProps} />
	{/if}
</Dialog.Root>
