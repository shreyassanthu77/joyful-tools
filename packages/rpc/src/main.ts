import type { StandardSchemaV1 } from "@standard-schema/spec";
import { AsyncLocalStorage } from "node:async_hooks";
import { Hono, type Context } from "hono";

export type RpcConfig<
  In extends StandardSchemaV1,
  Out extends StandardSchemaV1,
> = {
  in: In;
  out: Out;
  checkOutput?: boolean;
  handler: (
    input: StandardSchemaV1.InferOutput<In>,
  ) =>
    | StandardSchemaV1.InferOutput<Out>
    | Promise<StandardSchemaV1.InferOutput<Out>>;
};

abstract class RpcHandlerBase<
  In extends StandardSchemaV1,
  Out extends StandardSchemaV1,
> {
  constructor(public readonly config: RpcConfig<In, Out>) {}

  abstract fetch(request: Request): Promise<Response>;
}

export class Query<
  In extends StandardSchemaV1,
  Out extends StandardSchemaV1,
> extends RpcHandlerBase<In, Out> {
  override async fetch(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url);
    const entries = Object.fromEntries(searchParams);
    const validated = await this.config.in["~standard"].validate(entries);
    if (validated.issues) {
      return new Response(JSON.stringify(validated.issues), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    const output = await this.config.handler(validated.value);
    if (this.config.checkOutput) {
      const validatedOutput =
        await this.config.out["~standard"].validate(output);
      if (validatedOutput.issues) {
        console.error(`Output validation failed: ${validatedOutput.issues}`);
        return new Response("Internal Server Error", {
          status: 500,
        });
      }
    }

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }
}

export class Mutation<
  In extends StandardSchemaV1,
  Out extends StandardSchemaV1,
> extends RpcHandlerBase<In, Out> {
  override async fetch(request: Request): Promise<Response> {
    const contentType = request.headers.get("content-type");
    if (contentType !== "application/json") {
      return new Response("Unsupported Content-Type", {
        status: 415,
      });
    }

    const body = await request.text();
    try {
      const input = JSON.parse(body);

      const validated = await this.config.in["~standard"].validate(input);
      if (validated.issues) {
        return new Response(JSON.stringify(validated.issues), {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      const output = await this.config.handler(validated.value);

      if (this.config.checkOutput) {
        const validatedOutput =
          await this.config.out["~standard"].validate(output);
        if (validatedOutput.issues) {
          console.error(`Output validation failed: ${validatedOutput.issues}`);
          return new Response("Internal Server Error", {
            status: 500,
          });
        }
      }

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    } catch (e) {
      if (e instanceof SyntaxError) {
        return new Response("Invalid Input", {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        });
      }
      throw e;
    }
  }
}

export function query<
  In extends StandardSchemaV1,
  Out extends StandardSchemaV1,
>(config: RpcConfig<In, Out>): Query<In, Out> {
  return new Query(config);
}

export function mutation<
  In extends StandardSchemaV1,
  Out extends StandardSchemaV1,
>(config: RpcConfig<In, Out>): Mutation<In, Out> {
  return new Mutation(config);
}

const requestAls = new AsyncLocalStorage<Context>();

export function getRequestContext() {
  const ctx = requestAls.getStore();
  if (!ctx) {
    throw new Error(`getRequestContext() called outside of an RPC handler`);
  }
  return ctx;
}

// deno-lint-ignore no-explicit-any
export function rpc<H extends Record<string, RpcHandlerBase<any, any>>>(
  handlers: H,
): Hono {
  const hono = new Hono();
  hono.use((c, next) => requestAls.run(c, next));

  const routesSeen = new Set<string>();
  for (const [handlerKey, handler] of Object.entries(handlers)) {
    let name = handlerKey;
    let i = 0;
    while (routesSeen.has(name)) {
      name = handlerKey + `_${i++}`;
    }
    routesSeen.add(name);

    if (!(handler instanceof RpcHandlerBase)) {
      throw new Error("Invalid handler type");
    }

    const boundHandler = handler.fetch.bind(handler);

    if (handler instanceof Query) {
      hono.mount(name, boundHandler);
    } else if (handler instanceof Mutation) {
      hono.mount(name, boundHandler);
    } else {
      throw new Error("Invalid handler type");
    }
  }

  return hono;
}
