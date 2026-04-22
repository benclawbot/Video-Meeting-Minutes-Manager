import OpenAI from "openai";
import { AnalysisResult } from "../types";

// ─── MiniMax Configuration ────────────────────────────────────────────────────
const MINIMAX_BASE_URL   = `${window.location.origin}/minimax-api/v1`;
const MINIMAX_CHAT_MODEL = "minimax-m2.5";

// ─── Groq Configuration (STT) ─────────────────────────────────────────────────
const GROQ_BASE_URL  = `${window.location.origin}/groq-api/openai/v1`;
const GROQ_STT_MODEL = "whisper-large-v3";

// ─── Audio Utilities ──────────────────────────────────────────────────────────

const encodeWav16Bit = (samples: Float32Array, sampleRate: number): Blob => {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);            // PCM chunk size
  view.setUint16(20, 1, true);             // PCM format
  view.setUint16(22, 1, true);             // mono
  view.setUint32(24, sampleRate, true);     // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);             // block align
  view.setUint16(34, 16, true);            // bits per sample
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
};

// ─── Audio Utilities ──────────────────────────────────────────────────────────

interface AudioSegment {
  startSample: number;
  endSample: number;
}

/**
 * Detect silence-based segments in audio.
 * Splits at silence gaps ≥ minSilenceSecs where amplitude stays below threshold.
 */
const detectSilenceSegments = (
  samples: Float32Array,
  sampleRate: number,
  minSilenceSecs: number = 1.5,
  silenceThreshold: number = 0.01
): AudioSegment[] => {
  const segments: AudioSegment[] = [];
  const minSilenceSamples = Math.floor(minSilenceSecs * sampleRate);

  let segmentStart = 0;
  let i = 0;
  const total = samples.length;

  while (i < total) {
    // Slide forward until we find non-silence
    while (i < total && Math.abs(samples[i]) < silenceThreshold) {
      i++;
    }

    if (i >= total) break;
    segmentStart = i;

    // Advance through non-silence
    while (i < total && Math.abs(samples[i]) >= silenceThreshold) {
      i++;
    }

    // Check for a silence gap
    let silenceStart = i;
    while (i < total && Math.abs(samples[i]) < silenceThreshold) {
      i++;
    }

    const silenceLen = i - silenceStart;
    if (silenceLen >= minSilenceSamples && i < total) {
      // Valid silence → split here
      segments.push({ startSample: segmentStart, endSample: silenceStart });
      segmentStart = i;
    }
  }

  // Add final segment
  if (segmentStart < total) {
    segments.push({ startSample: segmentStart, endSample: total });
  }

  // Fallback: if no segments detected (continuous speech), return one segment
  if (segments.length === 0) {
    segments.push({ startSample: 0, endSample: total });
  }

  return segments;
};

// ─── Main Export ──────────────────────────────────────────────────────────────

export const analyzeMeetingVideo = async (
  mediaFile: File,
  title: string,
  date: string,
  onStatusChange?: (status: string) => void
): Promise<AnalysisResult> => {
  const minimaxKey = (import.meta as any).env?.MINIMAX_API_KEY || (import.meta as any).env?.VITE_MINIMAX_API_KEY;
  if (!minimaxKey) throw new Error("Clé API MiniMax manquante (MINIMAX_API_KEY).");

  const groqKey = (import.meta as any).env?.GROQ_API_KEY || (import.meta as any).env?.VITE_GROQ_API_KEY;
  if (!groqKey) throw new Error("Clé API Groq manquante (GROQ_API_KEY).");

  const chatClient = new OpenAI({
    apiKey: minimaxKey,
    baseURL: MINIMAX_BASE_URL,
    dangerouslyAllowBrowser: true,
  });

  const sttClient = new OpenAI({
    apiKey: groqKey,
    baseURL: GROQ_BASE_URL,
    dangerouslyAllowBrowser: true,
  });

  // ── Step 1: Decode audio ──────────────────────────────────────────────────────
  if (onStatusChange) onStatusChange("EXTRACTING_AUDIO");

  const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await mediaFile.arrayBuffer();
  const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  await decodeCtx.close();

  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);

  // ── Step 2: Detect silence-based segments ────────────────────────────────────
  if (onStatusChange) onStatusChange("PROCESSING");

  const segments = detectSilenceSegments(samples, sampleRate);

  // ── Step 3: Transcribe each segment ─────────────────────────────────────────
  if (onStatusChange) onStatusChange("UPLOADING");

  const transcriptionParts: string[] = [];
  const TARGET_RATE = 16000; // 16kHz for Whisper quality

  for (let idx = 0; idx < segments.length; idx++) {
    const seg = segments[idx];
    const chunkSamples = samples.subarray(seg.startSample, seg.endSample);
    const chunkDuration = (seg.endSample - seg.startSample) / sampleRate;

    // Build AudioBuffer from chunk samples, resample if needed
    let resampled: Float32Array;
    if (sampleRate !== TARGET_RATE) {
      const chunkCtx = new OfflineAudioContext(1, Math.ceil(chunkDuration * TARGET_RATE), TARGET_RATE);
      const chunkAudioBuffer = chunkCtx.createBuffer(1, chunkSamples.length, sampleRate);
      chunkAudioBuffer.getChannelData(0).set(chunkSamples);
      const audioBufferSource = chunkCtx.createBufferSource();
      audioBufferSource.buffer = chunkAudioBuffer;
      audioBufferSource.connect(chunkCtx.destination);
      audioBufferSource.start();
      const resampledBuffer = await chunkCtx.startRendering();
      resampled = resampledBuffer.getChannelData(0);
    } else {
      resampled = chunkSamples;
    }

    const wavBlob = encodeWav16Bit(resampled, TARGET_RATE);
    const audioFile = new File([wavBlob], `chunk-${idx}.wav`, { type: "audio/wav" });

    try {
      const transcription = await sttClient.audio.transcriptions.create({
        file: audioFile,
        model: GROQ_STT_MODEL,
      });
      if (transcription.text.trim()) {
        transcriptionParts.push(transcription.text.trim());
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("413") || wavBlob.size > 21 * 1024 * 1024) {
        throw new Error(`Chunk ${idx + 1} trop volumineux. Veuillez diviser le fichier audio.`);
      }
      // Log warning but continue — skip failed chunks
      console.warn(`Transcription chunk ${idx + 1} failed:`, msg);
    }
  }

  const transcript = transcriptionParts.join(" ");
  if (!transcript?.trim()) {
    throw new Error("Aucun contenu audio détecté dans le fichier.");
  }

  // ── Step 4: Generate meeting minutes ─────────────────────────────────────────
  if (onStatusChange) onStatusChange("PROCESSING");

  const prompt = `
Tu es un assistant de direction expert. Analyse cette réunion "${title}" du ${date}.
Génère un compte rendu professionnel rigoureux en FRANÇAIS à partir de la transcription ci-dessous.

IMPORTANT : Ne fournis QUE le contenu du compte rendu. N'affiche PAS ton processus de réflexion ("thought") et ne commence PAS par un texte introductif. Débute DIRECTEMENT par le titre.

CONSIGNES DE FORMATAGE STRICTES (Markdown) :
1. # Compte Rendu : ${title}
2. ## Synthèse : Résumé exécutif de la réunion.
3. ## Points Clés : Détails organizados par thèmes. Utilise des listes à puces.
4. ## Décisions : Liste claire des points validés.
5. ## Actions à Entreprendre : DOIT être un TABLEAU Markdown.
   | Action | Responsable | Échéance |
   | :--- | :--- | :--- |
   | ... | ... | ... |

IMPORTANT: Réponds directement avec le texte au format Markdown. N'utilise PAS de JSON.

--- TRANSCRIPTION ---
${transcript}
--- FIN DE TRANSCRIPTION ---
  `.trim();

  let text: string;
  try {
    const response = await chatClient.chat.completions.create({
      model: MINIMAX_CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
    });
    text = response.choices?.[0]?.message?.content || "";
  } catch (err: any) {
    throw new Error("Erreur de génération : " + (err?.message || "inconnue"));
  }

  // Clean up markdown artifacts
  text = text
    .replace(/^```markdown\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "");

  // Strip any thinking preamble — jump to first heading
  const titleIndex = text.indexOf("# Compte Rendu");
  if (titleIndex !== -1) {
    text = text.substring(titleIndex);
  } else {
    const firstH1 = text.indexOf("# ");
    if (firstH1 !== -1) text = text.substring(firstH1);
  }

  if (!text) throw new Error("Aucun contenu généré.");

  return { minutes: text };
};
