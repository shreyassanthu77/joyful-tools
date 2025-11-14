import { kv } from "$lib/server/kv";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const existingViews = await kv.get("views");
	if (!existingViews.ok) throw existingViews.error;
	const views = +(existingViews.value ?? 0) + 1;
	kv.set("views", views.toString());
	return {
		views,
	};
};
