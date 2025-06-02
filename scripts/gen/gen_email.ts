import { cli, prompt, type CliContext, exec, exit, log } from "../shared.ts";
import { template } from "../template.ts";
import { simple } from "swc-walk";
type Ctx = CliContext<void>;

export async function genEmail(ctx: Ctx) {
	await template({
		"src/lib/server/db/email.ts": {
			create: emailDbSchema,
			update: emailDbSchema,
		},
		"src/lib/server/db/schema.ts": {
			update: async (module) => {
				let alreadyExported = false;
				simple(module, {
					ExportAllDeclaration(exp) {
						if (exp.source.value === "./email.ts") alreadyExported = true;
						console.log("export all");
					},
				});
				if (alreadyExported) return;
				module.body.push({
					type: "ExportAllDeclaration",
				});
			},
		},
		"src/lib/server/email.ts": {
			create: emailCode,
		},
	});
}

const emailDbSchema = `
import { table,  defaults, text, json } from "./shared";

export const emails = table("emails", (t) => ({
	...defaults,
	subject: text(),
	to: json<string[]>(),
	from: text(),
	bodyHtml: text(),
}));
`.trim();

const emailCode = `// email code`;
