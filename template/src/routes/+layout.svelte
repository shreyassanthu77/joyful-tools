<script lang="ts">
	import "../app.css";
	import { dialog } from "$lib/ui/dialog";

	let { children } = $props();
</script>

{@render children()}
<dialog.Provider />
