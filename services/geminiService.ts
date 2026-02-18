import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const encodeWav8Bit = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); 
  view.setUint16(22, 1, true); 
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); 
  view.setUint16(32, 1, true); 
  view.setUint16(34, 8, true); 
  writeString(36, 'data');
  view.setUint32(40, samples.length, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = Math.round((s + 1) * 127.5);
    view.setUint8(44 + i, val);
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

const resampleAudio = async (audioBuffer: AudioBuffer, targetRate: number): Promise<AudioBuffer> => {
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetRate), targetRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  return await offlineCtx.startRendering();
};

const fileToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const extractAndOptimizeAudio = async (mediaFile: File): Promise<{ data: string; mimeType: string }> => {
  // Optimization: If the original file is audio and small enough (< 13MB), send it directly.
  // 13MB binary ~= 17.3MB Base64. Safe for 20MB request limit including prompt.
  // Supported formats by Gemini: WAV, MP3, AAC, FLAC, OGG.
  // We assume browser-supported audio types are generally compatible or will fail gracefully.
  const MAX_INLINE_SIZE = 13 * 1024 * 1024;
  
  if (mediaFile.type.startsWith('audio/') && mediaFile.size < MAX_INLINE_SIZE) {
    try {
      const base64 = await fileToBase64(mediaFile);
      return { data: base64, mimeType: mediaFile.type };
    } catch (e) {
      console.warn("Direct file read failed, falling back to transcoding", e);
    }
  }

  const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await mediaFile.arrayBuffer();
  const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  const durationInSecs = audioBuffer.duration;
  
  // Dynamic compression logic
  // Target: ~12MB binary data to stay safe (lowered from 13 to be safer with base64 overhead)
  const targetBinarySize = 12 * 1024 * 1024;
  
  // Calculate max possible rate: Bytes / Seconds
  let targetRate = Math.floor(targetBinarySize / durationInSecs);
  
  // Clamp sample rate.
  // The Web Audio API spec and Chrome implementation require a minimum of 3000Hz for OfflineAudioContext.
  // Attempting to use a lower value (e.g. 2585) causes a constructor error.
  if (targetRate < 3000) targetRate = 3000;
  if (targetRate > 16000) targetRate = 16000; 

  const resampled = await resampleAudio(audioBuffer, targetRate);
  const channelData = resampled.getChannelData(0);
  const wavBlob = encodeWav8Bit(channelData, targetRate);
  
  const base64 = await fileToBase64(wavBlob);
  return { data: base64, mimeType: 'audio/wav' };
};

export const analyzeMeetingVideo = async (
  mediaFile: File,
  title: string,
  date: string,
  onStatusChange?: (status: string) => void
): Promise<AnalysisResult> => {
  let audioData: { data: string; mimeType: string } | undefined;
  try {
    if (onStatusChange) onStatusChange('EXTRACTING_AUDIO');
    audioData = await extractAndOptimizeAudio(mediaFile);

    if (onStatusChange) onStatusChange('UPLOADING');
    const prompt = `
      Tu es un assistant de direction expert. Analyse cette réunion "${title}" du ${date}.
      Génère un compte rendu professionnel rigoureux en FRANÇAIS.
      
      IMPORTANT : Ne fournis QUE le contenu du compte rendu. N'affiche PAS ton processus de réflexion ("thought") et ne commence PAS par un texte introductif. Débute DIRECTEMENT par le titre.

      CONSIGNES DE FORMATAGE STRICTES (Markdown) :
      1. # Compte Rendu : ${title}
      2. ## Synthèse : Résumé exécutif de la réunion.
      3. ## Points Clés : Détails organisés par thèmes. Utilise des listes à puces.
      4. ## Décisions : Liste claire des points validés.
      5. ## Actions à Entreprendre : DOIT être un TABLEAU Markdown.
         | Action | Responsable | Échéance |
         | :--- | :--- | :--- |
         | ... | ... | ... |

      IMPORTANT: Réponds directement avec le texte au format Markdown. N'utilise PAS de JSON.
    `;

    if (onStatusChange) onStatusChange('PROCESSING');

    // Using gemini-3-pro-preview for best quality
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: {
        parts: [
          { inlineData: { data: audioData.data, mimeType: audioData.mimeType } },
          { text: prompt }
        ]
      },
    });

    let text = response.text || "";
    
    // Cleanup: remove markdown code blocks if present
    text = text.replace(/^```markdown\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');

    // Cleanup: Remove thinking process. 
    // Strip everything before the expected Markdown Title
    // This removes "thought\n..." or any preamble
    const titleIndex = text.indexOf('# Compte Rendu');
    if (titleIndex !== -1) {
      text = text.substring(titleIndex);
    } else {
      // Fallback: try to find the first H1 if the exact title isn't found
      const firstH1 = text.indexOf('# ');
      if (firstH1 !== -1) {
         text = text.substring(firstH1);
      }
    }

    if (!text) throw new Error("Aucun contenu généré.");

    return { minutes: text };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    // Relaxed size check to 21MB (Base64) to allow for minor overflows if the API accepts it
    if (error.message?.includes('413') || (audioData && audioData.data.length > 21 * 1024 * 1024)) {
      throw new Error("Réunion trop longue. Veuillez diviser le fichier.");
    }
    throw new Error(error.message || "Erreur lors de l'analyse.");
  }
};