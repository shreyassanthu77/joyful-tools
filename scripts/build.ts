import { dts } from "rolldown-plugin-dts";
import { build } from "rolldown";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGraph } from "@deno/graph";

const cwd = Deno.cwd();
const DIST = "dist";
const destDir = join(cwd, DIST);
const jsrOrg = "@joyful";
const npmOrg = "@joyful-tools";
const repo = "https://github.com/shreyassanthu77/joyful-tools";
async function buildPackage(pkg: string) {
  const configPath = join(cwd, pkg, "deno.json");
  const config = JSON.parse(await Deno.readTextFile(configPath)) as {
    name?: string;
    version?: string;
    license?: string;
    exports: Record<string, string>;
    publish: {
      include: string[];
    };
  };
  const configDir = relative(cwd, dirname(configPath));
  const packageDirname = basename(configDir);
  if (!config.name || !config.version) {
    console.log(`%cSkipping ${pkg}`, "color: gray; font-weight: thin");
    return;
  }
  console.log(`%cBuilding ${pkg}`, "color: blue; font-weight: thin");
  const packageDestDir = join(destDir, packageDirname);
  await Deno.mkdir(packageDestDir, { recursive: true });

  // create package.json
  const name = config.name.replace(`${jsrOrg}`, npmOrg);
  const packageJSON = {
    name,
    version: config.version,
    type: "module",
    license: config.license ?? "MIT",
    repository: {
      type: "git",
      url: `${repo}.git`,
      directory: configDir,
    },
    bugs: {
      url: `${repo}/issues`,
    },
    dependencies: {} as Record<string, string>,
    exports: {} as Record<string, unknown>,
  };

  // copy src files
  const dirs = new Set<string>(
    config.publish.include.map((file) => dirname(file)),
  );
  for (const dir of dirs) {
    await Deno.mkdir(join(packageDestDir, dir), { recursive: true });
  }
  await Promise.all(
    config.publish.include.map(async (file) => {
      const src = join(cwd, configDir, file);
      const dest = join(packageDestDir, file);
      await Deno.copyFile(src, dest);
    }),
  );

  let start = performance.now();
  const toResolve: Map<string, Set<string>> = new Map();
  await createGraph(
    Object.values(config.exports).map(
      (path) => pathToFileURL(join(packageDestDir, path)).href,
    ),
    {
      resolve(specifier, referrer) {
        if (!specifier.startsWith(jsrOrg)) return specifier;
        const existing = toResolve.get(referrer);
        if (!existing) {
          toResolve.set(referrer, new Set([specifier]));
        } else {
          existing.add(specifier);
        }

        return specifier;
      },
    },
  );

  const deps = new Set<string>();
  await Promise.all(
    toResolve.entries().map(async ([referrer, specifiers]) => {
      const referrerPath = fileURLToPath(referrer);
      let contents = await Deno.readTextFile(referrerPath);
      for (const specifier of specifiers) {
        const replaceWith = specifier.replace(jsrOrg, npmOrg);
        contents = contents.replaceAll(specifier, replaceWith);
        deps.add(replaceWith);
      }
      await Deno.writeTextFile(referrerPath, contents);
    }),
  );

  let end = performance.now();
  console.log(
    `%c[resolve] ${pkg} in %sms`,
    "color: blue; font-weight: thin",
    (end - start).toFixed(2),
  );

  for (const dep of deps) {
    const version = versionMap.get(dep);
    if (!version) {
      throw new Error(`No version found for dependency ${dep}`);
    }
    packageJSON.dependencies[dep] = `^${version}`;
  }

  packageJSON.exports = Object.fromEntries(
    Object.entries(config.exports).map(([key, value]) => {
      if (!value.endsWith(".ts")) return [key, value];
      const srcDir = basename(dirname(value));
      const destFile = value.replace(srcDir, DIST);
      const destSourceFile = destFile.replace(".ts", ".js");
      const destDtsFile = destFile.replace(".ts", ".d.ts");
      return [
        key,
        {
          import: {
            node: destSourceFile,
            import: value,
            types: destDtsFile,
          },
        },
      ];
    }),
  );

  await Deno.writeTextFile(
    join(packageDestDir, "package.json"),
    JSON.stringify(packageJSON, null, 2),
  );

  await new Deno.Command("npm", {
    cwd: packageDestDir,
    args: ["install"],
  }).output();

  start = performance.now();
  await build({
    input: Object.values(config.exports).map((path) =>
      join(packageDestDir, path)
    ),
    cwd: packageDestDir,
    external: Array.from(deps),
    output: {
      dir: DIST,
    },
    plugins: [dts()],
  });
  end = performance.now();
  console.log(
    `%c[build] ${pkg} in %sms`,
    "color: green;",
    (end - start).toFixed(2),
  );
}

import workspaceConfig from "../deno.json" with { type: "json" };

// Build a map of npm package name -> version from all workspace deno.json files
const versionMap = new Map<string, string>();
for (const pkg of workspaceConfig.workspace) {
  const cfg = JSON.parse(
    await Deno.readTextFile(join(cwd, pkg, "deno.json")),
  ) as { name?: string; version?: string };
  if (cfg.name && cfg.version) {
    const npmName = cfg.name.replace(jsrOrg, npmOrg);
    versionMap.set(npmName, cfg.version);
  }
}

const start = performance.now();
console.info(`%cCleaning ${destDir}`, "color: blue; font-weight: thin");
await Deno.remove(destDir, { recursive: true }).catch(() => {});
await Deno.mkdir(destDir, { recursive: true });
await Deno.writeTextFile(
  join(destDir, "package.json"),
  JSON.stringify(
    {
      name: `${npmOrg}/root`,
      private: true,
      workspaces: workspaceConfig.workspace.map((pkg) => basename(pkg)),
    },
    null,
    2,
  ),
);
await Promise.all(workspaceConfig.workspace.map(buildPackage));
const end = performance.now();
console.log(
  `%c[build] ${workspaceConfig.workspace.length} packages in %sms`,
  "color: green;",
  (end - start).toFixed(2),
);
