export * from "./storage/test_storage.ts";
export * from "./turboq.ts";
export type { EntryId, StorageObj, Storage } from "./types.ts";

import { Turboq } from "./turboq.ts";
import { TestStorage } from "./storage/test_storage.ts";

if (import.meta.main) {
  const storage = new TestStorage();
  const tq = new Turboq(storage);

  const res = await Promise.allSettled([
    tq.push("hello", {
      availableAt: Date.now() + 2000,
    }),
    tq.pop(),
  ]);
  console.log(res);
}
