/**
 * Interactive version bump script.
 *
 * 1. Checks that the working directory is clean
 * 2. Asks which package to bump and bump type (major/minor/patch)
 * 3. Runs tests
 * 4. Updates deno.json
 * 5. Commits the version bump
 * 6. Creates a git tag and pushes it
 *
 * Usage: deno task bump
 */

import { join } from "std/path";

const root = new URL("../", import.meta.url).pathname;

async function run(
  cmd: string[],
  opts?: { cwd?: string; quiet?: boolean },
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: opts?.cwd ?? root,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const { code, stdout, stderr } = await proc.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout).trim(),
    stderr: new TextDecoder().decode(stderr).trim(),
  };
}

// 1. Check working directory is clean
console.log("Checking working directory...");
const status = await run(["git", "status", "--porcelain"]);
if (status.stdout !== "") {
  console.error(
    "\nWorking directory is not clean. Commit or stash changes first.\n",
  );
  console.error(status.stdout);
  Deno.exit(1);
}
console.log("Working directory is clean.\n");

const workspaceConfig = JSON.parse(
  await Deno.readTextFile(join(root, "deno.json")),
);
const workspaces: string[] = workspaceConfig.workspace;

type Package = {
  dir: string;
  name: string;
  version: string;
  denoJsonPath: string;
};

// Gather all packages with versions
const packages: Package[] = [];
for (const dir of workspaces) {
  const denoJsonPath = join(root, dir, "deno.json");

  let denoJson: { name?: string; version?: string };
  try {
    denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath));
  } catch {
    continue;
  }

  if (!denoJson.version || !denoJson.name) continue;

  packages.push({
    dir,
    name: denoJson.name,
    version: denoJson.version,
    denoJsonPath,
  });
}

if (packages.length === 0) {
  console.error("No packages found.");
  Deno.exit(1);
}

// Ask which package to bump
console.log("\nWhich package to bump?\n");
for (let i = 0; i < packages.length; i++) {
  console.log(`  ${i + 1}) ${packages[i].name} (${packages[i].version})`);
}
console.log(`  ${packages.length + 1}) All packages`);

const pkgChoice = prompt(`\nChoice [1-${packages.length + 1}]:`);
const pkgIndices = pkgChoice
  .split(/\s*,\s*/)
  .map((s) => parseInt(s, 10))
  .filter((i) => !isNaN(i) && i > 0 && i <= packages.length + 1);

const toBump = pkgIndices.some((i) => i === packages.length + 1)
  ? packages
  : pkgIndices.map((i) => packages[i - 1]);

// Ask bump type
console.log("\nBump type?\n");
console.log("  1) patch");
console.log("  2) minor");
console.log("  3) major");

const bumpChoice = prompt("\nChoice [1-3]:");
const bumpType = (["patch", "minor", "major"] as const)[
  parseInt(bumpChoice ?? "", 10) - 1
];

if (!bumpType) {
  console.error("Invalid choice.");
  Deno.exit(1);
}

function bump(version: string, type: "major" | "minor" | "patch"): string {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

// 2. Run tests before bumping
console.log("Running tests...\n");
const test = await run(["deno", "task", "test"]);
if (test.code !== 0) {
  console.error("\nTests failed. Fix them before bumping.\n");
  if (test.stdout) console.error(test.stdout);
  if (test.stderr) console.error(test.stderr);
  Deno.exit(1);
}
console.log("All tests passed.\n");

// 3. Apply bumps
const bumped: { name: string; from: string; to: string }[] = [];
for (const pkg of toBump) {
  const newVersion = bump(pkg.version, bumpType);

  // Update deno.json
  const denoJson = JSON.parse(await Deno.readTextFile(pkg.denoJsonPath));
  denoJson.version = newVersion;
  await Deno.writeTextFile(
    pkg.denoJsonPath,
    JSON.stringify(denoJson, null, 2) + "\n",
  );

  console.log(`${pkg.name}: ${pkg.version} -> ${newVersion}`);
  bumped.push({ name: pkg.name, from: pkg.version, to: newVersion });
}

// 4. Commit the version bump
const commitLines = bumped.map((b) => `${b.name}@${b.to}`);
const commitMsg =
  bumped.length === 1
    ? `bump ${commitLines[0]}`
    : `bump ${commitLines.join(", ")}`;

await run(["git", "add", "-A"]);
const commit = await run(["git", "commit", "-m", commitMsg]);
if (commit.code !== 0) {
  console.error("\nFailed to commit.\n");
  if (commit.stderr) console.error(commit.stderr);
  Deno.exit(1);
}
console.log(`\nCommitted: ${commitMsg}`);

// 5. Create git tag and push
const sha = await run(["git", "rev-parse", "--short", "HEAD"]);
const tagName = `release-${sha.stdout}`;

const tag = await run(["git", "tag", tagName]);
if (tag.code !== 0) {
  console.error(`\nFailed to create tag ${tagName}.\n`);
  if (tag.stderr) console.error(tag.stderr);
  Deno.exit(1);
}
console.log(`Tagged: ${tagName}`);

const push = await run(["git", "push", "--atomic", "origin", "HEAD", tagName]);
if (push.code !== 0) {
  console.error("\nFailed to push.\n");
  if (push.stderr) console.error(push.stderr);
  Deno.exit(1);
}
console.log("Pushed commit and tag.");

console.log("\nDone!");
