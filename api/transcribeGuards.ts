/** Privacy-preserving, provider-independent boundaries for speech transcription. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export function validateAudioHeaders(contentType: unknown, contentLength: unknown):
  | { ok: true }
  | { ok: false; status: number; error: string } {
  const mime = typeof contentType === 'string'
    ? contentType.split(';', 1)[0].toLowerCase().trim() : '';
  if (!['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave'].includes(mime)) {
    return { ok: false, status: 415, error: 'Format audio WAV requis.' };
  }
  if (contentLength !== undefined) {
    if (typeof contentLength !== 'string' || !/^\d+$/.test(contentLength)) {
      return { ok: false, status: 400, error: 'Taille audio invalide.' };
    }
    if (Number(contentLength) > MAX_AUDIO_BYTES) {
      return { ok: false, status: 413, error: 'Segment audio trop volumineux.' };
    }
  }
  return { ok: true };
}

export function withinAudioLimit(previousBytes: number, chunkBytes: number): boolean {
  return Number.isSafeInteger(previousBytes) && previousBytes >= 0 &&
    Number.isSafeInteger(chunkBytes) && chunkBytes >= 0 &&
    previousBytes + chunkBytes <= MAX_AUDIO_BYTES;
}

export function isWav(buffer: Uint8Array): boolean {
  return buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && // RIFF
    buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x41 && // WAVE
    buffer[10] === 0x56 && buffer[11] === 0x45;
}

export function publicTranscriptionError(status: number): { status: number; error: string } {
  // Never expose Groq response bodies or thrown error messages: providers
  // can include request payload fragments, credentials or private metadata.
  if (status === 429) return { status: 429, error: 'Transcription limitée. Réessayez plus tard.' };
  return { status: 502, error: 'Service de transcription momentanément indisponible.' };
}
