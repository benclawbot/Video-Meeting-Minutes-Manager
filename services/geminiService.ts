import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "../types";

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes the video to generate minutes in French.
 * Uses the Files API to handle large video files and avoid 413 payload errors.
 */
export const analyzeMeetingVideo = async (
  videoFile: File,
  title: string,
  date: string
): Promise<AnalysisResult> => {
  try {
    // 1. Upload the file using the Gemini Files API
    const uploadResult = await ai.files.upload({
      file: videoFile,
      config: { 
        displayName: videoFile.name,
        mimeType: videoFile.type 
      }
    });

    let file = await ai.files.get({ name: uploadResult.name });
    
    // 2. Poll for processing completion
    while (file.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      file = await ai.files.get({ name: uploadResult.name });
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(`Video processing failed. State: ${file.state}`);
    }

    const model = 'gemini-3-pro-preview';

    const prompt = `
      You are an expert executive assistant.
      I have uploaded a video recording of a meeting.
      
      Meeting Metadata:
      - Title: "${title}"
      - Date: "${date}"
      
      Please generate a comprehensive "Compte Rendu" (Meeting Minutes) in FRENCH.
      
      Structure the Compte Rendu as follows:
      1. Synthèse (Executive Summary)
      2. Points Clés (Key Discussion Points)
      3. Décisions Prises (Decisions Made)
      4. Actions à Entreprendre (Action Items with owners)

      Do NOT generate a transcript. Only the minutes.

      Output Format:
      Please return the result as a JSON object with a single key: "minutes".
      The value should be formatted in Markdown.
      
      Example JSON Structure:
      {
        "minutes": "# Compte Rendu\n\n## Synthèse..."
      }
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { 
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response received from Gemini.");
    }

    // Parse the JSON response
    const data = JSON.parse(responseText);
    
    return {
      minutes: data.minutes || "Impossible de générer le compte rendu."
    };

  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error;
  }
};