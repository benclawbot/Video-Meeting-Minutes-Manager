/** Keep direct uploads below Vercel Functions' 4.5 MB body limit. */
export const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

/** Files not eligible for a direct upload are processed into short WAV chunks. */
export function getDirectUploadMime(file: Pick<File, 'name' | 'size'>): string | null {
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > DIRECT_UPLOAD_MAX_BYTES) {
    return null;
  }
  const extension = file.name.toLowerCase().split('.').pop() || '';
  return MIME_BY_EXTENSION[extension] ?? null;
}
