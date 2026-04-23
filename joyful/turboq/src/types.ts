/** The Storage backend for Turboq */
export interface Storage {
  /** Returns an object from the storage backend or null if it doesn't exist */
  get(key: string): Promise<StorageObj | null>;
  /** Tries to put an object into the storage backend.
   * Returns the new etag if successful, null if conflict.
   * If no etag is provided, this is treated as a create operation.
   */
  putCAS(key: string, value: string, etag?: string): Promise<string | null>;
}

export type StorageObj = {
  data: string;
  etag: string;
};

export type EntryId = number & { readonly __entryId: unique symbol };

// @ts-ignore this some crazy typescript madness dw about it
export declare class TypedEventTarget<M extends Record<string, Event>> {}
// @ts-ignore this some crazy typescript madness dw about it
export const TypedEventTarget = EventTarget;
export interface TypedEventTarget<M extends Record<string, Event>>
  extends EventTarget {
  addEventListener<K extends keyof M>(
    type: K,
    // deno-lint-ignore no-explicit-any
    listener: (this: TypedEventTarget<M>, ev: M[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  // The original string-based overloads are still available if needed
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<K extends keyof M>(
    type: K,
    // deno-lint-ignore no-explicit-any
    listener: (this: TypedEventTarget<M>, ev: M[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void;

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}
