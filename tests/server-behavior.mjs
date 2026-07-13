import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testFile = fileURLToPath(import.meta.url);
const root = dirname(dirname(testFile));
const serverModule = await import(pathToFileURL(join(root, "scripts", "server.mjs")).href);
const handler = serverModule.createRequestHandler({ rootDir: pathToFileURL(root) });

function request(path, method = "GET") {
  const result = {
    status: null,
    headers: {},
    body: Buffer.alloc(0),
  };
  const response = {
    writeHead(status, headers = {}) {
      result.status = status;
      result.headers = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
      );
    },
    end(body) {
      result.body = body === undefined ? Buffer.alloc(0) : Buffer.from(body);
    },
  };
  handler({ url: path, method }, response);
  return result;
}

for (const route of ["/", "/index.html", "/src/styles.css", "/src/ui.js", "/src/game.js"]) {
  const response = request(route);
  assert.equal(response.status, 200, `${route} should be served`);
  const localPath = route === "/" ? join(root, "index.html") : join(root, route.slice(1));
  assert.deepEqual(response.body, readFileSync(localPath), `${route} body should match its file`);
  assert.equal(Number(response.headers["content-length"]), response.body.byteLength);
  assert.match(response.headers["content-type"], /^(text\/html|text\/css|text\/javascript)/);

  const head = request(route, "HEAD");
  assert.equal(head.status, 200, `${route} HEAD should be served`);
  assert.equal(Number(head.headers["content-length"]), response.body.byteLength);
  assert.equal(head.body.byteLength, 0, `${route} HEAD must not include a body`);
}

for (const route of [
  "/.git/HEAD",
  "/.git/config",
  "/.env",
  "/unknown",
  "/../index.html",
  "/%2e%2e/.git/HEAD",
  "/%2e%2findex.html",
  "/src/%zz",
  "/src\\ui.js",
  "/src/%00ui.js",
  "/src%2Fui.js",
]) {
  assert.notEqual(request(route).status, 200, `${route} must not expose a file`);
}

const query = request("/index.html?review=server-test");
assert.equal(query.status, 200, "allowlisted routes may include ordinary query strings");
assert.notEqual(request("/index.html?bad=%zz").status, 200, "malformed query escapes are rejected");

const post = request("/index.html", "POST");
assert.equal(post.status, 405);
assert.equal(post.headers.allow, "GET, HEAD");
assert.equal(post.body.byteLength, 0);

const unbound = serverModule.createStaticServer({ rootDir: root });
assert.equal(unbound.listening, false, "server construction must not bind implicitly");

console.log("Server behavior checks passed (socket-free request handler).");
