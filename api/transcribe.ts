import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_STT_MODEL = 'whisper-large-v3';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const groqKey = process.env.VITE_GROQ_API_KEY;
  if (!groqKey) {
    return res.status(500).json({ error: 'Clé API Groq manquante.' });
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'audio/wav' }), 'chunk.wav');
    form.append('model', GROQ_STT_MODEL);

    const groqRes = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
      },
      body: form,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(groqRes.status).json({ error: `Groq error: ${errText}` });
    }

    const data = await groqRes.json() as { text?: string };
    return res.status(200).json({ text: data.text || '' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erreur de transcription : ' + (err?.message || 'inconnue') });
  }
}
