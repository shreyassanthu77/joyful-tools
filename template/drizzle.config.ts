import { defineConfig } from "drizzle-kit";

let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	const DBNAME = process.env.POSTGRES_DBNAME;
	const DBUSER = process.env.POSTGRES_USER ?? "postgres";
	const DBPASS = process.env.POSTGRES_PASSWORD;
	const DBHOST = process.env.POSTGRES_HOST ?? "localhost";
	const DBPORT = process.env.POSTGRES_PORT ?? "5432";
	if (!DBNAME) throw new Error("DBNAME is not set");
	if (!DBUSER) throw new Error("DBUSER is not set");
	if (!DBPASS) throw new Error("DBPASS is not set");
	DATABASE_URL = `postgres://${DBUSER}:${DBPASS}@${DBHOST}:${DBPORT}/${DBNAME}`;
}
console.log(DATABASE_URL);

export default defineConfig({
	schema: "./src/lib/server/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: { url: DATABASE_URL },
	verbose: true,
	strict: true,
});
