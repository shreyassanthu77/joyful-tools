import { table,  defaults, text, json } from "./shared";

export const emails = table("emails", (t) => ({
	...defaults,
	subject: text(),
	to: json<string[]>(),
	from: text(),
	bodyHtml: text(),
}));