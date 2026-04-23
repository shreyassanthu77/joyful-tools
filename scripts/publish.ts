import { join } from "node:path";

import {
  loadWorkspacePackages,
  repoRoot,
  run,
  type VersionedWorkspacePackage,
} from "./packages.ts";

type DistPackage = {
  dir: string;
  name: string;
  version: string;
  internalDeps: string[];
};

async function publishJsr() {
  const packages = (await loadWorkspacePackages()).filter(
    (pkg): pkg is VersionedWorkspacePackage =>
      Boolean(pkg.name && pkg.version && pkg.npmName),
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
  const packages = orderPackages(await loadDistPackages(distDir));

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

function orderPackages(packages: DistPackage[]): DistPackage[] {
  const packageMap = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const remainingDeps = new Map(
    packages.map((pkg) => [pkg.name, new Set(pkg.internalDeps)]),
  );
  const dependents = new Map<string, Set<string>>();

  for (const pkg of packages) {
    for (const dep of pkg.internalDeps) {
      const existing = dependents.get(dep) ?? new Set<string>();
      existing.add(pkg.name);
      dependents.set(dep, existing);
    }
  }

  const ready = packages
    .filter((pkg) => pkg.internalDeps.length === 0)
    .map((pkg) => pkg.name);
  const ordered: DistPackage[] = [];

  while (ready.length > 0) {
    const name = ready.shift()!;
    const pkg = packageMap.get(name);
    if (!pkg) continue;

    ordered.push(pkg);

    for (const dependent of dependents.get(name) ?? []) {
      const deps = remainingDeps.get(dependent);
      if (!deps) continue;
      deps.delete(name);
      if (deps.size === 0) ready.push(dependent);
    }
  }

  if (ordered.length === packages.length) return ordered;

  const orderedNames = new Set(ordered.map((pkg) => pkg.name));
  return [
    ...ordered,
    ...packages.filter((pkg) => !orderedNames.has(pkg.name)),
  ];
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
