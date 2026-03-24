export * from "./storage/test_storage.ts";
export * from "./storage.ts";
export * from "./turboq.ts";

import { Turboq } from "./turboq.ts";
import { TestStorage } from "./storage/test_storage.ts";

if (import.meta.main) {
  const storage = new TestStorage();
  const tq = new Turboq(storage);

  tq.addEventListener("done", (e) => {
    console.log("done", e.detail);
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
      tq.ack(hello.id);
    })(),
    (async () => {
      const world = await tq.pop();
      tq.nack(world.id, "world failed");
    })(),
    (async () => {
      const bang = await tq.pop();
      tq.ack(bang.id);
    })(),
  ]);
}
