import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  packageDirname: string;
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
      packageDirname: basename(dir),
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
