<script lang="ts">
	import { Button as BitsButton, type ButtonRootProps } from "bits-ui";
	export type Props = ButtonRootProps & {
		defaultStyles?: boolean;
	};

	let { children, defaultStyles, class: className, ...rest }: Props = $props();
</script>

<BitsButton.Root
	class={[
		{
			"rounded-lg px-6 py-2 shadow-sm transition-[filter] hover:brightness-90":
				defaultStyles !== false,
		},
		className,
	]}
	{...rest}
>
	{@render children?.()}
</BitsButton.Root>
