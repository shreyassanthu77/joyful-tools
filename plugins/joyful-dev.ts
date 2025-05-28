import { type ViteDevServer } from "vite";

export function joyfulDev(vite: ViteDevServer) {
  return () => {
    vite.middlewares.use(async (req, res) => {
      const url = req.originalUrl;
      const { render } = await vite.ssrLoadModule("/src/entry.server.ts");
      const html = render();
      const transformedHtml = await vite.transformIndexHtml(url, html);

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      res.end(transformedHtml);
    });
  };
}
