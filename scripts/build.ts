import { dts } from "rolldown-plugin-dts";
import { build } from "rolldown";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGraph } from "@deno/graph";

import {
  type BuildableWorkspacePackage,
  loadWorkspacePackages,
  repoRoot,
  resolveWorkspacePackageSpecifier,
  type VersionedWorkspacePackage,
} from "./packages.ts";

const DIST = "dist";
const destDir = join(repoRoot, DIST);
const repo = "https://github.com/shreyassanthu77/joyful-tools";

const workspacePackages = (await loadWorkspacePackages()).filter(
  (pkg): pkg is BuildableWorkspacePackage =>
    Boolean(
      pkg.name &&
        pkg.version &&
        pkg.npmName &&
        Object.keys(pkg.exports).length > 0,
    ),
);
const versionMap = new Map(
  workspacePackages.map((pkg) => [pkg.npmName, pkg.version]),
);

const start = performance.now();
console.info(`%cCleaning ${destDir}`, "color: blue; font-weight: thin");
await Deno.remove(destDir, { recursive: true }).catch(() => {});
await Deno.mkdir(destDir, { recursive: true });
await Deno.writeTextFile(
  join(destDir, "package.json"),
  JSON.stringify(
    {
      name: "@joyful-tools/root",
      private: true,
      workspaces: workspacePackages.map((pkg) => pkg.distDirname),
    },
    null,
    2,
  ),
);
await Promise.all(
  workspacePackages.map((pkg) =>
    buildPackage(pkg, workspacePackages, versionMap)
  ),
);
const end = performance.now();
console.log(
  `%c[build] ${workspacePackages.length} packages in %sms`,
  "color: green;",
  (end - start).toFixed(2),
);

async function buildPackage(
  pkg: BuildableWorkspacePackage,
  packages: readonly VersionedWorkspacePackage[],
  versionMap: ReadonlyMap<string, string>,
) {
  console.log(`%cBuilding ${pkg.dir}`, "color: blue; font-weight: thin");
  const packageDestDir = join(destDir, pkg.distDirname);
  await Deno.mkdir(packageDestDir, { recursive: true });

  const packageJSON = {
    name: pkg.npmName,
    version: pkg.version,
    type: "module",
    license: pkg.license ?? "MIT",
    repository: {
      type: "git",
      url: `${repo}.git`,
      directory: pkg.dir,
    },
    bugs: {
      url: `${repo}/issues`,
    },
    dependencies: {} as Record<string, string>,
    exports: {} as Record<string, unknown>,
  };

  const dirs = new Set<string>(pkg.publishInclude.map((file) => dirname(file)));
  for (const dir of dirs) {
    if (dir === ".") continue;
    await Deno.mkdir(join(packageDestDir, dir), { recursive: true });
  }
  await Promise.all(
    pkg.publishInclude.map(async (file) => {
      const src = join(repoRoot, pkg.dir, file);
      const dest = join(packageDestDir, file);
      await Deno.copyFile(src, dest);
    }),
  );

  let start = performance.now();
  const toResolve = new Map<
    string,
    Map<string, { replacement: string; dependencyName: string }>
  >();
  await createGraph(
    Object.values(pkg.exports).map(
      (path) => pathToFileURL(join(packageDestDir, path)).href,
    ),
    {
      resolve(specifier, referrer) {
        const resolved = resolveWorkspacePackageSpecifier(specifier, packages);
        if (!resolved || resolved.pkg.name === pkg.name) return specifier;

        const existing = toResolve.get(referrer) ?? new Map();
        existing.set(specifier, {
          replacement: resolved.npmSpecifier,
          dependencyName: resolved.pkg.npmName,
        });
        toResolve.set(referrer, existing);

        return specifier;
      },
    },
  );

  const deps = new Set<string>();
  await Promise.all(
    [...toResolve.entries()].map(async ([referrer, specifiers]) => {
      const referrerPath = fileURLToPath(referrer);
      let contents = await Deno.readTextFile(referrerPath);
      for (const [specifier, rewrite] of specifiers) {
        contents = contents.replaceAll(specifier, rewrite.replacement);
        deps.add(rewrite.dependencyName);
      }
      await Deno.writeTextFile(referrerPath, contents);
    }),
  );

  let end = performance.now();
  console.log(
    `%c[resolve] ${pkg.dir} in %sms`,
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
    Object.entries(pkg.exports).map(([key, value]) => {
      return [key, toNpmExport(value)];
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
    input: Object.values(pkg.exports).map((path) => join(packageDestDir, path)),
    cwd: packageDestDir,
    external(source) {
      return [...deps].some((dep) =>
        source === dep || source.startsWith(`${dep}/`)
      );
    },
    output: {
      dir: DIST,
    },
    plugins: [dts()],
  });
  end = performance.now();
  console.log(
    `%c[build] ${pkg.dir} in %sms`,
    "color: green;",
    (end - start).toFixed(2),
  );
}

function toNpmExport(value: string): string | Record<string, unknown> {
  if (!value.endsWith(".ts")) return value;

  const distFile = toBuildArtifactPath(value);
  return {
    types: distFile.replace(/\.ts$/, ".d.ts"),
    import: {
      node: distFile.replace(/\.ts$/, ".js"),
      default: value,
    },
    default: value,
  };
}

function toBuildArtifactPath(sourcePath: string): string {
  if (!sourcePath.endsWith(".ts")) return sourcePath;
  if (sourcePath.startsWith("./src/")) {
    return sourcePath.replace("./src/", `./${DIST}/`);
  }
  return `./${DIST}/${sourcePath.replace(/^\.\//, "")}`;
}
