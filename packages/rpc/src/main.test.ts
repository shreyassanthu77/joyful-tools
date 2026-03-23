import { query, rpc } from "@joyful/rpc";
import { type } from "arktype";

const handler = rpc({
  hello: query({
    in: type({ name: "string" }),
    out: type("string"),
    handler({ name }) {
      return `Hello, ${name}!`;
    },
  }),
});

console.log(handler.routes);

export default handler;
