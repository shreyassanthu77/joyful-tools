import { genEmail } from "./gen/gen_email.ts";
import { cli, prompt, type CliContextOf, exec, exit, log } from "./shared.ts";

cli({
	description: "A Script to generate various parts to be used in the project.",
	commands: {
		email: [genEmail, "Generate code for sending email"],
	},
});
