import type { Object, Storage } from "../storage.ts";

export class TestStorage implements Storage {
  data: Record<
    string,
    {
      generation: number;
      value: string;
    }
  > = {};

  get(key: string): Promise<Object | null> {
    const obj = this.data[key];
    if (!obj) return Promise.resolve(null);
    return Promise.resolve({
      data: obj.value,
      etag: obj.generation.toString(),
    });
  }

  putCAS(key: string, value: string, etag?: string): Promise<boolean> {
    const obj = this.data[key];
    let success = false;
    if (!obj) {
      this.data[key] = { generation: 0, value };
      success = true;
    } else if (obj.generation.toString() === etag) {
      success = true;
      obj.generation++;
      obj.value = value;
    }
    console.log("[putCAS] key:", key, "success:", success, "data:", value);
    return Promise.resolve(success);
  }
}
