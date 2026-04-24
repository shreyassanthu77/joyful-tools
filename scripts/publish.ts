import { join } from "node:path";

import {
  loadVersionedWorkspacePackages,
  loadWorkspaceDependencyGraph,
  orderPackagesByDependencies,
  repoRoot,
  run,
} from "./packages.ts";

type DistPackage = {
  dir: string;
  name: string;
  version: string;
  internalDeps: string[];
};

async function publishJsr() {
  const workspacePackages = await loadVersionedWorkspacePackages();
  const packages = orderPackagesByDependencies(
    workspacePackages,
    await loadWorkspaceDependencyGraph(workspacePackages),
  );

  for (const pkg of packages) {
    if (await isJsrPublished(pkg.name, pkg.version)) {
      console.log(`%cSkipping JSR ${pkg.name}@${pkg.version}`, "color: gray;");
      continue;
    }

    console.log(`%cPublishing JSR ${pkg.name}@${pkg.version}`, "color: blue;");
    const result = await run(["deno", "publish", "--allow-dirty"], {
      cwd: join(repoRoot, pkg.dir),
    });

    if (result.code !== 0) {
      throw new Error(
        result.stderr || `Failed to publish ${pkg.name}@${pkg.version}`,
      );
    }
  }
}

const target = Deno.args[0] ?? "all";

if (target === "jsr") {
  await publishJsr();
} else if (target === "npm") {
  await publishNpm();
} else if (target === "all") {
  await publishJsr();
  await publishNpm();
} else {
  throw new Error(`Unknown publish target: ${target}`);
}

async function publishNpm() {
  const distDir = join(repoRoot, "dist");
  const distPackages = await loadDistPackages(distDir);
  const packages = orderPackagesByDependencies(
    distPackages,
    new Map(distPackages.map((pkg) => [pkg.name, new Set(pkg.internalDeps)])),
  );

  if (packages.length === 0) {
    console.log("No npm packages found in dist.");
    return;
  }

  for (const pkg of packages) {
    if (await isNpmPublished(pkg.name, pkg.version)) {
      console.log(`%cSkipping npm ${pkg.name}@${pkg.version}`, "color: gray;");
      continue;
    }

    console.log(`%cPublishing npm ${pkg.name}@${pkg.version}`, "color: blue;");
    const result = await run(["npm", "publish", "--access", "public"], {
      cwd: pkg.dir,
    });

    if (result.code !== 0) {
      throw new Error(
        result.stderr || `Failed to publish ${pkg.name}@${pkg.version}`,
      );
    }
  }
}

async function isNpmPublished(name: string, version: string): Promise<boolean> {
  const result = await run([
    "npm",
    "view",
    `${name}@${version}`,
    "version",
    "--json",
  ]);
  if (result.code === 0) return true;

  if (result.stderr.includes("E404") || result.stderr.includes("404")) {
    return false;
  }

  throw new Error(
    result.stderr || `Failed to check npm version for ${name}@${version}`,
  );
}

async function loadDistPackages(distDir: string): Promise<DistPackage[]> {
  const packages: DistPackage[] = [];

  for await (const entry of Deno.readDir(distDir)) {
    if (!entry.isDirectory) continue;

    const packageJsonPath = join(distDir, entry.name, "package.json");
    let packageJSON: {
      name?: string;
      version?: string;
      dependencies?: Record<string, string>;
    };
    try {
      packageJSON = JSON.parse(await Deno.readTextFile(packageJsonPath));
    } catch {
      continue;
    }

    if (!packageJSON.name || !packageJSON.version) continue;

    packages.push({
      dir: join(distDir, entry.name),
      name: packageJSON.name,
      version: packageJSON.version,
      internalDeps: Object.keys(packageJSON.dependencies ?? {}),
    });
  }

  const knownPackageNames = new Set(packages.map((pkg) => pkg.name));
  return packages.map((pkg) => ({
    ...pkg,
    internalDeps: pkg.internalDeps.filter((dep) => knownPackageNames.has(dep)),
  }));
}

async function isJsrPublished(name: string, version: string): Promise<boolean> {
  const response = await fetch(`https://jsr.io/${name}/${version}_meta.json`, {
    redirect: "manual",
  });
  if (response.status === 200) return true;
  if (response.status === 404) return false;
  throw new Error(
    `Failed to check JSR version for ${name}@${version}: ${response.status}`,
  );
}
