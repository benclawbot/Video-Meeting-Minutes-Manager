export interface MeetingDetails {
  title: string;
  date: string;
}

export interface AnalysisResult {
  minutes: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  LOADING_MODEL = 'LOADING_MODEL',
  EXTRACTING_AUDIO = 'EXTRACTING_AUDIO',
  TRANSCRIBING = 'TRANSCRIBING',
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