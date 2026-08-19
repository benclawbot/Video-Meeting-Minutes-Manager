import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createOpenAIOptions } from '@openai-oauth/openai-client';
import { openaiCredentials } from '@openai-oauth/react/server';
import OpenAI from 'openai';

const FALLBACK_MODEL = 'gpt-5';
const MODEL_PREFERENCE = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.4-mini',
  'gpt-5.4',
  'gpt-5',
];

interface AnalyzeBody {
  title: string;
  date: string;
  transcript: string;
  locale?: 'fr' | 'en';
}

const requestHeaders = (req: VercelRequest): Headers => {
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

const resolveChatModel = async (client: OpenAI): Promise<string> => {
  const configured = process.env.CHATGPT_MODEL?.trim();
  if (configured) return configured;

  try {
    const catalog = await client.models.list();
    const available = new Set(catalog.data.map(model => model.id));
    for (const candidate of MODEL_PREFERENCE) {
      if (available.has(candidate)) return candidate;
    }

    const firstGpt = catalog.data.find(model => model.id.startsWith('gpt-') && !model.id.includes('image'));
    if (firstGpt) return firstGpt.id;
  } catch {
    // Model discovery is best effort. The gateway's stable fallback remains usable.
  }

  return FALLBACK_MODEL;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as AnalyzeBody | undefined;
  if (!body?.transcript?.trim()) {
    return res.status(400).json({ error: 'Transcript manquant.' });
  }

  let client: OpenAI;
  try {
    const credentials = openaiCredentials(requestHeaders(req));
    client = new OpenAI(createOpenAIOptions(credentials));
  } catch {
    return res.status(401).json({ error: 'Connexion ChatGPT requise. Reconnectez-vous puis relancez la génération.' });
  }

  const { title, date, transcript } = body;
  const locale = body.locale === 'en' ? 'en' : 'fr';
  const isFr = locale === 'fr';

  const lang = isFr ? 'français' : 'English';
  const summary = isFr ? 'Résumé exécutif' : 'Executive summary';
  const participants = 'Participants';
  const discussion = isFr ? 'Points clés discutés' : 'Key discussion points';
  const decisions = isFr ? 'Décisions prises' : 'Decisions made';
  const actions = isFr ? 'Actions à mener' : 'Action items';
  const next = isFr ? 'Prochaine réunion' : 'Next meeting';
  const action = 'Action';
  const owner = isFr ? 'Responsable' : 'Owner';
  const due = isFr ? 'Échéance' : 'Due date';
  const priority = isFr ? 'Priorité' : 'Priority';
  const status = isFr ? 'Statut' : 'Status';
  const confirm = isFr ? 'À confirmer' : 'To confirm';

  const prompt = `
Génère un compte rendu professionnel en ${lang} pour la réunion "${title}" du ${date}.

Le document doit commencer par exactement : # ${title}
N'ajoute pas type de réunion, organisateur, rédacteur, lieu, lien ni pied de page.
Structure le contenu avec des puces détaillées et concrètes.
Utilise exclusivement la langue demandée.

Format Markdown attendu :
# ${title}

## ${summary}
Un court paragraphe, puis 4 à 6 puces couvrant objectif, état actuel, risques, décisions et prochaines étapes.

## ${participants}
- Liste les participants identifiables, sinon ${confirm}.

## ${discussion}
### 1. Sujet principal
- 2 à 4 puces avec contexte, détails, contraintes ou désaccords.
### 2. Sujet principal
- 2 à 4 puces.
### 3. Sujet principal
- 2 à 4 puces.

## ${decisions}
- Décisions avec justification, impact ou dépendance.

## ${actions}
| ${action} | ${owner} | ${due} | ${priority} | ${status} |
| :--- | :--- | :--- | :--- | :--- |

## ${next}
- Date et heure si mentionnées, sinon ${confirm}.
- Puces d'ordre du jour suggérées.

TRANSCRIPTION :
${transcript}
`.trim();

  try {
    const model = await resolveChatModel(client);
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 6144,
    });

    let text = completion.choices?.[0]?.message?.content || '';

    text = text
      .replace(/^```markdown\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '');

    text = text
      .replace(/[\u0400-\u04FF]+/g, '')
      .replace(/[\u4E00-\u9FFF]+/g, '');

    if (!text.startsWith('# ')) {
      text = `# ${title}\n\n${text}`;
    }

    const firstTitleIndex = text.search(/^#\s+/m);
    if (firstTitleIndex > 0) {
      text = text.substring(firstTitleIndex).trim();
    }

    if (!text.trim()) {
      return res.status(500).json({ error: 'Aucun contenu généré.' });
    }

    const inputTokens = completion.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
    const outputTokens = completion.usage?.completion_tokens ?? Math.ceil(text.length / 4);

    return res.status(200).json({
      minutes: text,
      model,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    });
  } catch (err: unknown) {
    const statusCode = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
      ? err.status
      : 500;
    const message = err instanceof Error ? err.message : 'erreur inconnue';

    if (statusCode === 401 || statusCode === 403) {
      return res.status(401).json({ error: 'Session ChatGPT expirée ou non autorisée. Reconnectez-vous puis réessayez.' });
    }

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: `Erreur de génération ChatGPT : ${message}`,
    });
  }
}
