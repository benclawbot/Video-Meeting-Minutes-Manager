# Spec — Transcription silencieuse (Phase 1)

**Date**: 2026-04-22
**Projet**: Video Meeting Minutes Manager
**Phase**: 1/2 (Transcription → Sortie après)

---

## Problème

Réunions de 1h+ : passages aléatoires manquants dans le compte rendu. Cause : `extractAndOptimizeAudio` resample tout le fichier à bitrate fixe (~12MB target), sans segmentation intelligente. Les fichiers trop gros ou dégradés causent des trous dans la transcription.

## Objectif

Découper l'audio par silences naturels pour que chaque segment transcriptionné soit cohérent et complet. Aucun passage coupé.

---

## Architecture

### Flux actuel (problématique)

```
mediaFile → decodeAudio → resample global → 1 blob → Groq → transcript → MiniMax
```

### Nouveau flux

```
mediaFile → decodeAudio → samples[]
  → detectSilenceSegments() → AudioSegment[]
    → pour chaque segment:
        → resample individual → WAV 16-bit
        → Groq transcription
        → concat transcription
  → MiniMax generation
```

---

## Détails d'implémentation

### 1. `encodeWav16Bit` (màj)

- 16-bit PCM au lieu de 8-bit
- Mono, sample rate variable
- Blob WAV standard

### 2. `detectSilenceSegments(samples, sampleRate, minSilenceSecs, silenceThreshold)`

**Paramètres**:
- `minSilenceSecs = 1.5` — silences >= 1.5s = nouvelle frontière
- `silenceThreshold = 0.01` — amplitude RMS en dessous = silence

**Algorithme**:
1. Glisser sur les samples
2. Détecter runs de silence (`|sample| < threshold`)
3. Si run >= `minSilenceSamples` et sample non-silence suit → nouvelle frontière
4. Ajouter le dernier segment

**Fallback**: si aucun silence détecté (parole continue) → retourner 1 segment couvrant tout.

**Retour**: `AudioSegment[]` avec `{startSample, endSample}`

### 3. Transcription séquentielle

- Chaque chunk → `OfflineAudioContext` pour resampling propre
- Sortie : 16kHz 16-bit mono WAV
- Groq `whisper-large-v3` (API OpenAI-compatible via proxy Groq)
- Erreur 413 sur un chunk → subdiviser en 2 (non implémenté v1, log warning)

### 4. Fusion des transcriptions

- `transcriptionParts.join(" ")` — concatenation simple
- Chunks vides → ignorés (log warning)

### 5. Statuts UI

Nouveaux status dans `AnalysisStatus` :
- `EXTRACTING_AUDIO` — décodage audio
- `UPLOADING` — transcription des chunks
- `PROCESSING` — génération MiniMax

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `services/geminiService.ts` | Refactor complet du pipeline STT |
| `types.ts` | Aucun changement |
| `App.tsx` | Aucun changement (statuts string passent) |
| `vite.config.ts` | Merge des configs upstream (proxy Groq + MiniMax) |

---

## Choix techniques

- **16-bit PCM** au lieu de 8-bit : meilleure qualité pour Whisper
- **16kHz** pour le resampling : optimal pour Whisper (pas 8kHz)
- **Séquentiel** (pas parallèle) : garantit l'ordre de la transcription
- **Fallback silence** : si parole continue, 1 seul segment = comportement original
- **`import.meta.env`** : compatible Vite (plus de `process.env`)

---

## Tests manuels à vérifier

1. Réunion 15 min (1 seul segment probable) → transcription OK
2. Réunion 1h+ avec silences → plusieurs segments → concat correcte
3. Réunion sans silences (parole continue 1h) → 1 segment → resample à 16kHz → OK
4. Erreur 413 sur chunk → message clair sans crash
5. Transcription Vide sur 1 chunk → ignoré, reste des autres

---

## Scope exclu (Phase 2)

- Templates de sortie DOCX
- Nouveaux formats d'export
- Amélioration du prompt MiniMax
- Diarization (identification des locuteurs)
