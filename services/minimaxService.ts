import { AnalysisResult } from "../types";

const MINIMAX_API_KEY = import.meta.env.VITE_MINIMAX_API_KEY;
const MINIMAX_GROUP_ID = import.meta.env.VITE_MINIMAX_GROUP_ID;

console.log("Minimax Config Check:", {
  hasKey: !!MINIMAX_API_KEY,
  hasGroupId: !!MINIMAX_GROUP_ID,
  groupIdLength: MINIMAX_GROUP_ID?.length
});

const fileToBlob = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    resolve(file);
  });
};

const transcribeAudio = async (audioFile: File | Blob, onStatusChange?: (status: string) => void): Promise<string> => {
  if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
    throw new Error("Minimax API Key or Group ID is missing. Please check your configuration.");
  }

  if (audioFile instanceof File && audioFile.size > 100 * 1024 * 1024) {
    throw new Error("Le fichier est trop volumineux pour Minimax (max 100Mo). Veuillez le diviser ou le compresser.");
  }

  if (onStatusChange) onStatusChange('TRANSCRIBING');

  const formData = new FormData();
  formData.append('file', audioFile, 'audio.wav');
  formData.append('model', 'speech-01');

  const response = await fetch(`https://api.minimax.chat/v1/audio_transcription?GroupId=${MINIMAX_GROUP_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MINIMAX_API_KEY}`
    },
    body: formData
  });

  const responseText = await response.text();
  console.log("Minimax Transcription Raw Response:", responseText);
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Invalid JSON response from Minimax Transcription API. The response was: ${responseText.substring(0, 100)}`);
  }

  if (!response.ok) {
    throw new Error(`Transcription failed: ${data.base_resp?.status_msg || response.statusText}`);
  }

  if (data.base_resp?.status_code !== 0) {
    throw new Error(`Transcription error: ${data.base_resp?.status_msg}`);
  }

  return data.text || "";
};

const analyzeTextWithMinimax = async (text: string, title: string, date: string, onStatusChange?: (status: string) => void): Promise<string> => {
  if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
    throw new Error("Minimax API Key or Group ID is missing. Please check your configuration.");
  }

  if (onStatusChange) onStatusChange('PROCESSING');

  const prompt = `
    Tu es un assistant de direction expert. Analyse cette réunion "${title}" du ${date}.
    Voici la transcription de la réunion :
    
    ${text}
    
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

  const response = await fetch(`https://api.minimax.chat/v1/text/chatcompletion_v2?GroupId=${MINIMAX_GROUP_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'minimax-text-01',
      messages: [
        { role: 'system', content: 'Tu es un assistant de direction expert.' },
        { role: 'user', content: prompt }
      ],
      stream: false
    })
  });

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse Minimax analysis response:", responseText);
    throw new Error(`Invalid JSON response from Minimax Analysis API: ${responseText.substring(0, 100)}...`);
  }

  if (!response.ok) {
    throw new Error(`Analysis failed: ${data.base_resp?.status_msg || response.statusText}`);
  }

  if (data.base_resp?.status_code !== 0) {
    throw new Error(`Analysis error: ${data.base_resp?.status_msg}`);
  }

  let resultText = data.choices?.[0]?.message?.content || "";
  
  // Cleanup
  resultText = resultText.replace(/^```markdown\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');
  const titleIndex = resultText.indexOf('# Compte Rendu');
  if (titleIndex !== -1) {
    resultText = resultText.substring(titleIndex);
  }

  return resultText;
};

export const analyzeMeetingVideo = async (
  mediaFile: File,
  title: string,
  date: string,
  onStatusChange?: (status: string) => void
): Promise<AnalysisResult> => {
  try {
    // Step 1: Transcribe audio
    const transcript = await transcribeAudio(mediaFile, onStatusChange);
    
    if (!transcript) {
      throw new Error("La transcription n'a produit aucun texte.");
    }

    // Step 2: Analyze transcript
    const minutes = await analyzeTextWithMinimax(transcript, title, date, onStatusChange);

    if (!minutes) {
      throw new Error("L'analyse n'a produit aucun contenu.");
    }

    return { minutes };
  } catch (error: any) {
    console.error("Minimax Error:", error);
    throw new Error(error.message || "Erreur lors de l'analyse avec Minimax.");
  }
};
