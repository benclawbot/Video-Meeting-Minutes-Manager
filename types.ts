export interface MeetingDetails {
  title: string;
  date: string;
}

export interface AnalysisResult {
  minutes: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  EXTRACTING_AUDIO = 'EXTRACTING_AUDIO',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface MediaFile {
  file: File;
  previewUrl: string;
  isAudioOnly: boolean;
}

export type DocxTemplateId = 'corporate' | 'modern';