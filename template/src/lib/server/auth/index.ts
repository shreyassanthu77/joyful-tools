import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "$lib/server/db";
import { secondaryStorage } from "./secondaryStorage";

export const auth = betterAuth({
	plugins: [],
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	secondaryStorage,
});
