import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface Backend<ID> {
  define(name: string): void | Promise<void>;
  enqueue(name: string, input: unknown): Promise<ID>;
}

type IDType<B extends Backend<unknown>> =
  B extends Backend<infer T> ? T : never;

export class MemoryBackend implements Backend<string> {
  #workflows = new Set<string>();

  define(name: string): void {
    if (this.#workflows.has(name)) {
      throw new Error(`Workflow ${name} already defined`);
    }
    this.#workflows.add(name);
  }

  enqueue(name: string, input: unknown): Promise<string> {
    throw new Error("Method not implemented.");
  }
}

export interface WorkflowOptions<ID> {
  backend: Backend<ID>;
}

export type WorkflowExecutor<T extends StandardSchemaV1, ID> = (
  input: StandardSchemaV1.InferInput<T>,
) => Promise<ID>;

export type WorkflowDefinationOptions<T extends StandardSchemaV1> = {
  name: string;
  input: T;
};

export class Workflow<Options extends WorkflowOptions<unknown>> {
  constructor(private options: Options) {}

  define<T extends StandardSchemaV1>(
    options: WorkflowDefinationOptions<T>,
  ): WorkflowExecutor<T, IDType<Options["backend"]>> {
    return (input) => {
      return this.options.backend.enqueue(options.name, input) as Promise<
        IDType<Options["backend"]>
      >;
    };
  }
}
