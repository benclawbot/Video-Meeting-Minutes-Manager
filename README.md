# Video Meeting Minutes Manager

Video Meeting Minutes Manager is a browser-based meeting summarization tool that turns a recorded meeting into a structured French meeting report and exports it as a styled DOCX document.

It accepts video or audio uploads, transcribes the content, generates minutes, and lets you download the result using selectable document templates.

## What it does

- Uploads a meeting recording as video or audio (`M4A` supported)
- Extracts and resamples audio in the browser
- Transcribes the recording with Groq Whisper Large v3 through `/api/transcribe`
- Generates a structured meeting report (French or English) through MiniMax M2.5 through `/api/analyze`
- Produces a Markdown preview inside the app
- Exports the final report to DOCX with multiple document styles

## Processing Pipeline

1. Extract audio from the uploaded media file
2. Resample and chunk long recordings
3. Transcribe each chunk with Groq Whisper Large v3
4. Merge the transcript
5. Generate structured minutes in the selected language
6. Export the result as DOCX

## Quick Start

Prerequisites:
- Node.js
- `MINIMAX_API_KEY` in `.env.local` or in Vercel project environment variables
- `GROQ_API_KEY` in `.env.local` or in Vercel project environment variables

Run locally:

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

Deploy to Vercel:

1. Import the repository as a Vite project.
2. Use `npm run build` as the build command.
3. Use `dist` as the output directory.
4. Add `MINIMAX_API_KEY` and `GROQ_API_KEY` to the Vercel project environment variables.

## Supported Output

The generated minutes are structured around:

- Meeting title as the document H1
- Executive summary / Résumé exécutif
- Participants
- Key discussion points / Points clés discutés
- Decisions made / Décisions prises
- Action items in a Markdown table
- Next meeting / Prochaine réunion

The DOCX exporter supports:

- Corporate
- Modern
- Executive
- Briefing, a warm editorial template inspired by the approved Anthropic-style reference

Minutes can be generated in French or English from the frontend language toggle. French is the default.

## Project Structure

- `App.tsx` — upload flow, analysis states, preview UI
- `services/geminiService.ts` — transcription + analysis pipeline
- `services/docxService.ts` — DOCX generation and template styling
- `components/` — buttons, inputs, Markdown rendering
- `types.ts` — shared models and export types

## Status

Prototype focused on meeting-to-minutes conversion for French-language workflows. The UI is already usable as a single-user tool, with Vercel API routes for transcription and minutes generation.
