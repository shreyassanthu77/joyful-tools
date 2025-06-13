import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "$lib/server/db";

export const auth = betterAuth({
	plugins: [],
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
});
