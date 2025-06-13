import { uuid, pgTable, timestamp, jsonb } from "drizzle-orm/pg-core";

export * from "drizzle-orm/pg-core";

export const json = <T>(name?: string) => jsonb(name as string).$type<T>();

export const id = (name?: string) =>
	uuid(name as string)
		.defaultRandom()
		.primaryKey();

export function withDefaults<T extends Record<string, any>>(obj: T) {
	return {
		id: id(),
		...obj,
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp()
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	};
}

export const table = pgTable;
