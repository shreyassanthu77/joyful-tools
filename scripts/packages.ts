import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { createGraph } from "@deno/graph";

import publishConfig from "../publish.config.json" with { type: "json" };
import workspaceConfig from "../deno.json" with { type: "json" };

type RawPackageConfig = {
  name?: string;
  version?: string;
  license?: string;
  exports?: string | Record<string, string>;
  publish?: {
    include?: string[];
  };
  xPublish?: {
    npm?: {
      name?: string;
    };
  };
};

export type WorkspacePackage = {
  dir: string;
  configPath: string;
  distDirname: string;
  name?: string;
  version?: string;
  license?: string;
  exports: Record<string, string>;
  publishInclude: string[];
  npmName?: string;
};

export type VersionedWorkspacePackage = WorkspacePackage & {
  name: string;
  version: string;
  npmName: string;
};

export type BuildableWorkspacePackage = VersionedWorkspacePackage & {
  exports: Record<string, string>;
};

const workspaceDirs = workspaceConfig.workspace;
const npmScopes = publishConfig.npmScopes;

export const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export async function run(
  cmd: string[],
  opts?: { cwd?: string },
): Promise<{ code: number; stdout: string; stderr: string }> {
  const output = await new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: opts?.cwd ?? repoRoot,
    stdout: "piped",
    stderr: "piped",
  }).output();

  return {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout).trim(),
    stderr: new TextDecoder().decode(output.stderr).trim(),
  };
}

export async function loadWorkspacePackages(
  root = repoRoot,
): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];

  for (const dir of workspaceDirs) {
    const configPath = join(root, dir, "deno.json");
    const config = JSON.parse(
      await Deno.readTextFile(configPath),
    ) as RawPackageConfig;

    const exports = typeof config.exports === "string"
      ? { ".": config.exports }
      : (config.exports ?? {});
    const npmName = config.xPublish?.npm?.name ??
      (config.name
        ? config.name.replace(
          /^(@[^/]+)\/(.+)$/,
          (_, scope: string, packageName: string) =>
            `${npmScopes[scope] ?? scope}/${packageName}`,
        )
        : undefined);

    packages.push({
      dir,
      configPath,
      distDirname: toDistDirname(config.name ?? dir),
      name: config.name,
      version: config.version,
      license: config.license,
      exports,
      publishInclude: config.publish?.include ?? [],
      npmName,
    });
  }

  return packages;
}

export async function loadVersionedWorkspacePackages(
  root = repoRoot,
): Promise<VersionedWorkspacePackage[]> {
  return (await loadWorkspacePackages(root)).filter(
    (pkg): pkg is VersionedWorkspacePackage =>
      Boolean(pkg.name && pkg.version && pkg.npmName),
  );
}

export async function loadWorkspaceDependencyGraph(
  packages: readonly VersionedWorkspacePackage[],
  root = repoRoot,
): Promise<Map<string, Set<string>>> {
  const depsByPackage = new Map(
    packages.map((pkg) => [pkg.name, new Set<string>()]),
  );

  await Promise.all(
    packages.map(async (pkg) => {
      const entries = pkg.publishInclude
        .filter((file) => file.endsWith(".ts"))
        .map((file) => pathToFileURL(join(root, pkg.dir, file)).href);
      if (entries.length === 0) return;

      const deps = depsByPackage.get(pkg.name)!;
      await createGraph(entries, {
        resolve(specifier) {
          const resolved = resolveWorkspacePackageSpecifier(
            specifier,
            packages,
          );
          if (resolved && resolved.pkg.name !== pkg.name) {
            deps.add(resolved.pkg.name);
          }

          return specifier;
        },
      });
    }),
  );

  return depsByPackage;
}

export function orderPackagesByDependencies<T extends { name: string }>(
  packages: readonly T[],
  depsByPackage: ReadonlyMap<string, ReadonlySet<string>>,
): T[] {
  const packageMap = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const remainingDeps = new Map(
    packages.map((
      pkg,
    ) => [
      pkg.name,
      new Set(
        [...(depsByPackage.get(pkg.name) ?? [])].filter((dep) =>
          packageMap.has(dep)
        ),
      ),
    ]),
  );
  const dependents = new Map<string, Set<string>>();

  for (const [pkgName, deps] of depsByPackage) {
    if (!packageMap.has(pkgName)) continue;
    for (const dep of deps) {
      if (!packageMap.has(dep)) continue;
      const existing = dependents.get(dep) ?? new Set<string>();
      existing.add(pkgName);
      dependents.set(dep, existing);
    }
  }

  const ready = packages
    .filter((pkg) => (remainingDeps.get(pkg.name)?.size ?? 0) === 0)
    .map((pkg) => pkg.name);
  const ordered: T[] = [];

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

  const unresolved = packages
    .map((pkg) => pkg.name)
    .filter((name) => !ordered.some((pkg) => pkg.name === name));
  throw new Error(
    `Workspace package cycle detected: ${unresolved.join(", ")}`,
  );
}

export function collectTransitiveDependents(
  packageNames: Iterable<string>,
  depsByPackage: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  const selected = new Set(packageNames);
  const dependents = new Map<string, Set<string>>();

  for (const [pkgName, deps] of depsByPackage) {
    for (const dep of deps) {
      const existing = dependents.get(dep) ?? new Set<string>();
      existing.add(pkgName);
      dependents.set(dep, existing);
    }
  }

  const pending = [...selected];
  const collected = new Set<string>();

  while (pending.length > 0) {
    const name = pending.shift()!;
    for (const dependent of dependents.get(name) ?? []) {
      if (selected.has(dependent) || collected.has(dependent)) continue;
      collected.add(dependent);
      pending.push(dependent);
    }
  }

  return collected;
}

export function resolveWorkspacePackageSpecifier(
  specifier: string,
  packages: readonly VersionedWorkspacePackage[],
): { pkg: VersionedWorkspacePackage; npmSpecifier: string } | null {
  const matched = [...packages]
    .sort((a, b) => b.name.length - a.name.length)
    .find(
      (pkg) => specifier === pkg.name || specifier.startsWith(`${pkg.name}/`),
    );

  if (!matched) return null;

  return {
    pkg: matched,
    npmSpecifier: `${matched.npmName}${specifier.slice(matched.name.length)}`,
  };
}

function toDistDirname(nameOrDir: string): string {
  return nameOrDir
    .replace(/^@/, "")
    .replace(/[\\/]/g, "__");
}
