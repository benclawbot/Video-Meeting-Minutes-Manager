import { AnalysisResult } from "../types";

// ─── Chunk Configuration ──────────────────────────────────────────────────────
const TARGET_RATE = 16000;          // 16kHz for Whisper
const CHUNK_DURATION_SEC = 120;     // 2-minute chunks (~3.8MB WAV — under Vercel 4.5MB limit)
const MIN_CHUNK_SEC = 0.01;

// ─── Audio Utilities ──────────────────────────────────────────────────────────

const encodeWav8Bit = (samples: Float32Array, sampleRate: number): Blob => {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);             // PCM format
  view.setUint16(22, 1, true);             // mono
  view.setUint32(24, sampleRate, true);    // sample rate
  view.setUint32(28, sampleRate, true);     // byte rate
  view.setUint16(32, 1, true);             // block align (1 byte)
  view.setUint16(34, 8, true);             // bits per sample (8-bit unsigned)
  writeString(36, "data");
  view.setUint32(40, numSamples, true);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setUint8(44 + i, Math.round((s * 0.5 + 0.5) * 255));
  }
  return new Blob([buffer], { type: "audio/wav" });
};

const resampleAudio = async (
  audioBuffer: AudioBuffer,
  targetRate: number
): Promise<AudioBuffer> => {
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(audioBuffer.duration * targetRate),
    targetRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  return await offlineCtx.startRendering();
};

// ─── Main Export ──────────────────────────────────────────────────────────────

export const analyzeMeetingVideo = async (
  mediaFile: File,
  title: string,
  date: string,
  onStatusChange?: (status: string) => void
): Promise<AnalysisResult> => {
  // ── Step 1: Decode audio ──────────────────────────────────────────────────────
  if (onStatusChange) onStatusChange("EXTRACTING_AUDIO");

  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decodeCtx = new AudioCtx();
  const arrayBuffer = await mediaFile.arrayBuffer();
  const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  await decodeCtx.close();

  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);

  // ── Step 2: Resample to TARGET_RATE ─────────────────────────────────────────
  if (onStatusChange) onStatusChange("PROCESSING");

  const targetRate = TARGET_RATE;
  let resampledSamples: Float32Array;

  if (sampleRate !== targetRate) {
    const resampledBuffer = await resampleAudio(audioBuffer, targetRate);
    resampledSamples = resampledBuffer.getChannelData(0);
  } else {
    resampledSamples = samples;
  }

  // ── Step 3: Transcribe via /api/transcribe proxy ──────────────────────────────
  if (onStatusChange) onStatusChange("UPLOADING");

  const samplesPerChunk = Math.floor(CHUNK_DURATION_SEC * targetRate);
  const totalSamples = resampledSamples.length;
  const totalChunks = Math.ceil(totalSamples / samplesPerChunk);

  const transcriptionParts: string[] = [];

  for (let idx = 0; idx < totalChunks; idx++) {
    const startSample = idx * samplesPerChunk;
    const endSample = Math.min(startSample + samplesPerChunk, totalSamples);
    const chunkSamples = resampledSamples.subarray(startSample, endSample);

    const chunkDurationSec = chunkSamples.length / targetRate;
    if (chunkDurationSec < MIN_CHUNK_SEC) continue;

    const wavBlob = encodeWav8Bit(chunkSamples, targetRate);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: wavBlob,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
        throw new Error(err.error || "Erreur de transcription");
      }

      const data = await res.json() as { text?: string };
      if (data.text?.trim()) {
        transcriptionParts.push(data.text.trim());
      }
    } catch (err: any) {
      throw new Error("Erreur de transcription : " + (err?.message || "inconnue"));
    }

    if (idx < totalChunks - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const transcript = transcriptionParts.join(" ");
  if (!transcript?.trim()) {
    throw new Error("Aucun contenu audio détecté dans le fichier.");
  }

  // ── Step 4: Generate meeting minutes via /api/analyze proxy ──────────────────
  if (onStatusChange) onStatusChange("PROCESSING");

  let text: string;
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, date, transcript }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
      throw new Error(err.error || "Erreur de génération");
    }

    const data = await res.json() as { minutes?: string };
    text = data.minutes || "";
  } catch (err: any) {
    throw new Error("Erreur de génération : " + (err?.message || "inconnue"));
  }

  if (!text?.trim()) throw new Error("Aucun contenu généré.");

  return { minutes: text };
};
