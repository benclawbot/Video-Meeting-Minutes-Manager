/** Bounded, deterministic request validation and provider-error privacy boundary. */
export interface ValidatedAnalyzeBody {
  title: string;
  date: string;
  transcript: string;
  locale: 'fr' | 'en';
}

export const MAX_TRANSCRIPT_CHARS = 200_000;
export const MAX_TITLE_CHARS = 160;
export const MAX_DATE_CHARS = 80;

export function validateAnalyzeBody(raw: unknown):
  | { ok: true; value: ValidatedAnalyzeBody }
  | { ok: false; status: number; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, status: 400, error: 'Requête invalide.' };
  }
  const input = raw as Record<string, unknown>;
  if (typeof input.transcript !== 'string' || !input.transcript.trim()) {
    return { ok: false, status: 400, error: 'Transcript manquant.' };
  }
  if (input.transcript.length > MAX_TRANSCRIPT_CHARS) {
    return { ok: false, status: 413, error: 'Transcription trop longue pour une seule analyse.' };
  }
  if (typeof input.title !== 'string' || !input.title.trim() ||
      input.title.length > MAX_TITLE_CHARS) {
    return { ok: false, status: 400, error: 'Titre de réunion invalide.' };
  }
  if (typeof input.date !== 'string' || !input.date.trim() ||
      input.date.length > MAX_DATE_CHARS) {
    return { ok: false, status: 400, error: 'Date de réunion invalide.' };
  }
  return {
    ok: true,
    value: {
      title: input.title.replace(/[\r\n\t]+/g, ' ').trim(),
      date: input.date.replace(/[\r\n\t]+/g, ' ').trim(),
      transcript: input.transcript.trim(),
      locale: input.locale === 'en' ? 'en' : 'fr',
    },
  };
}

export function publicProviderError(error: unknown): { status: number; error: string } {
  // Never reflect provider error.message/body: it may include auth headers,
  // submitted transcript fragments, request URLs or internal implementation data.
  const code = typeof error === 'object' && error !== null && 'status' in error
    ? (error as { status: unknown }).status
    : undefined;
  if (code === 401 || code === 403) {
    return {
      status: 401,
      error: 'Session ChatGPT expirée ou non autorisée. Reconnectez-vous puis réessayez.',
    };
  }
  if (code === 429) {
    return { status: 429, error: 'Limite de requêtes ChatGPT atteinte. Réessayez plus tard.' };
  }
  return {
    status: 502,
    error: 'Le service de génération est temporairement indisponible. Réessayez plus tard.',
  };
}
