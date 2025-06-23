<script lang="ts">
	import type { ConfirmDialogOptions, DialogComponentProps } from "./index.ts";
	import Button from "$lib/ui/Button.svelte";
	import { onMount } from "svelte";

	let {
		title,
		message,
		onCancel,
		onConfirm,
		close,
		styles = $bindable({}),
		Title,
		Description,
		Content,
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
	class={[
		{
			"animate-dialog-contents absolute top-1/2 left-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-4":
				defaultStyles.contentContainer !== false,
		},
		styles.contentContainer,
	]}
>
	<div class="flex flex-col rounded-lg bg-white p-4">
		<Title
			class={[
				{ "text-2xl font-bold": defaultStyles.title !== false },
				styles.title,
			]}>{title}</Title
		>
		<Description
			class={[{ "text-lg": defaultStyles.message !== false }, styles.message]}
			>{message}</Description
		>
		<div
			class={[
				{
					"mt-3 flex flex-wrap items-center justify-end gap-2 md:gap-3":
						defaultStyles.buttonsContainer !== false,
				},
				styles.buttonsContainer,
			]}
		>
			{#if styles.reverseActions === true}
				{@render CancelButton()}
				{@render ConfirmButton()}
			{:else}
				{@render ConfirmButton()}
				{@render CancelButton()}
			{/if}
		</div>
	</div>
</Content>

{#snippet ConfirmButton()}
	<Button
		defaultStyles={defaultStyles.confirm}
		class={["w-full md:w-auto", styles.confirm]}
		{disabled}
		onclick={confirm}
	>
		{#if loading_state === "confirming"}
			Confirming...
		{:else}
			Confirm
		{/if}
	</Button>
{/snippet}

{#snippet CancelButton()}
	<Button
		defaultStyles={defaultStyles.cancel}
		class={["w-full md:w-auto", styles.cancel]}
		{disabled}
		bind:ref={cancelButton}
		onclick={cancel}
	>
		{#if loading_state === "cancelling"}
			Cancelling...
		{:else}
			Cancel
		{/if}
	</Button>
{/snippet}
