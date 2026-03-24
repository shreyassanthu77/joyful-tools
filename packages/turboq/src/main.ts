export * from "./storage/test_storage.ts";
export * from "./turboq.ts";
export type { EntryId, StorageObj, Storage } from "./types.ts";

import { Turboq } from "./turboq.ts";
import { TestStorage } from "./storage/test_storage.ts";

if (import.meta.main) {
  const storage = new TestStorage();
  const tq = new Turboq(storage);

  tq.addEventListener("done", (e) => {
    console.log("done", e.detail);
  });

  tq.addEventListener("dead", (e) => {
    console.log("dead", e.detail);
  });

  await Promise.all([
    tq.push("hello"),
    tq.push("world"),
    tq.push("!"),
    tq.push("!"),
  ]);

  await Promise.all([
    (async () => {
      const hello = await tq.pop();
      console.log("hello", hello);
      tq.ack(hello.id);
    })(),
    (async () => {
      const world = await tq.pop();
      console.log("world", world);
      tq.nack(world.id, "world failed");
    })(),
    (async () => {
      const bang = await tq.pop();
      console.log("bang", bang);
      tq.nack(bang.id, "bang failed", true);
    })(),
  ]);
}
