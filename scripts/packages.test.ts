import { assertEquals, assertThrows } from "std/assert";

import {
  collectTransitiveDependents,
  orderPackagesByDependencies,
} from "./packages.ts";

Deno.test("orderPackagesByDependencies sorts dependencies before dependents", () => {
  const packages = [
    { name: "@joypack/whatsapp" },
    { name: "@joyful/fetch" },
    { name: "@joyful/result" },
  ];
  const depsByPackage = new Map<string, ReadonlySet<string>>([
    ["@joyful/result", new Set()],
    ["@joyful/fetch", new Set(["@joyful/result"])],
    ["@joypack/whatsapp", new Set(["@joyful/fetch", "@joyful/result"])],
  ]);

  const ordered = orderPackagesByDependencies(packages, depsByPackage);

  assertEquals(ordered.map((pkg) => pkg.name), [
    "@joyful/result",
    "@joyful/fetch",
    "@joypack/whatsapp",
  ]);
});

Deno.test("orderPackagesByDependencies throws on dependency cycles", () => {
  const packages = [{ name: "a" }, { name: "b" }];
  const depsByPackage = new Map<string, ReadonlySet<string>>([
    ["a", new Set(["b"])],
    ["b", new Set(["a"])],
  ]);

  assertThrows(
    () => orderPackagesByDependencies(packages, depsByPackage),
    Error,
    "Workspace package cycle detected",
  );
});

Deno.test("orderPackagesByDependencies ignores dependencies outside the subset", () => {
  const packages = [{ name: "@joypack/whatsapp" }];
  const depsByPackage = new Map<string, ReadonlySet<string>>([
    ["@joyful/result", new Set()],
    ["@joyful/fetch", new Set(["@joyful/result"])],
    ["@joypack/whatsapp", new Set(["@joyful/fetch", "@joyful/result"])],
  ]);

  const ordered = orderPackagesByDependencies(packages, depsByPackage);

  assertEquals(ordered.map((pkg) => pkg.name), ["@joypack/whatsapp"]);
});

Deno.test("collectTransitiveDependents returns the full downstream closure", () => {
  const depsByPackage = new Map<string, ReadonlySet<string>>([
    ["@joyful/result", new Set()],
    ["@joyful/fetch", new Set(["@joyful/result"])],
    ["@joypack/whatsapp", new Set(["@joyful/fetch"])],
    ["@joyful/pipe", new Set()],
  ]);

  assertEquals(
    [...collectTransitiveDependents(["@joyful/result"], depsByPackage)].sort(),
    ["@joyful/fetch", "@joypack/whatsapp"].sort(),
  );
});
