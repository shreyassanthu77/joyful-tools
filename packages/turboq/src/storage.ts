/** The Storage backend for Turboq */
export interface Storage {
  /** Returns an object from the storage backend or null if it doesn't exist */
  get(key: string): Promise<Object | null>;
  /** Tries to put an object into the storage backend
   * Returns true if the object was successfully comitted
   */
  putCAS(key: string, value: string, etag?: string): Promise<boolean>;
}

export type Object = {
  data: string;
  etag: string;
};
