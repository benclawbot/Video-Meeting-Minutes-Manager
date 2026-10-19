import { FFmpeg, FFFSType, type FSNode } from "@ffmpeg/ffmpeg";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import { openaiAuthHeaders } from "@openai-oauth/react";
import { AnalysisResult } from "../types";
import { getDirectUploadMime } from "./audioUploadPolicy";

const TARGET_RATE = 16000;
const CHUNK_DURATION_SEC = 90;

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  if (!ffmpegLoadPromise) {
    ffmpegInstance = new FFmpeg();
    ffmpegLoadPromise = ffmpegInstance.load({ coreURL, wasmURL }).then(() => ffmpegInstance as FFmpeg);
  }

  return ffmpegLoadPromise;
};

const readTextFile = async (ffmpeg: FFmpeg, path: string): Promise<string> => {
  const data = await ffmpeg.readFile(path, "utf8");
  return typeof data === "string" ? data : new TextDecoder().decode(data);
};

const cleanupDir = async (ffmpeg: FFmpeg, dir: string): Promise<void> => {
  try {
    const entries = await ffmpeg.listDir(dir);
    await Promise.all(entries
      .filter(entry => entry.name !== "." && entry.name !== ".." && !entry.isDir)
      .map(entry => ffmpeg.deleteFile(`${dir}/${entry.name}`).catch(() => false)));
    await ffmpeg.deleteDir(dir);
  } catch {
    // Best-effort cleanup in the in-memory ffmpeg filesystem.
  }
};

const prepareAudioChunks = async (
  mediaFile: File,
): Promise<{ chunks: FSNode[]; outputDir: string; audioSeconds: number; ffmpeg: FFmpeg }> => {
  const ffmpeg = await getFFmpeg();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputDir = `/input-${runId}`;
  const outputDir = `/output-${runId}`;
  const inputName = "recording";
  const inputPath = `${inputDir}/${inputName}`;
  const durationPath = `${outputDir}/duration.txt`;

  await ffmpeg.createDir(inputDir);
  await ffmpeg.createDir(outputDir);
  await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: inputName, data: mediaFile }] }, inputDir);

  try {
    await ffmpeg.ffprobe([
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
      "-o", durationPath,
    ]);

    const durationText = await readTextFile(ffmpeg, durationPath).catch(() => "0");
    const audioSeconds = Number.parseFloat(durationText) || 0;
    await ffmpeg.deleteFile(durationPath).catch(() => false);

    const exitCode = await ffmpeg.exec([
      "-i", inputPath,
      "-vn",
      "-map", "0:a:0",
      "-ac", "1",
      "-ar", String(TARGET_RATE),
      "-c:a", "pcm_s16le",
      "-f", "segment",
      "-segment_time", String(CHUNK_DURATION_SEC),
      "-reset_timestamps", "1",
      `${outputDir}/chunk_%03d.wav`,
    ]);

    if (exitCode !== 0) throw new Error(`FFmpeg returned exit code ${exitCode}.`);

    const chunks = (await ffmpeg.listDir(outputDir))
      .filter(entry => !entry.isDir && entry.name.endsWith(".wav"))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (chunks.length === 0) throw new Error("No audio chunks could be generated.");

    return { chunks, outputDir, audioSeconds, ffmpeg };
  } catch (err) {
    await cleanupDir(ffmpeg, outputDir);
    throw err;
  } finally {
    await ffmpeg.unmount(inputDir).catch(() => false);
    await ffmpeg.deleteDir(inputDir).catch(() => false);
  }
};

const readMediaDurationSeconds = (file: File): Promise<number> => new Promise(resolve => {
  const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
  const url = URL.createObjectURL(file);
  let settled = false;
  const finish = (duration: number) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    media.removeAttribute("src");
    URL.revokeObjectURL(url);
    resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
  };
  const timeout = setTimeout(() => finish(0), 3000);
  media.onloadedmetadata = () => finish(media.duration);
  media.onerror = () => finish(0);
  media.preload = "metadata";
  media.src = url;
});

/** Return a usable status even when Vercel responds with plain text/HTML on a crash. */
const transcribeAudio = async (audio: Blob, mime: string): Promise<string> => {
  try {
    const authHeaders = await openaiAuthHeaders({
      headers: { "Content-Type": mime },
    });
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: authHeaders,
      body: audio,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      const reason = typeof payload?.error === "string" && payload.error.trim()
        ? payload.error : "Service de transcription indisponible";
      throw new Error(`${reason} (HTTP ${res.status})`);
    }
    const data = await res.json() as { text?: string };
    return typeof data.text === "string" ? data.text.trim() : "";
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "inconnue";
    throw new Error("Erreur de transcription : " + message);
  }
};

export const analyzeMeetingVideo = async (
  mediaFile: File,
  title: string,
  date: string,
  locale: "fr" | "en" = "fr",
  onStatusChange?: (status: string) => void,
): Promise<AnalysisResult> => {
  const directMime = getDirectUploadMime(mediaFile);
  let transcript = "";
  let audioSeconds = 0;
  let segmentCount = 0;

  if (directMime) {
    // Groq accepts MP4/M4A/MP3/etc directly. Avoid loading browser FFmpeg for small recordings.
    if (onStatusChange) onStatusChange("UPLOADING");
    audioSeconds = await readMediaDurationSeconds(mediaFile);
    if (onStatusChange) onStatusChange("TRANSCRIBING");
    transcript = await transcribeAudio(mediaFile, directMime);
    segmentCount = 1;
  } else {
    // Vercel limits function request bodies to 4.5 MB. Chunk larger recordings locally.
    if (onStatusChange) onStatusChange("EXTRACTING_AUDIO");
    const prepared = await prepareAudioChunks(mediaFile);
    const { chunks, outputDir, ffmpeg } = prepared;
    audioSeconds = prepared.audioSeconds;
    segmentCount = chunks.length;
    if (onStatusChange) onStatusChange("UPLOADING");

    const transcriptionParts: string[] = [];
    try {
      for (const chunk of chunks) {
        if (onStatusChange) onStatusChange("TRANSCRIBING");
        const chunkPath = `${outputDir}/${chunk.name}`;
        const chunkData = await ffmpeg.readFile(chunkPath);
        await ffmpeg.deleteFile(chunkPath).catch(() => false);
        const text = await transcribeAudio(new Blob([chunkData], { type: "audio/wav" }), "audio/wav");
        if (text) transcriptionParts.push(text);
      }
    } finally {
      await cleanupDir(ffmpeg, outputDir);
    }
    transcript = transcriptionParts.join(" ");
  }

  if (!transcript.trim()) throw new Error("Aucun contenu audio detecte dans le fichier.");
  const totalCharCount = transcript.length;

  if (onStatusChange) onStatusChange("PROCESSING");

  let text = "";
  let apiUsage: { input_tokens?: number; output_tokens?: number } = {};
  try {
    const headers = await openaiAuthHeaders({
      headers: { "Content-Type": "application/json" },
    });
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers,
      body: JSON.stringify({ title, date, transcript, locale }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
      throw new Error(err.error || "Erreur de generation");
    }
    const data = await res.json() as { minutes?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    text = data.minutes || "";
    apiUsage = data.usage || {};
  } catch (err: any) {
    throw new Error("Erreur de generation : " + (err?.message || "inconnue"));
  }

  if (!text.trim()) throw new Error("Aucun contenu genere.");

  return {
    minutes: text,
    usage: {
      audioSeconds,
      charCount: totalCharCount,
      segmentCount,
      inputTokens: apiUsage.input_tokens || 0,
      outputTokens: apiUsage.output_tokens || 0,
    },
  };
};
