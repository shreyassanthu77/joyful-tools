import readline from "node:readline";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, basename, relative } from "node:path";

const cwd = process.cwd();
let config = {
	port: "5432",
	dbname: `${sanitizeDbname(basename(cwd))}-postgres`,
	version: "latest",
	password: "postgres",
};
const volumeName = `${config.dbname}-data`;

const envFilePath = join(cwd, ".env.local");
let foundConfigOptions = {
	port: false,
	dbname: false,
	version: false,
	password: false,
};
let envLocalFileContents = "";
let envLocalFileContentsLen = 0;
if (!existsSync(envFilePath)) {
	console.log("Configuration file not found, creating...");
} else {
	console.info("Loading configuration from .env.local");
	envLocalFileContents = readFileSync(envFilePath, "utf8");
	envLocalFileContentsLen = envLocalFileContents.length;
}

for (let line of envLocalFileContents.split("\n")) {
	line = line.trim();
	if (line.length === 0 || line.startsWith("#")) {
		continue;
	}
	let [key, value] = line.split("=");
	key = key.trim();
	value = value.trim();
	switch (key) {
		case "POSTGRES_PORT":
			config.port = value;
			foundConfigOptions.port = true;
			break;
		case "POSTGRES_DBNAME":
			config.dbname = value;
			foundConfigOptions.dbname = true;
			break;
		case "POSTGRES_VERSION":
			config.version = value;
			foundConfigOptions.version = true;
			break;
		case "POSTGRES_PASSWORD":
			config.password = value;
			foundConfigOptions.password = true;
			break;
	}
}

if (!foundConfigOptions.port || !foundConfigOptions.dbname || !foundConfigOptions.version) {
	envLocalFileContents += `
############################
# PostgreSQL configuration
############################
`;
}

if (!foundConfigOptions.port) {
	while (true) {
		const port = await prompt(`Enter port for PostgreSQL server [${config.port}]: `, config.port);
		if (!port.match(/^[0-9]{1,5}$/)) {
			console.error("Error: Invalid port number. Port must be a number between 1 and 65535.");
			continue;
		}
		let parsedPort: number;
		try {
			parsedPort = parseInt(port);
		} catch (e) {
			console.error("Error: Invalid port number. Port must be a number between 1 and 65535.");
			continue;
		}
		if (parsedPort < 1 || parsedPort > 65535) {
			console.error("Error: Invalid port number. Port must be a number between 1 and 65535.");
			continue;
		}
		config.port = parsedPort.toString();
		break;
	}
	envLocalFileContents += `\nPOSTGRES_PORT=${config.port}`;
}
if (!foundConfigOptions.dbname) {
	config.dbname = await prompt(`Enter database name [${config.dbname}]: `, config.dbname);
	envLocalFileContents += `\nPOSTGRES_DBNAME=${config.dbname}`;
}
if (!foundConfigOptions.version) {
	config.version = await prompt(
		`Enter Docker PostgreSQL version [${config.version}]: `,
		config.version,
	);
	envLocalFileContents += `\nPOSTGRES_VERSION=${config.version}`;
}
if (!foundConfigOptions.password) {
	config.password = await prompt(
		`Enter password for postgres user [${config.password}]: `,
		config.password,
	);
	envLocalFileContents += `\nPOSTGRES_PASSWORD=${config.password}`;
}
if (envLocalFileContents.length > envLocalFileContentsLen) {
	console.log("Saving configuration to .env.local");
	writeFileSync(envFilePath, envLocalFileContents);
}

const [programName, scriptName, ...args] = process.argv;
const programCmd = `${basename(programName)} ${relative(cwd, scriptName)}`;
if (args.length === 0) {
	printHelp();
} else {
	switch (args[0]) {
		case "help":
			printHelp();
		case "state":
			state();
			break;
		case "run":
		case "start":
			run();
			break;
		case "stop":
			stop();
			break;
		case "rm":
			rm();
			break;
		case "clean":
			clean();
			break;
		case "tail":
			tail();
			break;
		default:
			console.error(`Unknown command: ${args[0]}`);
			printHelp();
	}
	process.exit(0);
}

function state() {
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo) {
		console.log(`Container '${config.dbname}' is ${containerInfo.State}.`);
	} else {
		console.error(`Error: Container '${config.dbname}' does not exist.`);
		console.error(`You can create/start it with: ${programCmd} run`);
		process.exit(1);
	}
}

function run() {
	checkDocker();
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo && containerInfo.State === "running") {
		console.error(`Error: A container named '${config.dbname}' is already running.`);
		console.error(`You can stop it with: ${programCmd} stop`);
		process.exit(1);
	} else if (containerInfo) {
		console.warn(`Warning: A stopped container named '${config.dbname}' exists. Removing it...`);
		spawnSync("docker", ["rm", config.dbname], {
			stdio: "ignore",
		});
	}
	console.log(`Starting PostgreSQL server...`);
	spawnSync("docker", [
		"run",
		"-d",
		"--name",
		config.dbname,
		"-e",
		`POSTGRES_PASSWORD=${config.password}`,
		"-e",
		`POSTGRES_DB=${config.dbname}`,
		"-e",
		"POSTGRES_USER=postgres",
		"-p",
		`${config.port}:5432`,
		"-v",
		`${volumeName}:/var/lib/postgresql/data`,
		`postgres:${config.version}`,
	]);
}

function stop() {
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo && containerInfo.State === "running") {
		console.log(`Stopping PostgreSQL server '${config.dbname}'...`);
		console.log(`docker stop ${config.dbname}`);
		spawnSync("docker", ["stop", config.dbname], { stdio: "ignore" });
	} else if (containerInfo) {
		console.warn(`Warning: Container '${config.dbname}' is not running.`);
		console.warn(`You can start it with: ${programCmd} run`);
	} else {
		console.error(`Error: Container '${config.dbname}' does not exist.`);
		console.error(`You can start it with: ${programCmd} run`);
		process.exit(1);
	}
}

function rm() {
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo) {
		if (containerInfo.State === "running") {
			console.warn(`Warning: Container '${config.dbname}' is running. Stopping it first...`);
			stop();
		}
		console.log(`Removing container '${config.dbname}' (data volume is preserved)...`);
		console.log(`docker rm ${config.dbname}`);
		spawnSync("docker", ["rm", config.dbname], { stdio: "ignore" });
	} else {
		console.error(`Error: Container '${config.dbname}' does not exist.`);
		console.error(`You can create/start it with: ${programCmd} run`);
		process.exit(1);
	}
}

function clean() {
	rm();
	console.log(`Removing data volume '${volumeName}'...`);
	console.log(`dcoker volume rm ${volumeName}`);
	spawnSync("docker", ["volume", "rm", volumeName], { stdio: "ignore" });
}

function tail() {
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo) {
		console.log(`Tailing logs for container '${config.dbname}' (Ctrl+C to stop)...`);
		spawnSync("docker", ["logs", "-f", config.dbname], { stdio: "inherit" });
	} else {
		console.error(`Error: Container '${config.dbname}' does not exist.`);
		console.error(`You can create/start it with: ${programCmd} run`);
		process.exit(1);
	}
}

function getContainerInfo(containerName: string) {
	const runningCheck = spawnSync(
		"docker",
		["ps", "-a", "--format", "json", "--filter", `name=^/${containerName}$`],
		{
			encoding: "utf8",
			stdio: "pipe",
		},
	);
	if (runningCheck.stdout.length > 0) {
		const output = JSON.parse(runningCheck.stdout.split("\n")[0]) as {
			ID: string;
			Image: string;
			State: "running" | "exited";
		};
		return output;
	}
	return null;
}

function checkDocker() {
	const dockerCheck = spawnSync("docker", ["-v"], {
		stdio: "pipe",
		encoding: "utf8",
	});
	if (dockerCheck.error) {
		console.error(dockerCheck.error);
		console.error(
			`Error: Docker is not installed. Please install Docker to run the PostgreSQL server.`,
		);
		process.exit(1);
	}
}

function printHelp(): never {
	console.log(`Usage: ${programCmd} [command]
Starts a postgres server on the specified port
with the specified database name.
Creates the data directory at ./data if it doesn't exist.
If ./.env.local is missing, prompts for configuration and saves it.
If ./.env.local exists but is missing keys, defaults are added.
Runs the server with docker.

Commands:
  state:       Print the status of the PostgreSQL server
  help:        Print this help message
  run, start:  Create and start the PostgreSQL server if not already running
  stop:        Stop the PostgreSQL server if running
  tail:        Tail the PostgreSQL server logs
  rm:          Remove the PostgreSQL server container but not the data volume
  clean:       Remove the PostgreSQL server container and the data volume
`);
	process.exit(0);
}

// pattern: [a-zA-Z0-9][a-zA-Z0-9_.-]
function sanitizeDbname(dbname: string) {
	dbname = dbname.replace(/[^a-zA-Z0-9_.-]/g, "_");
	if (dbname?.[0].match(/[^a-zA-Z0-9]/)) {
		dbname = `${dbname}`;
	}
	dbname = dbname.replace(/^_/, "").replace(/_$/, "");
	if (dbname.length === 0) {
		dbname = "postgres";
	}
	return dbname;
}

function prompt(question: string, defaultValue?: string) {
	const rl: readline.Interface =
		// @ts-ignore
		prompt.___rl ?? readline.createInterface({ input: process.stdin, output: process.stdout });
	// @ts-ignore
	if (!prompt.___rl) prompt.___rl = rl;

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
// @ts-ignore
prompt.___rl?.close();
