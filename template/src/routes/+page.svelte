<script lang="ts">
	import type { PageProps } from "./$types";
	let { data }: PageProps = $props();
</script>

<h1>Welcome to Joy!</h1>
<p>
	Visit number {data.views}
</p>
