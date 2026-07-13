import { createServer as createHttpServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_PORT = 6199;

function projectRoot(rootDir) {
  const supplied = rootDir ?? fileURLToPath(new URL("..", import.meta.url));
  const path = supplied instanceof URL ? fileURLToPath(supplied) : String(supplied);
  // Round-tripping through URL helpers keeps this safe when the checkout path
  // contains spaces or other URL-significant characters.
  return fileURLToPath(pathToFileURL(resolve(path)));
}

function routePath(reqUrl) {
  if (typeof reqUrl !== "string" || reqUrl.length === 0) return null;

  // Reject malformed escapes anywhere in the request target, including its
  // query string, before selecting an allowlisted file.
  try {
    decodeURIComponent(reqUrl);
  } catch {
    return null;
  }

  // Do not use new URL() here: it normalizes /../ before we can reject it.
  const rawPath = reqUrl.split(/[?#]/, 1)[0];
  if (!rawPath.startsWith("/") || rawPath.includes("\\") || rawPath.includes("\0")) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  // The public surface is intentionally exact; encoded aliases are not
  // alternate spellings of an allowlisted route.
  if (decoded !== rawPath) return null;
  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("\0")) return null;

  const segments = decoded.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  return decoded;
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

/**
 * Create the Checkpoint static server without binding a socket.
 *
 * Only the app shell and its three source assets are routable. The returned
 * server can be used by tests (`listen(0)`) or by the executable entrypoint.
 */
export function createRequestHandler(options = {}) {
  const rootDir = projectRoot(options.rootDir ?? options.root);
  const routes = new Map([
    ["/", "index.html"],
    ["/index.html", "index.html"],
    ["/src/styles.css", join("src", "styles.css")],
    ["/src/ui.js", join("src", "ui.js")],
    ["/src/game.js", join("src", "game.js")],
  ]);

  return (req, res) => {
    const method = req.method?.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD", "Content-Length": "0" });
      res.end();
      return;
    }

    const pathname = routePath(req.url);
    const relativePath = pathname ? routes.get(pathname) : undefined;
    if (!relativePath) {
      res.writeHead(404, { "Content-Length": "0" });
      res.end();
      return;
    }

    const filePath = join(rootDir, relativePath);
    let body;
    try {
      // statSync/readFileSync are restricted to the allowlisted path above.
      if (!statSync(filePath).isFile()) throw new Error("not a regular file");
      body = readFileSync(filePath);
    } catch {
      res.writeHead(404, { "Content-Length": "0" });
      res.end();
      return;
    }

    const extension = relativePath.slice(relativePath.lastIndexOf("."));
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Content-Length": body.byteLength,
      "Cache-Control": "no-store",
    });
    if (method === "HEAD") res.end();
    else res.end(body);
  };
}

export function createStaticServer(options = {}) {
  return createHttpServer(createRequestHandler(options));
}

export const createServer = createStaticServer;
export default createStaticServer;

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
  const port = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65_535 ? parsedPort : DEFAULT_PORT;
  const server = createStaticServer();
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    console.log(`Checkpoint server listening at http://127.0.0.1:${boundPort}`);
  });
}
