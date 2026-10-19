import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const guardsSource = await readFile(path.join(root, "api/transcribeGuards.ts"), "utf8");
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(transpile(guardsSource), sandbox);
const guards = sandbox.exports;

test("supports original Groq media types and rejects unsupported requests", () => {
  const allowed = [
    ["audio/wav", "wav"], ["audio/x-wav", "wav"],
    ["audio/wave; charset=binary", "wav"], ["video/mp4", "mp4"],
    ["audio/mp4", "m4a"], ["audio/mpeg", "mp3"],
    ["audio/webm", "webm"], ["audio/ogg", "ogg"], ["audio/flac", "flac"],
  ];
  for (const [type, format] of allowed) {
    const result = guards.validateAudioHeaders(type, undefined);
    assert.equal(result.ok, true);
    assert.equal(result.format, format);
  }
  for (const type of ["text/plain", undefined, "application/json", ["audio/wav"]]) {
    const result = guards.validateAudioHeaders(type, undefined);
    assert.equal(result.ok, false);
    assert.equal(result.status, 415);
  }
});

test("known and streamed payload sizes are bounded", () => {
  assert.equal(guards.validateAudioHeaders(
    "audio/wav", String(guards.MAX_AUDIO_BYTES + 1)).status, 413);
  assert.equal(guards.validateAudioHeaders("audio/wav", "nonsense").status, 400);
  assert.equal(guards.withinAudioLimit(guards.MAX_AUDIO_BYTES - 1, 1), true);
  assert.equal(guards.withinAudioLimit(guards.MAX_AUDIO_BYTES - 1, 2), false);
  assert.equal(guards.withinAudioLimit(-1, 2), false);
});

test("WAV RIFF header is checked before handing private bytes to Groq", () => {
  const valid = Uint8Array.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 65, 86, 69]);
  assert.equal(guards.isWav(valid), true);
  assert.equal(guards.isWav(valid.subarray(0, 8)), false);
  assert.equal(guards.isWav(Uint8Array.from([0, 0, 0, 0, 4, 0, 0, 0, 87, 65, 86, 69])), false);
});

test("detects real audio container signatures before forwarding to Groq", () => {
  const wav = Uint8Array.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 65, 86, 69]);
  const mp4 = Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
  assert.equal(guards.isSupportedAudio(wav, "wav"), true);
  assert.equal(guards.isSupportedAudio(mp4, "mp4"), true);
  assert.equal(guards.isSupportedAudio(mp4, "m4a"), true);
  assert.equal(guards.isSupportedAudio(Uint8Array.from([73, 68, 51]), "mp3"), true);
  assert.equal(guards.isSupportedAudio(Uint8Array.from([26, 69, 223, 163]), "webm"), true);
  assert.equal(guards.isSupportedAudio(Uint8Array.from([79, 103, 103, 83]), "ogg"), true);
  assert.equal(guards.isSupportedAudio(Uint8Array.from([102, 76, 97, 67]), "flac"), true);
  assert.equal(guards.isSupportedAudio(wav, "mp4"), false);
  assert.equal(guards.isSupportedAudio(mp4.subarray(0, 3), "m4a"), false);
});

test("upstream error text can never be embedded in public error payload", () => {
  assert.equal(guards.publicTranscriptionError(429).status, 429);
  assert.equal(guards.publicTranscriptionError(500).status, 502);
  assert.equal(guards.publicTranscriptionError(401).status, 502);
  assert.ok(!guards.publicTranscriptionError(500).error.includes("Bearer"));
});

const handlerSource = await readFile(path.join(root, "api/transcribe.ts"), "utf8");
const compiledHandler = transpile(handlerSource);
function prepareHandler(credentials, providerFetch) {
  const exported = {};
  vm.runInNewContext(compiledHandler, {
    exports: exported,
    require(name) {
      if (name === "@openai-oauth/react/server") return { openaiCredentials: credentials };
      if (name === "./transcribeGuards.js") return guards;
      throw new Error("Unexpected import: " + name);
    },
    Headers, Buffer, Blob, FormData, process: { env: { GROQ_API_KEY: "test-secret" } },
    fetch: providerFetch,
  });
  return exported.default;
}

function mockResponse() {
  return {
    statusCode: 0, body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("unauthenticated requests never read audio or contact transcription provider", async () => {
  let read = false, invoked = false;
  const handler = prepareHandler(() => { throw new Error("missing session"); },
    () => { invoked = true; throw new Error("unexpected provider call"); });
  const req = {
    method: "POST",
    headers: { "content-type": "audio/wav" },
    async *[Symbol.asyncIterator]() { read = true; yield Buffer.from("audio"); },
  };
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(read, false);
  assert.equal(invoked, false);
});

test("truncated or invalid audio uploads are rejected before remote requests", async () => {
  let invoked = false;
  const handler = prepareHandler(() => ({ accountId: "test" }),
    () => { invoked = true; throw Error("must not send"); });
  const req = {
    method: "POST",
    headers: { "content-type": "audio/wav" },
    async *[Symbol.asyncIterator]() { yield Buffer.from("not a WAV"); },
  };
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(invoked, false);
});

test("provider failure bodies are never echoed to authenticated browser", async () => {
  const secret = "PRIVATE_PROVIDER_ERROR_WITH_KEY_AND_TRANSCRIPT";
  let calls = 0;
  const handler = prepareHandler(() => ({ accountId: "test" }), async () => {
    calls++;
    return { ok: false, status: 500, text: async () => secret };
  });
  const req = {
    method: "POST",
    headers: { "content-type": "audio/wav" },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 65, 86, 69]);
    },
  };
  const res = mockResponse();
  await handler(req, res);
  assert.equal(calls, 1);
  assert.equal(res.statusCode, 502);
  assert.ok(!JSON.stringify(res.body).includes(secret));
});


test("small MP4 recording can be forwarded directly without WAV conversion", async () => {
  let outbound;
  const handler = prepareHandler(() => ({ accountId: "test" }), async (_url, options) => {
    outbound = options;
    return { ok: true, json: async () => ({ text: "Meeting notes" }) };
  });
  const req = {
    method: "POST",
    headers: { "content-type": "video/mp4" },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
    },
  };
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.text, "Meeting notes");
  assert.ok(outbound);
  assert.equal(outbound.body.get("model"), "whisper-large-v3");
  assert.equal(outbound.body.get("file").name, "recording.mp4");
  assert.equal(outbound.body.get("file").type, "video/mp4");
});
