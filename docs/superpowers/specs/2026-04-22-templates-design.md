# Spec — Templates + WYSIWYG Preview (Phase 2)

**Date**: 2026-04-22
**Projet**: Video Meeting Minutes Manager
**Phase**: 2/2 (Sortie après Transcription)

---

## Objectif

Améliorer la qualité de sortie : 3 templates DOCX avec contrastes таблиц lisibles + preview WYSIWYG à l'échelle A4 réelle.

---

## 3 templates

### Corporate (amélioré)

| Élément | Valeur |
|---|---|
| Header tableau BG | `#1e293b` (slate-800) |
| Header tableau Texte | blanc bold |
| Zebra | blanc / `#f8fafc` (slate-50) |
| Bordures | `#e2e8f0` |
| Titre H1 | `#1e293b` bold 800 |
| Sous-titres H2 | `#1e293b` bold 700 |
| Corps | `#1a1a1a` justifié |

### Modern (amélioré)

| Élément | Valeur |
|---|---|
| Header tableau BG | `#0c4a6e` (sky-900 — plus contrasté que sky-500) |
| Header tableau Texte | blanc bold |
| Zebra | blanc / `#f0f9ff` (sky-50) |
| Bordures | `#bae6fd` |
| Titre H1 | `#0ea5e9` bold 800 |
| Sous-titres H2 | `#0c4a6e` bold 700, underline accent `#0ea5e9` |
| Corps | `#475569` |

### Classic Executive (nouveau)

| Élément | Valeur |
|---|---|
| Header tableau BG | `#1e3a5f` (bleu marine) |
| Header tableau Texte | blanc bold |
| Zebra | blanc / `#f0f4f8` |
| Bordures | `#d0d8e0` |
| Accent or | `#c9a84c` (titre highlights) |
| Titre H1 | `#1e3a5f` bold 800, accent or sur subtitle |
| Sous-titres H2 | `#1e3a5f` bold 700 |
| Corps | `#1a1a1a` justifié |

---

## Zebra striping — justification

Tous les tableaux utilisent du zebra striping (lignes alternées) pour guider l'œil sur les longues listes d'actions. Améliore significativement la lisibilité par rapport aux lignes sans distinction.

---

## WYSIWYG Preview — A4 échelle réelle

**Implémentation :** `MarkdownRenderer` affiche le document en `21cm × 29.7cm` (A4) via `bg-white shadow-2xl w-full max-w-[21cm]` centré dans le panel de preview. Pas de scroll horizontal — le document est à l'échelle dans les 2 sens.

Le même composant `MarkdownRenderer` sert pour le preview ET pour générer les styles CSS injectés dans les templates DOCX.

---

## Fichiers à modifier

| Fichier | Changement |
|---|---|
| `types.ts` | Ajouter `'executive'` à `DocxTemplateId` |
| `components/MarkdownRenderer.tsx` | Ajouter thème `executive` dans `THEMES` + améliorer corporate et modern (zebra + header contrast) |
| `services/docxService.ts` | Ajouter template `executive` dans `TEMPLATES` avec palette ci-dessus |

---

## Pas dans le scope

- Formats d'export autres que DOCX
- Modification du prompt MiniMax
- Refonte UI du selector de template
- Diarization

---

## Spec coverage

| Exigence | Fichier |
|---|---|
| Template `corporate` amélioré (zebra + header contrast) | MarkdownRenderer + docxService |
| Template `modern` amélioré (zebra + header contrast) | MarkdownRenderer + docxService |
| Template `executive` nouveau (bleu marine + or) | MarkdownRenderer + docxService |
| Zebra striping sur tous les tableaux | MarkdownRenderer + docxService |
| Preview A4 échelle réelle | MarkdownRenderer |
| Type `executive` ajouté | types.ts |
