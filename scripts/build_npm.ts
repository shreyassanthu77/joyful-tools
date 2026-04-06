import { build, emptyDir } from "@deno/dnt";
import { join } from "jsr:@std/path";

const root = new URL("..", import.meta.url).pathname;
const outDir = join(root, "npm");

interface WorkspaceDep {
  /** The bare specifier as used in source (e.g. "@joyful/result") */
  specifier: string;
  /** The workspace package dir it resolves to */
  workspaceDir: string;
  /** The npm package name to map to */
  npmName: string;
}

interface PackageConfig {
  /** Directory name under packages/ */
  dir: string;
  /** npm package name (under @joyful-tools scope) */
  npmName: string;
  /** Workspace dependencies that need remapping */
  workspaceDeps?: WorkspaceDep[];
}

/** Read version from a package's deno.json */
async function readVersion(dir: string): Promise<string> {
  const denoJson = JSON.parse(
    await Deno.readTextFile(join(root, "packages", dir, "deno.json")),
  );
  return denoJson.version;
}

/** Read exports entry point from a package's deno.json */
async function readEntryPoint(dir: string): Promise<string> {
  const denoJson = JSON.parse(
    await Deno.readTextFile(join(root, "packages", dir, "deno.json")),
  );
  const exports = denoJson.exports;
  if (typeof exports === "string") return exports;
  return exports["."];
}

/** Build order matters: dependencies must be built first */
const packages: PackageConfig[] = [
  { dir: "pipe", npmName: "@joyful-tools/pipe" },
  { dir: "result", npmName: "@joyful-tools/result" },
  {
    dir: "fetch",
    npmName: "@joyful-tools/fetch",
    workspaceDeps: [
      {
        specifier: "@joyful/result",
        workspaceDir: "result",
        npmName: "@joyful-tools/result",
      },
    ],
  },
];

for (const pkg of packages) {
  const version = await readVersion(pkg.dir);
  const pkgDir = join(root, "packages", pkg.dir);
  const pkgOutDir = join(outDir, pkg.dir);

  console.log(`\n--- Building ${pkg.npmName}@${version} ---\n`);

  await emptyDir(pkgOutDir);

  // Build mappings and import map entries for workspace dependencies
  const mappings: Record<string, { name: string; version: string }> = {};
  const importMapImports: Record<string, string> = {};

  if (pkg.workspaceDeps) {
    for (const dep of pkg.workspaceDeps) {
      const depVersion = await readVersion(dep.workspaceDir);
      const depEntry = await readEntryPoint(dep.workspaceDir);
      const depEntryAbs = join(root, "packages", dep.workspaceDir, depEntry);

      // The import map maps the bare specifier to the actual file
      importMapImports[dep.specifier] = depEntryAbs;

      // dnt mappings: map the resolved file URL to the npm package
      mappings[depEntryAbs] = {
        name: dep.npmName,
        version: `^${depVersion}`,
      };
    }
  }

  // Create a temporary import map if there are workspace deps
  let importMapPath: string | undefined;
  if (Object.keys(importMapImports).length > 0) {
    importMapPath = join(outDir, `${pkg.dir}-importmap.json`);
    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({ imports: importMapImports }, null, 2),
    );
  }

  // Collect npm dependencies from mappings
  const dependencies: Record<string, string> = {};
  for (const mapping of Object.values(mappings)) {
    dependencies[mapping.name] = mapping.version;
  }

  await build({
    entryPoints: [join(pkgDir, "src/main.ts")],
    outDir: pkgOutDir,
    rootTestDir: undefined,
    test: false,
    shims: {},
    scriptModule: false, // ESM only, no CJS
    skipNpmInstall: true, // Dependencies may not be published yet during first run
    typeCheck: false, // JSR handles type checking; dnt's bundled TS may not support newest features
    declaration: "separate",
    compilerOptions: {
      lib: ["ESNext", "DOM", "ESNext.AsyncIterable", "ES2018.AsyncGenerator"],
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
    importMap: importMapPath,
    postBuild() {
      // Copy LICENSE and README into the output
      try {
        Deno.copyFileSync(join(pkgDir, "LICENSE"), join(pkgOutDir, "LICENSE"));
      } catch {
        // LICENSE might not exist, copy from root
        try {
          Deno.copyFileSync(join(root, "LICENSE"), join(pkgOutDir, "LICENSE"));
        } catch {
          // No LICENSE found anywhere
        }
      }
      try {
        Deno.copyFileSync(
          join(pkgDir, "README.md"),
          join(pkgOutDir, "README.md"),
        );
      } catch {
        // README might not exist, that's fine
      }
    },
  });

  // Clean up temporary import map
  if (importMapPath) {
    try {
      await Deno.remove(importMapPath);
    } catch {
      // ignore
    }
  }

  console.log(`Built ${pkg.npmName}@${version} -> ${pkgOutDir}`);
}

console.log("\n--- All packages built successfully ---\n");
