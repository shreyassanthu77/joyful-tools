import type { PluginOption } from "vite";
import type { Node, Expression } from "estree";
import { walk } from "zimmerframe";
import * as astring from "astring";

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
 * import { pipePlugin } from '@joyful/pipe/vite';
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

        const simpleAliases: string[] = [];
        const namespacedAliases: string[] = [];
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
            if (importedName !== "pipe") return;
            simpleAliases.push(local.name);
          },
          ImportNamespaceSpecifier({ local }) {
            if (namespacedAliases.includes(local.name)) return;
            namespacedAliases.push(local.name);
          },
        });

        if (simpleAliases.length === 0 && namespacedAliases.length === 0)
          return;

        const newAst = walk(ast as Node, null, {
          CallExpression({ callee, arguments: args }, { next, state }) {
            let isPipeCall = false;
            switch (callee.type) {
              case "Identifier":
                if (!simpleAliases.includes(callee.name)) break;
                isPipeCall = true;
                break;
              case "MemberExpression": {
                const { object, property } = callee;
                if (
                  object.type !== "Identifier" ||
                  !namespacedAliases.includes(object.name)
                )
                  break;

                const propertyName =
                  property.type === "Identifier"
                    ? property.name
                    : property.type === "Literal"
                      ? property.value
                      : "";
                if (propertyName !== "pipe") break;
                isPipeCall = true;
                break;
              }
              default:
                break;
            }
            next(state);
            if (!isPipeCall) return;

            if (args.length < 2) return;
            for (const arg of args) {
              if (arg.type === "SpreadElement") return;
            }

            let res: Expression = args[0] as Expression;
            for (let i = 1; i < args.length; i++) {
              const arg = args[i] as Expression;
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
