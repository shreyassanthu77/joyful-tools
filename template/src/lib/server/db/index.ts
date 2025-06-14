import { env } from "$env/dynamic/private";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const {
	POSTGRES_HOST,
	POSTGRES_PORT,
	POSTGRES_DBNAME,
	POSTGRES_USER,
	POSTGRES_PASSWORD,
} = env;

if (!POSTGRES_PORT) throw new Error("ENV: POSTGRES_PORT is not set");
if (!POSTGRES_DBNAME) throw new Error("ENV: POSTGRES_DB is not set");
if (!POSTGRES_USER) throw new Error("ENV: POSTGRES_USER is not set");
if (!POSTGRES_PASSWORD) throw new Error("ENV: POSTGRES_PASSWORD is not set");

const client = postgres({
	host: POSTGRES_HOST ?? "localhost",
	port: +POSTGRES_PORT,
	database: POSTGRES_DBNAME,
	user: POSTGRES_USER,
	password: POSTGRES_PASSWORD,
});

export const db = drizzle(client, {
	schema,
	casing: "snake_case",
});
