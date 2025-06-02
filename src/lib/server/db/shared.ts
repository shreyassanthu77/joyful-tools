import { uuid, pgTable, timestamp, jsonb } from "drizzle-orm/pg-core";

export * from "drizzle-orm/pg-core";

export const json = <T>(name?: string) => jsonb(name as string).$type<T>();

export const id = (name?: string) =>
	uuid(name as string)
		.defaultRandom()
		.primaryKey();

export const timestamps = {
	createdAt: timestamp().defaultNow().notNull(),
	updatedAt: timestamp()
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
} as const;

export const defaults = {
	...timestamps,
	id: id(),
} as const;

export const table = pgTable;
