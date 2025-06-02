import { type Module, parse, print } from "@swc/core";
import { styleText } from "node:util";
import { existsSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { log, exit } from "./shared.ts";

const cwd = process.cwd();
export async function template(
	files: Record<
		string,
		{
			create?: string;
			update?:
				| string
				| ((
						mod: Module,
						info: {
							root: string;
							absoluteFilePath: string;
						},
				  ) => void | Promise<void>);
		}
	>,
) {
	const root = findProjectRoot(cwd);
	for (const [file, content] of Object.entries(files)) {
		const filePath = join(root, file);
		const absoluteFilePath = resolve(filePath);
		if (existsSync(filePath)) {
			if (content.update) {
				if (typeof content.update === "string") {
					await writeFile(filePath, content.update);
				} else {
					try {
						const source = await readFile(filePath, "utf8");
						const mod = await parse(source, {
							syntax: file.endsWith(".ts") ? "typescript" : "ecmascript",
						});
						await content.update(mod, { root, absoluteFilePath });
						const { code } = await print(mod, {});
						await writeFile(filePath, code);
					} catch (e) {
						log.error(`Error updating ${file}`);
						console.error(e.message);
						exit(1);
					}
				}
				console.log(styleText(["yellow"], `    M ${file}`));
			} else {
				log.warn(`File ${file} already exists, skipping`);
				continue;
			}
		} else {
			if (!content.create) continue;
			await writeFile(filePath, content.create);
			console.log(styleText(["gray"], `    + ${file}`));
		}
	}
}

function findProjectRoot(cwd: string) {
	let current = cwd;
	let i = 0;
	while (true) {
		const pkgJsonPath = join(current, "package.json");
		if (existsSync(pkgJsonPath)) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			throw new Error("Could not find project root");
		}
		current = parent;
		i++;
		if (i > 50) {
			log.error("Could not find project root");
			exit(1);
		}
	}
}
