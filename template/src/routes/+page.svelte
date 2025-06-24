<script lang="ts">
	import type { PageProps } from "./$types";
	let { data }: PageProps = $props();
	import { dialog } from "$lib/components/ui/proc-dialog";
	import { toast } from "svelte-sonner";

	async function deleteData() {
		if (
			await dialog.confirm({
				title: "Delete Data",
				message: "Are you sure you want to delete all data?",
				styles: { confirmVariant: "default" },
			})
		) {
			toast.success("Data deleted");
		} else {
			toast.error("Data not deleted");
		}
	}
</script>

<h1>Welcome to Joy!</h1>
<button onclick={deleteData}> Delete </button>
<p>
	Visit number {data.views}
</p>
