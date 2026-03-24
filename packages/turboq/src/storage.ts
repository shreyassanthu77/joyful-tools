/** The Storage backend for Turboq */
export interface Storage {
  /** Returns an object from the storage backend or null if it doesn't exist */
  get(key: string): Promise<StorageObj | null>;
  /** Tries to put an object into the storage backend.
   * Returns true if the object was successfully committed.
   * If no etag is provided, this is treated as a create operation.
   */
  putCAS(key: string, value: string, etag?: string): Promise<boolean>;
}

export type StorageObj = {
  data: string;
  etag: string;
};
