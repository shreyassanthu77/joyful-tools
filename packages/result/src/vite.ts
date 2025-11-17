import type { PluginOption } from "vite";
import type { Node, Expression } from "estree";
import { walk } from "zimmerframe";
import * as astring from "astring";

export type ResultOptions = {
  importPath?: string;
};

export function resultPlugin(options: ResultOptions = {}): PluginOption {
  const { importPath = "@joyful/result" } = options;

  const name = "vite-plugin-joyful-result";
  return {
    name,
    transform: {
      filter: {
        id: /\.(j|t)sx?$/,
      },
      handler(code) {
        // const ast = this.parse(code);
        //
        // const simpleAliases: string[] = [];
        // const namespacedAliases: string[] = [];
        // walk(ast as Node, null, {
        //   ImportDeclaration({ source }, { next, state }) {
        //     if (source.value === importPath) {
        //       next(state);
        //     }
        //   },
        //   ImportSpecifier({ imported, local }) {
        //     const importedName =
        //       imported.type === "Identifier"
        //         ? imported.name
        //         : (imported.value as string);
        //     if (importedName !== "pipe") return;
        //     simpleAliases.push(local.name);
        //   },
        //   ImportNamespaceSpecifier({ local }) {
        //     if (namespacedAliases.includes(local.name)) return;
        //     namespacedAliases.push(local.name);
        //   },
        // });
        //
        // if (simpleAliases.length === 0 && namespacedAliases.length === 0)
        //   return;
        // TODO
        // const newAst = walk(ast as Node, null, {
        //   CallExpression({ callee, arguments: args }, { next, state }) {
        //     let isResultCall = false;
        //     switch (callee.type) {
        //       case "Identifier":
        //         if (!simpleAliases.includes(callee.name)) break;
        //         isResultCall = true;
        //         break;
        //       case "MemberExpression": {
        //         const { object, property } = callee;
        //         if (
        //           object.type !== "Identifier" ||
        //           !namespacedAliases.includes(object.name)
        //         )
        //           break;
        //
        //         const propertyName =
        //           property.type === "Identifier"
        //             ? property.name
        //             : property.type === "Literal"
        //               ? property.value
        //               : "";
        //         if (propertyName !== "pipe") break;
        //         isResultCall = true;
        //         break;
        //       }
        //       default:
        //         break;
        //     }
        //     next(state);
        //     if (!isResultCall) return;
        //   },
        // });
        //
        // const newCode = astring.generate(newAst, {});
        // return { code: newCode };
      },
    },
  };
}
