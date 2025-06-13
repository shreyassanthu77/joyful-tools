import { createAuthClient } from "better-auth/svelte";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "$lib/server/auth";

export const authClient = createAuthClient({
	plugins: [adminClient(), inferAdditionalFields<typeof auth>()],
});
