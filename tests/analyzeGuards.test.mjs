import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const typescript = await readFile(path.join(root, "api", "analyzeGuards.ts"), "utf8");
const compiled = ts.transpileModule(typescript, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const sandbox = { exports: {} };
vm.runInNewContext(compiled.outputText, sandbox);
const { validateAnalyzeBody, publicProviderError, MAX_TRANSCRIPT_CHARS } = sandbox.exports;

const valid = () => ({
  title: "Planning", date: "2026-10-13", transcript: "Meeting text",
  locale: "en",
});

test("rejects malformed or non-string transcripts without throwing", () => {
  for (const input of [null, [], {}, { ...valid(), transcript: 42 },
    { ...valid(), transcript: "  " }]) {
    const result = validateAnalyzeBody(input);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  }
});

test("limits unauthenticated transcript payload size", () => {
  const input = { ...valid(), transcript: "x".repeat(MAX_TRANSCRIPT_CHARS + 1) };
  const result = validateAnalyzeBody(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
});

test("requires bounded title and date strings", () => {
  for (const input of [
    { ...valid(), title: "x".repeat(161) },
    { ...valid(), title: 23 },
    { ...valid(), date: null },
    { ...valid(), date: "y".repeat(81) },
  ]) {
    const result = validateAnalyzeBody(input);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  }
});

test("normalizes title newlines but keeps multilingual source text intact", () => {
  const source = { ...valid(), title: "Planning\nInject", transcript: "李明 et Мария" };
  const parsed = validateAnalyzeBody(source);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.title, "Planning Inject");
  assert.equal(parsed.value.transcript, "李明 et Мария");
  assert.equal(parsed.value.locale, "en");
});

test("defaults unknown locales to French", () => {
  const parsed = validateAnalyzeBody({ ...valid(), locale: "other" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.locale, "fr");
});

test("never leaks provider-supplied error bodies, transcript or secrets", () => {
  const privateString = "secret-key or private transcript";
  for (const status of [401, 403, 429, 400, 502, 503]) {
    const result = publicProviderError({ status, message: privateString });
    assert.ok(!result.error.includes(privateString));
    assert.ok([401, 429, 502].includes(result.status));
  }
  const unexpected = publicProviderError(new Error(privateString));
  assert.equal(unexpected.status, 502);
  assert.ok(!unexpected.error.includes(privateString));
});
