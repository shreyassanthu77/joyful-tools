<script lang="ts">
	import "../app.css";
	import { Toaster } from "$lib/components/ui/sonner";
	import { dialog } from "$lib/components/ui/proc-dialog";

	let { children } = $props();
</script>

{@render children()}
<dialog.Provider />
<Toaster position="top-right" />
