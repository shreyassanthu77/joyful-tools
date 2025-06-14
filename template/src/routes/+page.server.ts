import { kv } from "$lib/server/kv";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	console.time("get views");
	const existingViews = await kv.get("views");
	console.timeEnd("get views");
	if (!existingViews.ok) throw existingViews.error;
	const views = +(existingViews.value ?? 0) + 1;
	console.time("set views");
	await kv.set("views", views.toString());
	console.timeEnd("set views");
	return {
		views,
	};
};
