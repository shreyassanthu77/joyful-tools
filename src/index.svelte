<script lang="ts">
	let count = $state(0);
</script>

<h1>Hello {count}</h1>

<button onclick={() => (count += 1)}>+1</button>
