import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

test("production server serves the React app, deep links and built assets", async (t) => {
  const expectedHtml = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());

  const port = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Production server startup timeout: " + output)), 5000);
    child.stdout.on("data", (data) => {
      output += data;
      const match = output.match(/Server listening on port (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.stderr.on("data", (data) => { output += data; });
    child.once("error", (err) => { clearTimeout(timer); reject(err); });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Production server exited ${code}: ${output}`));
    });
  });

  const origin = `http://127.0.0.1:${port}`;
  for (const path of ["/", "/game", "/game?lobby=production-check", "/another/path"]) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(await response.text(), expectedHtml, path);
  }

  const assetPath = expectedHtml.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(assetPath, "The built HTML must reference a JavaScript asset");
  const assetResponse = await fetch(origin + assetPath, { signal: AbortSignal.timeout(3000) });
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get("content-type"), /javascript/);
  assert.equal(await assetResponse.text(), await readFile(new URL("../dist" + assetPath, import.meta.url), "utf8"));
});
