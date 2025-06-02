import readline from "node:readline";
import { styleText } from "node:util";
import { basename, relative } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();

export type CliContextOf<T extends (cwd: string) => Promise<any>> = CliContext<
	Awaited<ReturnType<T>>
>;

export interface CliContext<T> {
	programCmd: string;
	programName: string;
	scriptName: string;
	args: string[];
	printHelp: (status?: number) => never;
	data: T extends void ? undefined : T;
}

let rl = readline.createInterface({ input: process.stdin, output: process.stdout });

export async function cli<const T = void>(options: {
	init?: (cwd: string) => T | Promise<T>;
	description: string;
	commands: Record<
		string,
		[(ctx: CliContext<T>) => void | number | Promise<number | void>, string]
	>;
}) {
	const [programName, scriptName, ...args] = process.argv;
	const data = await options.init?.(cwd);
	const programCmd = `${basename(programName)} ${relative(cwd, scriptName)}`;
	let paddingCount = 0;
	for (const cmd in options.commands) {
		if (cmd.length > paddingCount) paddingCount = cmd.length;
	}
	paddingCount += 2;
	const padding = " ".repeat(paddingCount);
	const help = `
${styleText(["bold"], "Description")}
${styleText(["gray"], options.description.trim())}

${styleText(["bold"], "Commands")}
${Object.entries(options.commands)
	.map(([cmd, [, description]]) => `  ${cmd}:${padding}${description}`)
	.join("\n")}`;
	function printHelp(status = 0): never {
		console.log(`Usage: ${programCmd} [command]`);
		console.log(help);
		exit(status);
	}
	const ctx: CliContext<T> = {
		programCmd,
		programName,
		scriptName,
		args,
		data: data as T extends void ? undefined : T,
		printHelp,
	};
	if (args.length === 0 || args[0] === "help") {
		printHelp(0);
	}
	const cmd = args[0]!;
	if (cmd in options.commands) {
		const [handler] = options.commands[cmd];
		const exitCode = await handler(ctx);
		exit(exitCode ?? 0);
	}
	log.error(`Unknown command: ${cmd}`);
	printHelp(1);
}

export function exit(code: number): never {
	rl.close();
	process.exit(code);
}

export function prompt(question: string, defaultValue?: string): Promise<string> {
	return new Promise<string>((resolve) => {
		rl.question(question, (answer) => {
			if (answer.length === 0) {
				resolve(defaultValue ?? "");
			} else {
				resolve(answer);
			}
		});
	});
}

export function exec(
	command: string,
	args: string[],
	stdio: "inherit" | "pipe" | "ignore" = "pipe",
) {
	console.log(styleText(["blue"], "  [CMD]"), styleText(["gray"], `${command} ${args.join(" ")}`));
	if (stdio === "inherit") rl.close();
	const res = spawnSync(command, args, {
		stdio,
		encoding: "utf-8",
	});
	if (stdio === "inherit")
		rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return res;
}

export const log = {
	info,
	warn,
	error,
};

function info(...args: any[]) {
	console.info(styleText(["blue"], " [INFO]"), ...args);
}

function warn(...args: any[]) {
	console.warn(styleText(["yellow"], " [WARN]"), ...args);
}

function error(...args: any[]) {
	console.error(styleText(["red"], "[ERROR]"), ...args);
}
