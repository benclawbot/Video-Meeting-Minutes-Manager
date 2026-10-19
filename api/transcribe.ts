import type { VercelRequest, VercelResponse } from '@vercel/node';
import { openaiCredentials } from '@openai-oauth/react/server';
import { isWav, publicTranscriptionError, validateAudioHeaders, withinAudioLimit } from './transcribeGuards.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_STT_MODEL = 'whisper-large-v3';

export const config = {
  api: {
    bodyParser: false,
  },
};

const authHeaders = (req: VercelRequest): Headers => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (typeof value === 'string') {
      headers.set(name, value);
    }
  }
  return headers;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate before reading potentially large private audio or spending
  // service-side transcription credits. Same OAuth session gate as /api/analyze.
  try {
    openaiCredentials(authHeaders(req));
  } catch {
    return res.status(401).json({
      error: 'Connexion ChatGPT requise pour la transcription.',
    });
  }

  const allowed = validateAudioHeaders(
    req.headers['content-type'], req.headers['content-length']
  );
  if ('error' in allowed) {
    return res.status(allowed.status).json({ error: allowed.error });
  }

  // Never put a secret under the public VITE_* prefix.
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return res.status(503).json({ error: 'Transcription indisponible.' });
  }

  try {
    const chunks: Buffer[] = [];
    let bytesReceived = 0;
    for await (const part of req) {
      const chunk = Buffer.from(part);
      if (!withinAudioLimit(bytesReceived, chunk.length)) {
        return res.status(413).json({ error: 'Segment audio trop volumineux.' });
      }
      bytesReceived += chunk.length;
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks, bytesReceived);
    if (!isWav(buffer)) {
      return res.status(400).json({ error: 'Fichier WAV invalide.' });
    }

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'audio/wav' }), 'chunk.wav');
    form.append('model', GROQ_STT_MODEL);

    const groqRes = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });

    if (!groqRes.ok) {
      const safe = publicTranscriptionError(groqRes.status);
      return res.status(safe.status).json({ error: safe.error });
    }
    const data = await groqRes.json() as { text?: string };
    return res.status(200).json({
      text: typeof data.text === 'string' ? data.text : '',
    });
  } catch {
    const safe = publicTranscriptionError(502);
    return res.status(safe.status).json({ error: safe.error });
  }
}
