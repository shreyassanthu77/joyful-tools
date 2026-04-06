import { build, emptyDir } from "@deno/dnt";
import { join } from "jsr:@std/path";

const root = new URL("..", import.meta.url).pathname;
const outDir = join(root, "npm");

interface WorkspaceDep {
  /** The workspace package dir (e.g. "result") */
  dir: string;
  /** The npm package name to map to (e.g. "@joyful-tools/result") */
  npmName: string;
}

interface PackageConfig {
  /** Directory name under packages/ */
  dir: string;
  /** npm package name (under @joyful-tools scope) */
  npmName: string;
  /** Workspace dependencies that should be externalized as npm deps */
  workspaceDeps?: WorkspaceDep[];
  /** Skip dnt type-checking (e.g. when dnt's bundled TS can't handle certain features) */
  skipTypeCheck?: boolean;
}

/** Read deno.json for a package */
async function readDenoJson(
  dir: string,
): Promise<{ version: string; exports: string }> {
  const denoJson = JSON.parse(
    await Deno.readTextFile(join(root, "packages", dir, "deno.json")),
  );
  const exports = typeof denoJson.exports === "string"
    ? denoJson.exports
    : denoJson.exports["."];
  return { version: denoJson.version, exports };
}

/**
 * Link already-built packages into npm/node_modules so TypeScript can
 * resolve cross-package types during declaration emit.
 */
async function linkBuiltPackages(builtPkgs: string[]) {
  for (const dir of builtPkgs) {
    const builtPkgDir = join(outDir, dir);
    const pkgJson = JSON.parse(
      await Deno.readTextFile(join(builtPkgDir, "package.json")),
    );
    const npmName: string = pkgJson.name;
    const [scope, name] = npmName.split("/");
    const scopeDir = join(outDir, "node_modules", scope);
    const linkDir = join(scopeDir, name);

    await Deno.mkdir(scopeDir, { recursive: true });
    try {
      await Deno.remove(linkDir, { recursive: true });
    } catch { /* doesn't exist yet */ }
    await Deno.symlink(builtPkgDir, linkDir);
    console.log(`  Linked ${npmName} -> ${builtPkgDir}`);
  }
}

/** Build order matters: dependencies must be built first */
const packages: PackageConfig[] = [
  { dir: "pipe", npmName: "@joyful-tools/pipe" },
  {
    dir: "result",
    npmName: "@joyful-tools/result",
    // dnt's bundled TS can't handle 3-arg Iterable/AsyncIterable used in this package
    skipTypeCheck: true,
  },
  {
    dir: "fetch",
    npmName: "@joyful-tools/fetch",
    workspaceDeps: [{ dir: "result", npmName: "@joyful-tools/result" }],
  },
];

const builtSoFar: string[] = [];

for (const pkg of packages) {
  const { version } = await readDenoJson(pkg.dir);
  const pkgDir = join(root, "packages", pkg.dir);
  const pkgOutDir = join(outDir, pkg.dir);
  const configFileUrl = new URL(join(pkgDir, "deno.json"), "file://").href;

  console.log(`\n--- Building ${pkg.npmName}@${version} ---\n`);

  await emptyDir(pkgOutDir);

  // Link already-built packages so TS can resolve them during type checking
  if (pkg.workspaceDeps && builtSoFar.length > 0) {
    await linkBuiltPackages(builtSoFar);
  }

  // Build mappings and dependencies for workspace deps
  const mappings: Record<string, { name: string; version: string }> = {};
  const dependencies: Record<string, string> = {};

  if (pkg.workspaceDeps) {
    for (const dep of pkg.workspaceDeps) {
      const depInfo = await readDenoJson(dep.dir);
      const depEntryAbs = join(root, "packages", dep.dir, depInfo.exports);

      mappings[depEntryAbs] = {
        name: dep.npmName,
        version: `^${depInfo.version}`,
      };
      dependencies[dep.npmName] = `^${depInfo.version}`;
    }
  }

  await build({
    entryPoints: [join(pkgDir, "src/main.ts")],
    outDir: pkgOutDir,
    configFile: configFileUrl,
    rootTestDir: undefined,
    test: false,
    shims: {},
    scriptModule: false, // ESM only, no CJS
    skipNpmInstall: true,
    typeCheck: pkg.skipTypeCheck ? false : "both",
    filterDiagnostic(diagnostic) {
      // Suppress errors from dnt's TS that don't occur under Deno's TS.
      // These arise because dnt type-checks the OUTPUT where imports are
      // rewritten to npm names and dnt's bundled TS version is stricter.
      if (diagnostic.code === 2307) return false; // Cannot find module
      if (diagnostic.code === 2306) return false; // Not a module
      if (diagnostic.code === 2344) return false; // Type does not satisfy constraint
      if (diagnostic.code === 2536) return false; // Type cannot be used to index type
      return true;
    },
    declaration: "separate",
    compilerOptions: {
      lib: ["ESNext", "DOM"],
      skipLibCheck: true,
    },
    package: {
      name: pkg.npmName,
      version,
      license: "MIT",
      repository: {
        type: "git",
        url: "https://github.com/shreyassanthu77/joyful-tools.git",
        directory: `packages/${pkg.dir}`,
      },
      bugs: {
        url: "https://github.com/shreyassanthu77/joyful-tools/issues",
      },
      ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}),
    },
    mappings: Object.keys(mappings).length > 0 ? mappings : undefined,
    postBuild() {
      // Copy LICENSE and README into the output
      try {
        Deno.copyFileSync(join(pkgDir, "LICENSE"), join(pkgOutDir, "LICENSE"));
      } catch {
        try {
          Deno.copyFileSync(join(root, "LICENSE"), join(pkgOutDir, "LICENSE"));
        } catch { /* No LICENSE found */ }
      }
      try {
        Deno.copyFileSync(
          join(pkgDir, "README.md"),
          join(pkgOutDir, "README.md"),
        );
      } catch { /* No README */ }
    },
  });

  builtSoFar.push(pkg.dir);
  console.log(`Built ${pkg.npmName}@${version} -> ${pkgOutDir}`);
}

// Clean up the shared node_modules directory
try {
  await Deno.remove(join(outDir, "node_modules"), { recursive: true });
} catch { /* ignore */ }

console.log("\n--- All packages built successfully ---\n");
