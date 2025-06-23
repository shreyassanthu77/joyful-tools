<script lang="ts">
	import { Dialog } from "bits-ui";
	import { dialogState } from "./dialog_state.svelte";
	import type { DialogBaseProps, Dialog as DialogT } from "./index.ts";

	interface Props {
		dialog: DialogT;
	}

	let { dialog }: Props = $props();

	let open = $state(true);

	function close(result: any = undefined) {
		open = false;
		dialog.resolvers.resolve(result);
		setTimeout(() => {
			dialogState.remove(dialog.id);
		}, 200);
	}

	const baseProps: DialogBaseProps<any> = {
		close,
		Title: Dialog.Title,
		Description: Dialog.Description,
		Content: Dialog.Content,
	};
</script>

<Dialog.Root bind:open onOpenChange={(v) => !v && close()}>
	<Dialog.Portal>
		<div class="fixed inset-0 isolate">
			<Dialog.Overlay
				class="animate-dialog-overlay fixed inset-0 bg-black/50 backdrop-blur-sm"
			/>
			{#if dialog.kind === "snippet"}
				{@render dialog.snippet.s({
					...baseProps,
					data: dialog.snippet.props,
				})}
			{:else if dialog.kind === "component"}
				<dialog.component {...dialog.props} {...baseProps} />
			{/if}
		</div>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.animate-dialog-overlay[data-state="open"]) {
		animation: fade-in 0.2s ease-out;
	}

	:global(.animate-dialog-overlay[data-state="closed"]) {
		animation: fade-out 0.2s ease-out;
	}

	:global(.animate-dialog-contents[data-state="open"]) {
		animation:
			fade-in 0.2s ease-out,
			slide-up 0.2s ease-out;
	}

	:global(.animate-dialog-contents[data-state="closed"]) {
		animation:
			fade-out 0.2s ease-out,
			slide-down 0.2s ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes fade-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	@keyframes slide-up {
		from {
			transform: translateY(var(--_slide-amount, 50%));
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes slide-down {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(var(--_slide-amount, 50%));
		}
	}
</style>
