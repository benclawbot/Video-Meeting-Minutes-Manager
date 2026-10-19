import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = await readFile(path.join(root, "services/audioUploadPolicy.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(compiled.outputText, { exports });
const { getDirectUploadMime, DIRECT_UPLOAD_MAX_BYTES } = exports;

test("bypasses FFmpeg for compact supported recordings", () => {
  for (const [name, mime] of [
    ["meeting.MP4", "video/mp4"],
    ["meeting.m4a", "audio/mp4"],
    ["meeting.mp3", "audio/mpeg"],
    ["meeting.webm", "audio/webm"],
    ["meeting.wav", "audio/wav"],
    ["meeting.ogg", "audio/ogg"],
    ["meeting.flac", "audio/flac"],
  ]) {
    assert.equal(getDirectUploadMime({ name, size: 1234 }), mime);
  }
});

test("keeps big or unsupported recordings on the extraction path", () => {
  assert.equal(getDirectUploadMime({ name: "meeting.mp4", size: DIRECT_UPLOAD_MAX_BYTES }), "video/mp4");
  assert.equal(getDirectUploadMime({ name: "meeting.mp4", size: DIRECT_UPLOAD_MAX_BYTES + 1 }), null);
  assert.equal(getDirectUploadMime({ name: "meeting.wav", size: 0 }), null);
  assert.equal(getDirectUploadMime({ name: "meeting.mov", size: 100 }), null);
  assert.equal(getDirectUploadMime({ name: "meeting", size: 100 }), null);
});
