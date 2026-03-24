import type { StorageObj, Storage } from "../types.ts";
import { inspect } from "node:util";

export class TestStorage implements Storage {
  data: Record<
    string,
    {
      generation: number;
      value: string;
    }
  > = {};

  get(key: string): Promise<StorageObj | null> {
    const obj = this.data[key];
    if (!obj) return Promise.resolve(null);
    return Promise.resolve({
      data: obj.value,
      etag: obj.generation.toString(),
    });
  }

  putCAS(key: string, value: string, etag?: string): Promise<string | null> {
    const obj = this.data[key];
    let generation: string | null = null;
    if (!obj) {
      this.data[key] = { generation: 0, value };
      generation = "0";
    } else if (obj.generation.toString() === etag) {
      obj.generation++;
      obj.value = value;
      generation = obj.generation.toString();
    }
    console.log(
      "[putCAS]",
      key,
      inspect(JSON.parse(value), { depth: Infinity, colors: true }),
    );
    return Promise.resolve(generation);
  }
}
