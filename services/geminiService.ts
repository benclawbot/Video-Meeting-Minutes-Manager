import { AnalysisResult } from "../types";

/**
 * Meeting analysis using Deepgram nova-2 + MiniMax M2.7.
 *
 * 2-step pipeline:
 * 1. Transcribe audio via Deepgram nova-2 (accepts WAV/PCM directly, free tier available)
 * 2. Analyze transcription via MiniMax M2.7 Anthropic-compatible API (text-only)
 *
 * Audio is chunked to 5-minute segments at 8kHz 16-bit mono for efficient transcription.
 *
 * Transcription: Deepgram nova-2
 * Analysis: MiniMax M2.7
 * Docs: https://console.deepgram.com/docs, https://platform.minimaxi.com
 */

// Deepgram API — CORS supported from browser
const DEEPGRAM_API = "https://api.deepgram.com/v1/listen";
// Anthropic-compatible API — must go through Vite proxy for header injection
const ANTHROPIC_API = "/api/minimax";

// 5 min at 8kHz 16-bit mono = ~4.8MB WAV — well under Whisper-1's 25MB limit.
const MAX_CHUNK_SECS = 5 * 60; // 5 minutes per chunk
const CHUNK_SAMPLE_RATE = 8000; // 8kHz 16-bit mono

// ---------------------------------------------------------------------------
// Audio encoding
// ---------------------------------------------------------------------------

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


// ---------------------------------------------------------------------------
// Audio extraction — returns raw Float32Array samples at a target sample rate
// ---------------------------------------------------------------------------

const extractAudioSamples = async (
  mediaFile: File,
  targetRate: number,
  onStatusChange?: (status: string) => void
): Promise<{ samples: Float32Array; sampleRate: number }> => {
  if (onStatusChange) onStatusChange("EXTRACTING_AUDIO");

  const decodeCtx = new AudioContext();
  const arrayBuffer = await mediaFile.arrayBuffer();
  const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  await decodeCtx.close();

  if (audioBuffer.sampleRate !== targetRate) {
    if (onStatusChange) onStatusChange("RESAMPLING_AUDIO");
    const resampled = await resampleAudio(audioBuffer, targetRate);
    return { samples: resampled.getChannelData(0), sampleRate: targetRate };
  }

  return { samples: audioBuffer.getChannelData(0), sampleRate: audioBuffer.sampleRate };
};

// ---------------------------------------------------------------------------
// Transcribe one audio chunk
// ---------------------------------------------------------------------------

const transcribeChunk = async (
  samples: Float32Array,
  sampleRate: number,
  apiKey: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> => {
  const wavBlob = encodeWav16Bit(samples, sampleRate);

  const response = await fetch(`${DEEPGRAM_API}?model=nova-2&language=fr&smart_format=true`, {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "audio/wav",
    },
    body: wavBlob,
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = text;
    try { const err = JSON.parse(text); msg = err?.err?.msg || err?.message || text; } catch {}
    throw new Error(`Deepgram transcription error (chunk ${chunkIndex + 1}): ${msg}`);
  }

  const json = await response.json();
  const content = json?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

  const label = totalChunks > 1 ? ` [Partie ${chunkIndex + 1}/${totalChunks}]` : "";
  return (content.trim() + label).trim();
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export const analyzeMeetingVideo = async (
  mediaFile: File,
  title: string,
  date: string,
  onStatusChange?: (status: string) => void
): Promise<AnalysisResult> => {
  const deepgramKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    throw new Error("Clé API Deepgram manquante. Ajoutez VITE_DEEPGRAM_API_KEY dans .env.local.");
  }

  if (onStatusChange) onStatusChange("EXTRACTING_AUDIO");
  const decodeCtx = new AudioContext();
  const metaBuffer = await mediaFile.arrayBuffer();
  const metaAudio = await decodeCtx.decodeAudioData(metaBuffer);
  await decodeCtx.close();

  const durationSecs = metaAudio.duration;
  const secsPerChunk = MAX_CHUNK_SECS;
  const numChunks = Math.ceil(durationSecs / secsPerChunk);

  // For very long meetings (>35 min at 8kHz), drop to 4kHz for smaller WAV payloads
  const sampleRate = numChunks > 5 ? 4000 : CHUNK_SAMPLE_RATE;

  // Extract audio at chosen sample rate
  const { samples, sampleRate: actualRate } = await extractAudioSamples(
    mediaFile,
    sampleRate,
    onStatusChange
  );

  if (onStatusChange) onStatusChange("PROCESSING");

  // Chunk the samples by time duration
  const samplesPerChunk = MAX_CHUNK_SECS * actualRate;
  const totalSamples = samples.length;
  const actualChunks = Math.ceil(totalSamples / samplesPerChunk);

  // Transcribe all chunks (parallel for speed)
  const chunkPromises: Promise<string>[] = [];
  for (let i = 0; i < actualChunks; i++) {
    const start = i * samplesPerChunk;
    const end = Math.min(start + samplesPerChunk, totalSamples);
    const chunkSamples = samples.subarray(start, end);
    chunkPromises.push(
      transcribeChunk(chunkSamples, actualRate, deepgramKey, i, actualChunks).catch(
        (err) => { throw err; }
      )
    );
  }

  let allTranscriptions: string[];
  try {
    allTranscriptions = await Promise.all(chunkPromises);
  } catch (err: any) {
    throw err;
  }

  // Combine transcriptions
  const combinedTranscription = allTranscriptions
    .map((t, i) => {
      if (actualChunks === 1) return t;
      return `[Partie ${i + 1}] ${t}`;
    })
    .join("\n\n");

  if (!combinedTranscription || combinedTranscription.trim().length < 5) {
    throw new Error("Impossible de transcrire l'audio. Vérifiez que le fichier contient de la parole.");
  }

  // Step 2: Analyze transcription via Anthropic-compatible API
  const prompt = `Tu es un assistant de direction expert. Analyse cette réunion "${title}" du ${date}.
À partir de la transcription suivante, génère un compte rendu professionnel rigoureux en FRANÇAIS.

TRANSCRIPTION COMPLÈTE:
${combinedTranscription}

IMPORTANT : Ne fournis QUE le contenu du compte rendu. Ne montre PAS ton raisonnement. Débute DIRECTEMENT par le titre.

CONSIGNES DE FORMATAGE STRICTES (Markdown) :
1. # Compte Rendu : ${title}
2. ## Synthèse : Résumé exécutif de la réunion.
3. ## Points Clés : Détails organizados par thèmes. Utilise des listes à puces.
4. ## Décisions : Liste claire des points validés.
5. ## Actions à Entreprendre : DOIT être un TABLEAU Markdown.
   | Action | Responsable | Échéance |
   | :--- | :--- | :--- |
   | ... | ... | ... |

Réponds uniquement en Markdown, pas en JSON.`;

  if (onStatusChange) onStatusChange("ANALYZING");

  const analysisResponse = await fetch(`${ANTHROPIC_API}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "MiniMax/M2.7",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 8192,
    }),
  });

  if (!analysisResponse.ok) {
    const text = await analysisResponse.text();
    let msg = text;
    try { const err = JSON.parse(text); msg = err?.error?.message || err?.message || text; } catch {}
    throw new Error(`MiniMax error ${analysisResponse.status}: ${msg}`);
  }

  const analysisJson = await analysisResponse.json();
  let minutes = "";

  // Anthropic API: { content: [{ type: "text", text: "..." }, { type: "thinking", thinking: "..." }] }
  if (analysisJson.content) {
    const textBlocks = analysisJson.content.filter((block: any) => block.type === "text");
    const thinkingBlocks = analysisJson.content.filter((block: any) => block.type === "thinking");
    if (textBlocks.length > 0) {
      minutes = textBlocks.map((block: any) => block.text).join("\n");
    } else if (thinkingBlocks.length > 0) {
      for (const block of thinkingBlocks) {
        if (block.thinking && block.thinking.length > 50) {
          const content = block.thinking;
          const h1Match = content.match(/#\s+Compte\s*Rendu/);
          if (h1Match) {
            minutes = content.substring(h1Match.index!);
            break;
          }
          minutes = content;
        }
      }
    }
  }

  // Cleanup markdown artifacts
  minutes = minutes
    .replace(/^```markdown\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "");

  const titleIndex = minutes.indexOf("# Compte Rendu");
  if (titleIndex !== -1) {
    minutes = minutes.substring(titleIndex);
  } else {
    const firstH1 = minutes.indexOf("# ");
    if (firstH1 !== -1) minutes = minutes.substring(firstH1);
  }

  if (!minutes || minutes.trim().length < 10) {
    throw new Error("Aucun contenu généré par le modèle.");
  }

  return { minutes };
};
