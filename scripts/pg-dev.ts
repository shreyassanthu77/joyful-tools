import { cli, prompt, type CliContextOf, exec, exit, log } from "./cli.ts";
import { join, basename } from "node:path";
import { existsSync, writeFileSync, readFileSync } from "node:fs";

cli({
	description: "A simple script to run a local PostgreSQL server with Docker.",
	init,
	commands: {
		state: [state, "Print the status of the PostgreSQL server"],
		run: [run, "Create and start the PostgreSQL server if not already running"],
		stop: [stop, "Stop the PostgreSQL server if running"],
		tail: [tail, "Tail the PostgreSQL server logs"],
		rm: [rm, "Remove the PostgreSQL server container but not the data volume"],
		clean: [clean, "Remove the PostgreSQL server container and the data volume"],
	},
});

async function init(cwd: string) {
	checkDocker();

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
		log.info("Configuration file not found, creating...");
	} else {
		log.info("Loading configuration from .env.local");
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
				log.error("Error: Invalid port number. Port must be a number between 1 and 65535.");
				continue;
			}
			let parsedPort: number;
			try {
				parsedPort = parseInt(port);
			} catch (e) {
				log.error("Error: Invalid port number. Port must be a number between 1 and 65535.");
				continue;
			}
			if (parsedPort < 1 || parsedPort > 65535) {
				log.error("Error: Invalid port number. Port must be a number between 1 and 65535.");
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
		log.info("Saving configuration to .env.local");
		writeFileSync(envFilePath, envLocalFileContents);
	}
	return {
		config,
		volumeName,
	};
}

function state({
	programCmd,
	data: {
		config: { dbname },
	},
}: CliContextOf<typeof init>) {
	const containerInfo = getContainerInfo(dbname);
	if (containerInfo) {
		log.info(`Container '${dbname}' is ${containerInfo.State}.`);
	} else {
		log.error(`Error: Container '${dbname}' does not exist.`);
		log.info(`You can create/start it with: ${programCmd} run`);
		exit(1);
	}
}

function run({ programCmd, data: { config, volumeName } }: CliContextOf<typeof init>) {
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo && containerInfo.State === "running") {
		log.error(`Error: A container named '${config.dbname}' is already running.`);
		log.error(`You can stop it with: ${programCmd} stop`);
		process.exit(1);
	} else if (containerInfo) {
		log.warn(`Warning: A stopped container named '${config.dbname}' exists. Removing it...`);
		exec("docker", ["rm", config.dbname], "ignore");
	}
	log.info(`Starting PostgreSQL server...`);
	exec("docker", [
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

function stop({ programCmd, data: { config } }: CliContextOf<typeof init>) {
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo && containerInfo.State === "running") {
		log.info(`Stopping PostgreSQL server '${config.dbname}'...`);
		exec("docker", ["stop", config.dbname], "ignore");
	} else if (containerInfo) {
		log.warn(`Warning: Container '${config.dbname}' is not running.`);
		log.warn(`You can start it with: ${programCmd} run`);
	} else {
		log.error(`Error: Container '${config.dbname}' does not exist.`);
		log.error(`You can start it with: ${programCmd} run`);
		exit(1);
	}
}

function rm(ctx: CliContextOf<typeof init>) {
	const {
		programCmd,
		data: { config },
	} = ctx;
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo) {
		if (containerInfo.State === "running") {
			log.warn(`Warning: Container '${config.dbname}' is running. Stopping it first...`);
			stop(ctx);
		}
		log.info(`Removing container '${config.dbname}' (data volume is preserved)...`);
		exec("docker", ["rm", config.dbname], "ignore");
	} else {
		log.error(`Error: Container '${config.dbname}' does not exist.`);
		log.error(`You can create/start it with: ${programCmd} run`);
		exit(1);
	}
}

function clean(ctx: CliContextOf<typeof init>) {
	const { volumeName } = ctx.data;
	rm(ctx);
	log.info(`Removing data volume '${volumeName}'...`);
	exec("docker", ["volume", "rm", volumeName], "ignore");
}

function tail({ programCmd, data: { config } }: CliContextOf<typeof init>) {
	const containerInfo = getContainerInfo(config.dbname);
	if (containerInfo) {
		log.info(`Tailing logs for container '${config.dbname}' (Ctrl+C to stop)...`);
		exec("docker", ["logs", "-f", config.dbname], "inherit");
	} else {
		log.error(`Error: Container '${config.dbname}' does not exist.`);
		log.error(`You can create/start it with: ${programCmd} run`);
		process.exit(1);
	}
}

function getContainerInfo(containerName: string) {
	const runningCheck = exec("docker", [
		"ps",
		"-a",
		"--format",
		"json",
		"--filter",
		`name=^/${containerName}$`,
	]);
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
	const dockerCheck = exec("docker", ["-v"]);
	if (dockerCheck.error) {
		log.error(dockerCheck.error);
		log.error(
			`Error: Docker is not installed. Please install Docker to run the PostgreSQL server.`,
		);
		process.exit(1);
	}
}

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
