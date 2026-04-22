# Transcription silencieuse — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper l'audio par silences naturels avant transcription pour éliminer les passages manquants sur réunions longues.

**Architecture:** Pipeline STT refactoré en 3 phases — decode audio → segmentation par silence → transcription chunk par chunk → fusion. Chaque chunk est resamplé individuellement à 16kHz 16-bit PCM avant envoi à Groq Whisper.

**Tech Stack:** TypeScript, Web Audio API (OfflineAudioContext), Groq API (whisper-large-v3), MiniMax M2.5, Vite

---

## Contexte

Le code de `services/geminiService.ts` a déjà été modifié dans la session en cours — merge des conflits résolu + implémentation initiale du chunking par silence. Ce plan documente les étapes pour finaliser, nettoyer et vérifier l'implémentation. Aucun test unitaire n'existe dans ce projet (pas de framework détecté) — la validation se fait manuellement.

---

## Fichier unique à modifier

- `services/geminiService.ts` — refactor complet du pipeline STT

---

### Task 1: Auditer l'état actuel du pipeline

**Fichier:** `services/geminiService.ts`

- [ ] **Step 1: Lire le fichier actuel**

Ouvrir `services/geminiService.ts` et vérifier que les fonctions suivantes sont présentes :
- `encodeWav16Bit` — 16-bit PCM mono WAV
- `resampleAudio` — OfflineAudioContext resampling
- `detectSilenceSegments` — retour `AudioSegment[]` avec `{startSample, endSample}`
- `analyzeMeetingVideo` — pipeline séquentiel avec chunks

- [ ] **Step 2: Vérifier le typage AudioBuffer**

Dans `resampleAudio`, s'assurer que `audioBuffer` est de type `AudioBuffer` (pas de type `any`). Si un cast `as unknown as AudioBuffer` traîne, le remplacer par une construction propre.

Le pattern propre pour resampler un chunk :
```typescript
const chunkCtx = new OfflineAudioContext(1, Math.ceil(chunkDuration * TARGET_RATE), TARGET_RATE);
const chunkAudioBuffer = chunkCtx.createBuffer(1, chunkSamples.length, sampleRate);
chunkAudioBuffer.getChannelData(0).set(chunkSamples);
const source = chunkCtx.createBufferSource();
source.buffer = chunkAudioBuffer;
source.connect(chunkCtx.destination);
source.start();
const resampledBuffer = await chunkCtx.startRendering();
```

- [ ] **Step 3: Vérifier l'ordre des statuts**

`services/geminiService.ts:onStatusChange` appelé dans cet ordre :
1. `EXTRACTING_AUDIO` — après `decodeAudioData`
2. `UPLOADING` — avant la boucle de transcription des chunks
3. `PROCESSING` — avant l'appel MiniMax

Si `TRANSCRIBING` ou `RESAMPLING_AUDIO` apparaissent, les supprimer ou les mapper vers les statuts existants (`EXTRACTING_AUDIO`, `UPLOADING`, `PROCESSING`).

- [ ] **Step 4: Commit**

```bash
git add services/geminiService.ts
git commit -m "feat: refactor STT pipeline with silence-based chunking
- Add detectSilenceSegments() for natural speech segmentation
- Encode 16-bit PCM instead of 8-bit for better Whisper quality
- Resample each chunk to 16kHz individually
- Sequential transcription with graceful chunk failure handling"
```

---

### Task 2: Valider les types et l'interface AnalysisStatus

**Fichier:** `types.ts`

- [ ] **Step 1: Vérifier les statuts disponibles**

Lire `types.ts`. Les statuts utilisés dans `App.tsx` incluent : `IDLE`, `EXTRACTING_AUDIO`, `UPLOADING`, `PROCESSING`, `COMPLETED`, `ERROR`. Vérifier que tous sont définis dans `AnalysisStatus`.

Si `TRANSCRIBING` ou `RESAMPLING_AUDIO` manquent → ajouter à l'enum :
```typescript
EXTRACTING_AUDIO = 'EXTRACTING_AUDIO',
RESAMPLING_AUDIO = 'RESAMPLING_AUDIO',
TRANSCRIBING = 'TRANSCRIBING',
UPLOADING = 'UPLOADING',
```

- [ ] **Step 2: Vérifier DocxTemplateId**

`types.ts` contient `DocxTemplateId = 'corporate' | 'modern'`. C'est pour la phase 2 (sortie) — ne pas modifier pour l'instant.

- [ ] **Step 3: Commit si changement**

```bash
git add types.ts
git commit -m "chore: add TRANSCRIBING/RESAMPLING_AUDIO to AnalysisStatus enum"
```

---

### Task 3: Vérifier vite.config.ts et les variables d'environnement

**Fichier:** `vite.config.ts`

- [ ] **Step 1: Vérifier les proxies**

`vite.config.ts` doit contenir deux proxies :
- `/minimax-api` → `https://api.minimaxi.chat`
- `/groq-api` → `https://api.groq.com`

- [ ] **Step 2: Vérifier le define**

Vérifier que `vite.config.ts` définit :
```typescript
define: {
  'process.env.MINIMAX_API_KEY': JSON.stringify(env.MINIMAX_API_KEY),
  'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY),
}
```

- [ ] **Step 3: Vérifier .env.example**

Si `.env.example` n'existe pas ou ne contient pas les deux clés, créer/mettre à jour :

```bash
cat > .env.example << 'EOF'
MINIMAX_API_KEY=votre_cle_api_minimax
GROQ_API_KEY=votre_cle_api_groq
EOF
```

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts .env.example
git commit -m "chore: ensure Groq and MiniMax proxies + env vars configured"
```

---

### Task 4: Test manuel de bout en bout

**Pas de commande git — validation manuelle**

- [ ] **Step 1: Démarrer le dev server**

```bash
cd "Video-Meeting-Minutes-Manager"
npm run dev
```

- [ ] **Step 2: Tester avec audio court (< 5 min)**

Uploader un fichier audio/visio de moins de 5 minutes. Vérifier :
- Le statut affiche correctement (`Extraction...` → `Transcription...` → `Analyse...`)
- La transcription est complète et cohérente
- Le compte rendu est généré sans erreur

- [ ] **Step 3: Tester avec audio long (30 min+)**

Uploader un fichier de 30+ minutes avec silences naturels. Vérifier :
- Plusieurs chunks transcrits (console.log optionnel: `console.log(`Chunk ${idx+1}/${segments.length} transcrit`)`)
- La concaténation est fluide (pas de répétitions, pas de trous)
- Le compte rendu couvre bien toute la réunion

- [ ] **Step 4: Nettoyer les console.log de debug**

Après validation, supprimer tout `console.log` ajouté pour le debug.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "fix: silence-based chunking validated — no random missing passages
- Tested with short (<5 min) and long (30+ min) recordings
- All chunks transcribed in sequence and concatenated correctly
- Remove debug console.logs"
```

---

### Task 5: Pousser sur GitHub

- [ ] **Step 1: Vérifier l'état git**

```bash
git status
git log --oneline -3
```

- [ ] **Step 2: Push**

```bash
git push origin main
```

---

## Spec coverage

| Exigence spec | Task |
|---|---|
| `encodeWav16Bit` 16-bit PCM | Task 1 |
| `detectSilenceSegments` avec `minSilenceSecs=1.5` | Task 1 |
| Fallback 1 segment si parole continue | Task 1 |
| Resampling 16kHz par chunk | Task 1 |
| Transcription séquentielle Groq | Task 1 |
| Gestion erreur 413 | Task 1 |
| Statuts UI corrects | Task 2 |
| Proxies Vite (Groq + MiniMax) | Task 3 |
| Validation manuelle E2E | Task 4 |

## Placeholder scan

Aucun TBD/TODO dans ce plan. Chaque step contient du code concret ou une commande vérifiable.

## Type consistency

- `AudioSegment` défini dans Task 1 avec `{startSample: number, endSample: number}` — utilisé dans la boucle de transcription.
- `TARGET_RATE = 16000` — constant, utilisé uniformément.
- `AnalysisStatus` dans `types.ts` — aligné avec les chaînes envoyées par `geminiService.ts`.
