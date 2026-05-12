import { Elysia, file } from "elysia";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createPublicStaticRouter(basePath: string = "/public") {
  const publicDir = join(__dirname, "../../public-dir");
  console.log(publicDir)
  const app = new Elysia({
    name: "public-static",
    prefix: basePath,
  });

  app.all("*", ({ path }) => {
    const relativePath = path.startsWith(basePath) ? path.slice(basePath.length) : path;
    const fullPath = join(publicDir, relativePath);

    if (!existsSync(fullPath)) {
      return new Response("Not Found", { status: 404 });
    }

    return file(fullPath);
  });

  return app;
}
