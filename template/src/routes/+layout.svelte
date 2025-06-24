<script lang="ts">
	import "../app.css";
	import { ModeWatcher } from "mode-watcher";
	import { Toaster } from "$lib/components/ui/sonner";
	import { dialog } from "$lib/components/ui/proc-dialog";
	import ThemeSwitcher from "$lib/components/ui/theme-switcher/theme-switcher.svelte";

	let { children } = $props();
</script>

{@render children()}

<ThemeSwitcher />
<ModeWatcher />
<dialog.Provider />
<Toaster position="top-right" />
