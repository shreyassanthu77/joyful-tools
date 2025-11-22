import type { PluginOption } from "vite";
import type { Node, Expression, ArrowFunctionExpression } from "estree";
import { walk } from "zimmerframe";
import * as astring from "astring";
import { Pattern } from "estree";

/**
 * Vite plugin for optimizing pipe function calls at build time.
 *
 * This module provides a Vite plugin that transforms `pipe` function calls into
 * nested function calls during the build process. This eliminates the runtime
 * overhead of the pipe function itself while maintaining the same functionality.
 *
 * The plugin automatically detects pipe imports and transforms calls like:
 * ```typescript
 * pipe(value, fn1, fn2, fn3)
 * ```
 *
 * Into optimized nested calls:
 * ```typescript
 * fn3(fn2(fn1(value)))
 * ```
 *
 * @example
 * ```typescript
 * import { pipePlugin } from "@joyful/pipe-plugin";
 *
 * export default {
 *   plugins: [pipePlugin()]
 * }
 * ```
 *
 * @module vite
 */

/**
 * Configuration options for the pipe plugin.
 */
export type PipeOptions = {
  /** The import path for `@joyful/pipe`. Use this if you import this package from a different path
   *
   * default: "@joyful/pipe"
   */
  importPath?: string;
};

/**
 * Vite plugin that transforms pipe function calls into nested function calls at build time.
 *
 * This plugin optimizes pipe calls by converting them from runtime function calls to
 * direct nested function calls, eliminating the overhead of the pipe function itself.
 *
 * @param options - Configuration options for the plugin
 * @returns A Vite plugin instance
 *
 * @example
 * ```typescript
 * import { pipePlugin } from '@joyful/pipe-plugin';
 *
 * export default {
 *   plugins: [pipePlugin()]
 * }
 * ```
 */
export function pipePlugin(options: PipeOptions = {}): PluginOption {
  const { importPath = "@joyful/pipe" } = options;

  const name = "vite-plugin-joyful-pipe";
  return {
    name,
    transform: {
      filter: {
        id: /\.(j|t)sx?$/,
      },
      handler(code) {
        const ast = this.parse(code);
        const imports = scanImports({ importPath, ast });

        const newAst = walk(ast as Node, null, {
          CallExpression({ callee, arguments: args }, { next, state }) {
            const calleeName = imports.fromNode(callee);
            next(state);
            if (calleeName !== "pipe") return;

            if (args.length < 2) return;
            for (const arg of args) {
              if (arg.type === "SpreadElement") return;
            }

            let res = args[0] as Expression;
            for (let i = 1; i < args.length; i++) {
              const arg = args[i] as Expression;
              if (arg.type === "ArrowFunctionExpression") {
                const inlined = tryInlineArrowFunctionExpression(arg, res);
                if (inlined) {
                  res = inlined;
                  continue;
                }
              }

              res = {
                type: "CallExpression",
                arguments: [res],
                callee: arg,
                optional: false,
              };
            }

            return res;
          },
        });

        const newCode = astring.generate(newAst, {});
        return { code: newCode };
      },
    },
  };
}

function tryInlineArrowFunctionExpression(
  arrorFn: ArrowFunctionExpression,
  data: Expression,
): Expression | null {
  const { body, params, expression, generator, async } = arrorFn;
  const isExpression = expression && body.type !== "BlockStatement";
  if (generator || async || !isExpression || params.length > 1) return null;

  if (params.length === 0) {
    return {
      type: "SequenceExpression",
      expressions: [data, body],
    };
  }
  let param: Expression;
  let paramName: string;
  switch (params[0].type) {
    case "Identifier":
      paramName = params[0].name;
      break;
    case "AssignmentPattern": {
      if (params[0].left.type !== "Identifier") return arrorFn;

      param = {
        type: "LogicalExpression",
        left: params[0].left,
        operator: "??",
        right: params[0].right,
      };
      paramName = params[0].left.name;
      break;
    }
    default:
      return null;
  }

  let useCount = 0;
  let shouldReturn = false;
  walk(body, null, {
    ArrowFunctionExpression(node, { next, state, stop }) {
      for (const arg of node.params) {
        // look for shadowing
        if (arg.type === "Identifier" && arg.name === paramName) {
          return;
        }
        let unwrappedArg: Pattern = arg;
        if (arg.type === "AssignmentPattern") {
          unwrappedArg = arg.left;
        }
        switch (unwrappedArg.type) {
          case "Identifier": {
            if (unwrappedArg.name === paramName) {
              continue;
            }
            break;
          }
          case "ArrayPattern": {
            for (const elem of unwrappedArg.elements) {
              if (!elem) continue;
            }
            break;
          }
          case "RestElement":
          case "ObjectPattern":
          case "MemberExpression":
          case "AssignmentPattern":
            shouldReturn = true;
            stop();
            return;
          default:
            throw "unreachable";
        }
      }
      next(state);
    },
    Identifier(node, { next, state, path }) {
      const parent = path[path.length - 1];

      const isMemberProperty =
        parent.type === "MemberExpression" &&
        parent.property === node &&
        !parent.computed;

      if (!isMemberProperty && node.name === paramName) {
        useCount++;
      }
    },
  });
}

interface GetImportsOptions {
  importPath: string;
  ast: Node;
}
function scanImports({ importPath, ast }: GetImportsOptions) {
  const namespaces: Set<string> = new Set();
  const regular: Map<string, string> = new Map();
  walk(ast as Node, null, {
    ImportDeclaration({ source }, { next, state }) {
      if (source.value === importPath) {
        next(state);
      }
    },
    ImportSpecifier({ imported, local }) {
      const importedName =
        imported.type === "Identifier"
          ? imported.name
          : (imported.value as string);
      regular.set(local.name, importedName);
    },
    ImportNamespaceSpecifier({ local }) {
      namespaces.add(local.name);
    },
  });
  return {
    has(name: string) {
      return regular.has(name) || namespaces.has(name);
    },
    get(name: string) {
      return regular.get(name) ?? (namespaces.has(name) ? name : undefined);
    },
    fromNode(node: Node) {
      switch (node.type) {
        case "Identifier":
          return regular.get(node.name);
        case "MemberExpression": {
          const { object, property } = node;
          if (object.type !== "Identifier" || !namespaces.has(object.name))
            return undefined;

          const propertyName =
            property.type === "Identifier"
              ? property.name
              : property.type === "Literal" &&
                  typeof property.value === "string"
                ? property.value
                : undefined;
          if (propertyName === undefined) return undefined;
          return propertyName;
        }
        default:
          return undefined;
      }
    },
  };
}
