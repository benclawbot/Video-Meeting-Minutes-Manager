# Templates + WYSIWYG Preview — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le template Classic Executive + améliorer les contrastes таблиц sur Corporate et Modern + preview WYSIWYG A4 à l'échelle réelle.

**Architecture:** 3 fichiers à modifier en parallèle. Les thèmes CSS dans MarkdownRenderer et les styles DOCX dans docxService sont séparés mais utilisent la même palette. La structure de données est identique — seul le thème change.

**Tech Stack:** TypeScript, React (MarkdownRenderer), docx (npm), CSS (Tailwind inline)

---

## Map des fichiers

| Fichier | Responsabilité |
|---|---|
| `types.ts` | Ajouter `'executive'` à `DocxTemplateId` |
| `components/MarkdownRenderer.tsx` | Ajouter thème `executive` + améliorer corporate/modern |
| `services/docxService.ts` | Ajouter template `executive` + améliorer corporate/modern |

**À lire avant de commencer :**
- `types.ts`
- `components/MarkdownRenderer.tsx:1-51` (objets THEMES)
- `services/docxService.ts:28-59` (objet TEMPLATES)
- `docs/superpowers/specs/2026-04-22-templates-design.md`

---

### Task 1: Ajouter `'executive'` au type `DocxTemplateId`

**Fichier:** `types.ts`

- [ ] **Step 1: Modifier le type**

```typescript
export type DocxTemplateId = 'corporate' | 'modern' | 'executive';
```

- [ ] **Step 2: Commit**

```bash
cd "Video-Meeting-Minutes-Manager"
git add types.ts
git commit -m "feat: add executive template ID to DocxTemplateId"
```

---

### Task 2: Mettre à jour `MarkdownRenderer` — Corporate et Modern (contrastes)

**Fichier:** `components/MarkdownRenderer.tsx`

À remplacer dans l'objet `THEMES` pour `corporate` et `modern` :

- [ ] **Step 1: Corporate — remplacer le block `table`**

Remplacer le block `corporate.table` actuel (lignes ~20-28) par :
```typescript
table: {
  container: "my-6 rounded-sm overflow-hidden border border-slate-300",
  table: "w-full text-left text-sm border-collapse",
  thead: "bg-slate-800 text-white",
  th: "px-4 py-3 font-bold text-xs uppercase tracking-wider border-r border-slate-700 last:border-r-0 border-b border-slate-700",
  tbody: "bg-white",
  tr: "border-b border-slate-200 last:border-b-0",
  td: "px-4 py-3 border-r border-slate-200 last:border-r-0 align-top text-black"
}
```

Et ajouter le sélecteur `:nth-child(even)` dans les classes. Dans `parseMarkdown`, modifier le rendu des lignes de tableau pour ajouter `idx % 2 === 0` :

Dans la fonction `parseMarkdown`, remplacer le rendu `<tr>` :
```typescript
{rows.slice(1).map((row, rowIdx) => (
  <tr key={rowIdx} className={`${theme.table.tr} ${rowIdx % 2 === 1 ? theme.table.trEven : ''}`}>
```

Créer `trEven` dans chaque thème :
```typescript
trEven: "bg-slate-50", // corporate
```

- [ ] **Step 2: Modern — remplacer le block `table`**

Remplacer le block `modern.table` actuel par :
```typescript
table: {
  container: "my-8 rounded-lg overflow-hidden shadow-lg ring-1 ring-slate-100",
  table: "w-full text-left text-sm",
  thead: "bg-sky-900 text-white",
  th: "px-6 py-3 text-xs font-bold uppercase tracking-wider",
  tbody: "bg-white",
  tr: "border-b border-sky-100 last:border-0",
  td: "px-6 py-3 text-slate-600 align-top"
}
```

Ajouter `trEven` :
```typescript
trEven: "bg-sky-50", // modern
```

- [ ] **Step 3: Ajouter la fonction de rendu `trEven`**

Dans la fonction `parseMarkdown`, avant la boucle `while`, ajouter :
```typescript
const renderRowClass = (rowIdx: number, theme: typeof THEMES.corporate) => {
  const base = theme.table.tr;
  return rowIdx % 2 === 1 ? `${base} ${(theme as any).table.trEven || ''}` : base;
};
```

Et modifier le rendu des lignes de body :
```typescript
{rows.slice(1).map((row, rowIdx) => (
  <tr key={rowIdx} className={renderRowClass(rowIdx, theme)}>
```

- [ ] **Step 4: Commit**

```bash
git add components/MarkdownRenderer.tsx
git commit -m "feat: improve table contrast — zebra striping + dark headers
- Corporate: header slate-800, zebra slate-50
- Modern: header sky-900, zebra sky-50
- Add trEven variants for alternating rows"
```

---

### Task 3: Ajouter le thème `executive` dans `MarkdownRenderer`

**Fichier:** `components/MarkdownRenderer.tsx`

- [ ] **Step 1: Ajouter le bloc `executive` après `modern` dans THEMES**

```typescript
executive: {
  page: "bg-white shadow-2xl w-full max-w-[21cm] mx-auto p-12 min-h-[29.7cm] font-sans text-slate-900",
  h1: "text-3xl font-extrabold text-slate-800 mb-8 pb-4 border-b-2 border-slate-800",
  h2: "text-xl font-bold text-slate-800 mt-8 mb-4",
  h3: "text-lg font-semibold text-slate-800 mt-6 mb-2",
  p: "text-black mb-4 leading-relaxed text-justify",
  liItem: "flex items-start mb-2",
  liMarker: "text-amber-600 mr-2 mt-1.5 text-[0.6em] •",
  liText: "text-black",
  strong: "font-bold text-slate-800",
  table: {
    container: "my-6 rounded overflow-hidden border border-slate-300 shadow",
    table: "w-full text-left text-sm border-collapse",
    thead: "bg-slate-800 text-white",
    th: "px-4 py-3 font-bold text-xs uppercase tracking-wider border-r border-slate-700 last:border-r-0 border-b border-slate-700",
    tbody: "bg-white",
    tr: "border-b border-slate-200 last:border-b-0",
    trEven: "bg-slate-50",
    td: "px-4 py-3 border-r border-slate-200 last:border-r-0 align-top text-black"
  }
}
```

- [ ] **Step 2: Ajuster le rendu des bullet points dans Executive**

Le marker utilise `•` avec couleur amber `#c9a84c` pour l'accent or. Le sélecteur dans `parseMarkdown` :
```typescript
{template === 'corporate' ? (
  <span className={theme.liMarker}>●</span>
) : template === 'modern' ? (
  <div className={theme.liMarker}></div>
) : (
  <span className={theme.liMarker}>●</span>
)}
```

- [ ] **Step 3: Build de vérification**

```bash
npm run build 2>&1 | grep -E "(error|Error|✓ built)"
```
Attendu : `✓ built` sans erreur.

- [ ] **Step 4: Commit**

```bash
git add components/MarkdownRenderer.tsx
git commit -m "feat: add executive template theme
- Dark navy header (#1e3a5f) with white text
- Gold accent markers (#c9a84c)
- Zebra striping for table rows
- Full A4 page preview at scale"
```

---

### Task 4: Ajouter le template `executive` dans `docxService`

**Fichier:** `services/docxService.ts`

- [ ] **Step 1: Ajouter le bloc `executive` dans TEMPLATES**

Ajouter après `modern` (lignes ~44-59) :

```typescript
executive: {
  id: 'executive',
  name: 'Classic Executive',
  fonts: { body: "Calibri", heading: "Calibri" },
  colors: {
    headerBg: "1e3a5f", // bleu marine
    headerText: "FFFFFF",
    rowText: "000000",
    border: "d0d8e0",
    title: "1e3a5f",
    subtitle: "1e3a5f"
  },
  borders: { style: BorderStyle.SINGLE, size: 4, color: "d0d8e0" },
  headerTransform: 'uppercase',
  rowEven: true // pour zebra striping dans le renderer DOCX
}
```

- [ ] **Step 2: Améliorer Corporate dans docxService — header contrast**

Dans le bloc `corporate.colors` :
```typescript
colors: {
  headerBg: "1e293b", // slate-800 (était "F1F5F9")
  headerText: "FFFFFF", // blanc (était "000000")
  rowText: "000000",
  border: "e2e8f0",
  title: "1e293b",
  subtitle: "1e293b"
},
```

- [ ] **Step 3: Améliorer Modern dans docxService — header contrast**

Dans le bloc `modern.colors` :
```typescript
colors: {
  headerBg: "0c4a6e", // sky-900 (était "0ea5e9")
  headerText: "FFFFFF",
  rowText: "1e293b",
  border: "bae6fd",
  title: "0ea5e9",
  subtitle: "0284c7"
},
```

- [ ] **Step 4: Build de vérification**

```bash
npm run build 2>&1 | grep -E "(error|Error|✓ built)"
```
Attendu : `✓ built` sans erreur.

- [ ] **Step 5: Commit**

```bash
git add services/docxService.ts
git commit -m "feat: add executive DOCX template + improve table contrast
- Executive: navy header (#1e3a5f), gold accents
- Corporate: dark slate header, zebra striping
- Modern: deep sky-900 header for better contrast
- Add rowEven flag for DOCX table rendering"
```

---

### Task 5: Vérifier que le selector de template affiche 3 options

**Fichier:** `App.tsx`

- [ ] **Step 1: Vérifier que la liste `templates` contient 3 entrées**

Rechercher dans `App.tsx` la variable `templates` :

```typescript
const templates: {id: DocxTemplateId, name: string, color: string}[] = [
  { id: 'corporate', name: 'Corporate', color: 'bg-slate-700' },
  { id: 'modern', name: 'Modern', color: 'bg-sky-500' },
  { id: 'executive', name: 'Executive', color: 'bg-slate-800' },
];
```

Ajouter la ligne `executive` si elle n'existe pas.

- [ ] **Step 2: Build de vérification**

```bash
npm run build 2>&1 | grep -E "(error|Error|✓ built)"
```
Attendu : `✓ built` sans erreur.

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat: add executive template to UI selector"
```

---

## Spec coverage

| Exigence spec | Task |
|---|---|
| Corporate amélioré (zebra + header contrast) | Task 2 |
| Modern amélioré (zebra + header contrast) | Task 2 |
| Executive nouveau | Task 3 (MarkdownRenderer) + Task 4 (docxService) |
| Type `executive` ajouté | Task 1 |
| Selector UI 3 options | Task 5 |
| Preview A4 à l'échelle | Task 3 (max-w-[21cm]) |

## Placeholder scan

Aucun TBD/TODO. Chaque step contient du code concret ou une commande vérifiable.

## Type consistency

- `DocxTemplateId` dans `types.ts` → string literal `'executive'` ajouté (Task 1)
- `theme.table.trEven` → chaîne optionnelle, appelée dans `renderRowClass` (Task 2)
- Palette hex 6 caractères是一致的 dans MarkdownRenderer et docxService
