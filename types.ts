export interface MeetingDetails {
  title: string;
  date: string;
}

export interface AnalysisResult {
  minutes: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface VideoFile {
  file: File;
  previewUrl: string;
}