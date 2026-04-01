// Whisper transcription using @xenova/transformers (WASM-based, runs entirely in browser)
// FREE, no API key needed, works with pre-recorded audio files

import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: any = null;

const getTranscriber = async () => {
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      device: 'webgpu',
      progress_callback: (progress: any) => {
        if (progress.status === 'progress') {
          console.log(`Loading Whisper: ${Math.round(progress.progress)}%`);
        }
      }
    });
  }
  return transcriber;
};

export interface TranscriptionResult {
  text: string;
  success: boolean;
  error?: string;
}

export const transcribeAudio = async (
  mediaFile: File,
  onProgress?: (status: string) => void
): Promise<TranscriptionResult> => {
  try {
    if (onProgress) onProgress('LOADING_WHISPER');
    
    const transcriber = await getTranscriber();
    if (onProgress) onProgress('TRANSCRIBING');

    const arrayBuffer = await mediaFile.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const sampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * sampleRate, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    
    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);
    
    const int16Array = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      int16Array[i] = Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF;
    }

    const audioData = { array: int16Array, sample_rate: sampleRate };

    const result = await transcriber(audioData, {
      language: 'french',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    if (result && result.text) {
      return { success: true, text: result.text.trim() };
    }

    return {
      success: false,
      text: '',
      error: 'Aucun texte transcrit. L\'audio semble vide ou non reconnaissable.'
    };
  } catch (error: any) {
    console.error('Whisper error:', error);
    
    if (error.message?.includes('WebGPU')) {
      return {
        success: false,
        text: '',
        error: 'WebGPU non disponible. Utilisez Chrome ou Edge.'
      };
    }
    
    return {
      success: false,
      text: '',
      error: error.message || 'Erreur lors de la transcription.'
    };
  }
};
