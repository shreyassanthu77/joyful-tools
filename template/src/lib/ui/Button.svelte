<script lang="ts">
	import { Button as BitsButton, type ButtonRootProps } from "bits-ui";
	import { cn } from "$lib/utils/cn";

	export type Props = ButtonRootProps & {
		defaultStyles?: boolean;
	};

	let {
		children,
		defaultStyles,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();
</script>

<BitsButton.Root
	bind:ref
	class={cn([
		{
			"rounded-lg px-6 py-2 shadow-sm transition-[filter] hover:brightness-90":
				defaultStyles !== false,
		},
		className,
	])}
	{...rest}
>
	{@render children?.()}
</BitsButton.Root>
