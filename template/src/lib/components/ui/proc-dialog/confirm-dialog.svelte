<script lang="ts">
	import type { ConfirmDialogOptions, DialogComponentProps } from "./index.ts";
	import { Button } from "$lib/components/ui/button";
	import {
		Title,
		Description,
		Content,
		Header,
		Footer,
	} from "$lib/components/ui/dialog";

	let {
		title,
		message,
		onCancel,
		onConfirm,
		close,
		styles = $bindable({}),
	}: DialogComponentProps<ConfirmDialogOptions, boolean> = $props();

	let loading_state = $state<"idle" | "confirming" | "cancelling">("idle");
	let disabled = $derived(loading_state !== "idle");
	let cancelButton = $state<HTMLButtonElement | null>(null);
	const triggerElement = document?.activeElement as HTMLElement | null;

	const defaultStyles =
		styles.defaults === false
			? {
					title: false,
					message: false,
					confirm: false,
					cancel: false,
					buttonsContainer: false,
				}
			: (styles.defaults ?? {});

	async function handleOpenAutoFocus(ev: Event) {
		if (cancelButton) {
			ev.preventDefault();
			cancelButton.focus();
		}
	}

	async function handleCloseAutoFocus(ev: Event) {
		if (triggerElement) {
			ev.preventDefault();
			triggerElement?.focus();
		}
	}

	async function confirm() {
		if (onConfirm) {
			loading_state = "confirming";
			await onConfirm();
			close(true);
			loading_state = "idle";
		} else close(true);
	}

	async function cancel() {
		if (onCancel) {
			loading_state = "cancelling";
			await onCancel();
			close(false);
			loading_state = "idle";
		} else close(false);
	}
</script>

<Content
	onOpenAutoFocus={handleOpenAutoFocus}
	onCloseAutoFocus={handleCloseAutoFocus}
	showCloseButton={false}
>
	<Header>
		<Title>{title}</Title>
		<Description>{message}</Description>
		<Footer class="mt-3">
			{#if styles.reverseActions === true}
				{@render CancelButton()}
				{@render ConfirmButton()}
			{:else}
				{@render ConfirmButton()}
				{@render CancelButton()}
			{/if}
		</Footer>
	</Header>
</Content>

{#snippet ConfirmButton()}
	<Button variant="destructive" {disabled} onclick={confirm}>
		{#if loading_state === "confirming"}
			Confirming...
		{:else}
			Confirm
		{/if}
	</Button>
{/snippet}

{#snippet CancelButton()}
	<Button variant="outline" {disabled} bind:ref={cancelButton} onclick={cancel}>
		{#if loading_state === "cancelling"}
			Cancelling...
		{:else}
			Cancel
		{/if}
	</Button>
{/snippet}
