/** Privacy-preserving, provider-independent boundaries for speech transcription. */
/** Vercel Functions cap request bodies at 4.5 MB; leave headroom for transport overhead. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export type AudioFormat = 'wav' | 'mp4' | 'm4a' | 'mp3' | 'webm' | 'ogg' | 'flac';

const MIME_FORMAT: Record<string, AudioFormat> = {
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/vnd.wave': 'wav',
  'video/mp4': 'mp4',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

export function validateAudioHeaders(contentType: unknown, contentLength: unknown):
  | { ok: true; format: AudioFormat; mime: string }
  | { ok: false; status: number; error: string } {
  const mime = typeof contentType === 'string'
    ? contentType.split(';', 1)[0].toLowerCase().trim() : '';
  const format = MIME_FORMAT[mime];
  if (!format) {
    return { ok: false, status: 415, error: 'Format audio non pris en charge.' };
  }
  if (contentLength !== undefined) {
    if (typeof contentLength !== 'string' || !/^\d+$/.test(contentLength)) {
      return { ok: false, status: 400, error: 'Taille audio invalide.' };
    }
    if (Number(contentLength) > MAX_AUDIO_BYTES) {
      return { ok: false, status: 413, error: 'Fichier audio trop volumineux pour Vercel.' };
    }
  }
  return { ok: true, mime, format };
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

/** Check container signatures before sending private recording bytes upstream. */
export function isSupportedAudio(buffer: Uint8Array, format: AudioFormat): boolean {
  if (format === 'wav') return isWav(buffer);
  if (format === 'mp4' || format === 'm4a') {
    return buffer.length >= 12 &&
      buffer[4] === 0x66 && buffer[5] === 0x74 &&
      buffer[6] === 0x79 && buffer[7] === 0x70; // ftyp
  }
  if (format === 'mp3') {
    return buffer.length >= 3 &&
      ((buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
       (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
  }
  const signatures: Record<'webm' | 'ogg' | 'flac', number[]> = {
    webm: [0x1a, 0x45, 0xdf, 0xa3], // EBML
    ogg: [0x4f, 0x67, 0x67, 0x53],  // OggS
    flac: [0x66, 0x4c, 0x61, 0x43], // fLaC
  };
  const signature = signatures[format];
  return buffer.length >= signature.length &&
    signature.every((byte, index) => buffer[index] === byte);
}

export function publicTranscriptionError(status: number): { status: number; error: string } {
  // Do not expose Groq response bodies: providers can include private metadata.
  if (status === 429) return { status: 429, error: 'Transcription limitée. Réessayez plus tard.' };
  return { status: 502, error: 'Service de transcription momentanément indisponible.' };
}
