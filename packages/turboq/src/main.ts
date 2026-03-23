export * from "./storage/test_storage.ts";
export * from "./storage.ts";
export * from "./turboq.ts";

import { Turboq } from "./turboq.ts";
import { TestStorage } from "./storage/test_storage.ts";

if (import.meta.main) {
  const storage = new TestStorage();
  const tq = new Turboq(storage);
  const res = await Promise.all([
    tq.push("hello"),
    tq.push("world"),
    tq.push("!"),
    tq.push("!"),
    tq.pop(),
  ]);
  console.log(res);
}
