import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

for (const route of ["transcribe", "analyze"]) {
  test(`/${route} serverless route uses Node ESM-compatible relative imports`, async () => {
    const source = await readFile(path.join(root, "api", `${route}.ts`), "utf8");
    const relativeImports = Array.from(
      source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g),
      (match) => match[1],
    );
    assert.ok(relativeImports.length > 0, "Expected at least one relative import");
    for (const specifier of relativeImports) {
      assert.match(specifier, /\.js$/, `Extensionless ESM import: ${specifier}`);
    }
  });
}
