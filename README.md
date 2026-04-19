# Video Meeting Minutes Manager

Video Meeting Minutes Manager is a browser-based meeting summarization tool that turns a recorded meeting into a structured French meeting report and exports it as a styled DOCX document.

It accepts video or audio uploads, transcribes the content, generates minutes, and lets you download the result using selectable document templates.

## What it does

- Uploads a meeting recording as video or audio (`M4A` supported)
- Extracts and resamples audio in the browser
- Transcribes the recording with Deepgram `nova-2`
- Generates a French executive-style meeting report through MiniMax M2.7
- Produces a Markdown preview inside the app
- Exports the final report to DOCX with multiple document styles

## Processing Pipeline

1. Extract audio from the uploaded media file
2. Resample and chunk long recordings
3. Transcribe each chunk with Deepgram
4. Merge the transcript
5. Generate structured minutes in French
6. Export the result as DOCX

## Quick Start

Prerequisites:
- Node.js
- `VITE_DEEPGRAM_API_KEY` in `.env.local`
- A working proxy route for MiniMax at `/api/minimax`

Run locally:

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Supported Output

The generated minutes are structured around:

- Executive summary
- Key discussion points
- Decisions made
- Action items in a Markdown table

The DOCX exporter supports multiple visual templates, including a neutral corporate layout and a more modern blue-styled layout.

## Project Structure

- `App.tsx` — upload flow, analysis states, preview UI
- `services/geminiService.ts` — transcription + analysis pipeline
- `services/docxService.ts` — DOCX generation and template styling
- `components/` — buttons, inputs, Markdown rendering
- `types.ts` — shared models and export types

## Status

Prototype focused on meeting-to-minutes conversion for French-language workflows. The UI is already usable as a single-user tool, but deployment still depends on correct API and proxy configuration.
