export * from "./storage/test_storage.ts";
export * from "./storage.ts";
export * from "./turboq.ts";

import { Turboq } from "./turboq.ts";
import { TestStorage } from "./storage/test_storage.ts";

if (import.meta.main) {
  const storage = new TestStorage();
  const tq = new Turboq(storage);
  await Promise.all([
    tq.push("hello"),
    tq.push("world"),
    tq.push("!"),
    tq.push("!"),
  ]);

  await Promise.all([
    (async () => {
      const hello = await tq.pop();
      await tq.ack(hello.id);
    })(),
    (async () => {
      const world = await tq.pop();
      await tq.nack(world.id, "world failed");
    })(),
  ]);
}
