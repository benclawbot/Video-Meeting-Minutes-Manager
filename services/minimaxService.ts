import { AnalysisResult } from "../types";
import { pipeline, env } from '@xenova/transformers';

// Configure transformers for browser use
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton for the transcriber
let transcriber: any = null;
let transcriberPromise: Promise<any> | null = null;

const getTranscriber = async () => {
  if (transcriber) return transcriber;
  if (transcriberPromise) return transcriberPromise;
  
  transcriberPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
    progress_callback: (progress: any) => {
      if (progress.status === 'initiate') {
        console.log('Loading Whisper model...');
      }
    }
  }).then(pipe => {
    transcriber = pipe;
    return pipe;
  });
  
  return transcriberPromise;
};

const fileToBlob = (blob: Blob): ArrayBuffer => {
  return blob;
};

export const analyzeMeetingVideo = async (
  mediaFile: File,
  title: string,
  date: string,
  onStatusChange?: (status: string) => void
): Promise<AnalysisResult> => {
  const apiKey = import.meta.env.VITE_MINIMAX_API_KEY || import.meta.env.MINIMAX_API_KEY;
  
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY not configured. Please set VITE_MINIMAX_API_KEY in your .env.local file.");
  }

  try {
    if (onStatusChange) onStatusChange('LOADING_MODEL');
    
    // Load Whisper model (cached in browser after first use)
    const transcriber = await getTranscriber();
    
    if (onStatusChange) onStatusChange('TRANSCRIBING');
    
    // Transcribe audio using Whisper (runs locally in browser)
    const arrayBuffer = await mediaFile.arrayBuffer();
    
    const result = await transcriber(arrayBuffer, {
      language: 'french',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    
    const transcription = result.text || "";
    
    if (!transcription.trim()) {
      throw new Error("Aucun texte transcrit. L'audio semble vide ou non reconnaissable.");
    }
    
    if (onStatusChange) onStatusChange('PROCESSING');

    // Generate meeting minutes from transcription using MiniMax Chat API
    const prompt = `
Tu es un assistant de direction expert. Analyse cette transcription de réunion "${title}" du ${date}.
Génère un compte rendu professionnel rigoureux en FRANÇAIS basé sur la transcription ci-dessous.

TRANSCRIPTION:
${transcription}

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

    const chatResponse = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 32000,
        temperature: 0.7,
      }),
    });

    if (!chatResponse.ok) {
      const errorData = await chatResponse.text();
      throw new Error(`MiniMax API error: ${chatResponse.status} - ${errorData}`);
    }

    const chatResult = await chatResponse.json();
    let text = chatResult.choices?.[0]?.message?.content || "";

    // Cleanup: remove markdown code blocks if present
    text = text.replace(/^```markdown\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');

    // Cleanup: Remove thinking process and find the actual content
    const titleIndex = text.indexOf('# Compte Rendu');
    if (titleIndex !== -1) {
      text = text.substring(titleIndex);
    } else {
      const firstH1 = text.indexOf('# ');
      if (firstH1 !== -1) {
        text = text.substring(firstH1);
      }
    }

    if (!text) throw new Error("Aucun contenu généré.");

    return { minutes: text };
  } catch (error: any) {
    console.error("Error:", error);
    throw new Error(error.message || "Erreur lors de l'analyse.");
  }
};
