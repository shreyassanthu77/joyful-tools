<script lang="ts">
	import type { PageProps } from "./$types";
	let { data }: PageProps = $props();
	import { dialog } from "$lib/ui/dialog";

	async function deleteData() {
		if (
			await dialog.confirm.danger({
				title: "Delete Data",
				message: "Are you sure you want to delete all data?",
			})
		) {
			console.log("Deleted");
		} else {
			console.log("Cancelled");
		}
	}
</script>

<h1>Welcome to Joy!</h1>
<button onclick={deleteData}> Delete </button>
<p>
	Visit number {data.views}
</p>
