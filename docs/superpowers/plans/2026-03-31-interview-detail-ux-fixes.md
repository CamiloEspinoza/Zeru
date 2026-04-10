# Interview Detail UX Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs and UX issues in the interview detail page, add question tracking (checkmarks, discard), and auto-collapse question guide when audio exists.

**Architecture:** Fixes center on the question guide system (persistence bug, new interactive features), cleanup of duplicate audio UI, and making the question card collapsible. All changes are in the frontend (`apps/web`) except the question persistence fix which touches backend data shape.

**Tech Stack:** Next.js (app router), React, shadcn/ui (Collapsible, Checkbox, Card), HugeIcons, Prisma (backend), NestJS.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/modules/org-intelligence/services/interview-questions.service.ts` | Modify (line 154) | Fix data shape saved to DB |
| `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx` | Modify | Fix load logic, remove legacy upload, make question guide collapsible |
| `apps/web/components/org-intelligence/interview-questions-view.tsx` | Modify | Remove KnowledgeSummary, add checked/discarded state, persist edits |
| `apps/web/components/org-intelligence/interview-question-card.tsx` | Modify | Add checkbox, discard button, done styling |
| `apps/web/components/org-intelligence/interview-question-group.tsx` | Modify | Pass through checked/discard props |
| `apps/web/components/org-intelligence/interview-knowledge-summary.tsx` | No change | Moved in page.tsx, component unchanged |

---

### Task 1: Fix question persistence — backend data shape

**Files:**
- Modify: `apps/api/src/modules/org-intelligence/services/interview-questions.service.ts:150-157`

- [ ] **Step 1: Fix the data saved to DB**

The backend saves only `parsed.sections` (array) to `generatedQuestions`, but the frontend expects `{ introText, sections }`. Fix the backend to save the full structure:

```typescript
// interview-questions.service.ts, lines 150-157
// BEFORE:
const updatedInterview = await client.interview.update({
  where: { id: interviewId },
  data: {
    generatedIntro: parsed.introText,
    generatedQuestions: parsed.sections as unknown as Record<string, unknown>[],
    questionsGeneratedAt: new Date(),
  },
});

// AFTER:
const updatedInterview = await client.interview.update({
  where: { id: interviewId },
  data: {
    generatedIntro: parsed.introText,
    generatedQuestions: {
      introText: parsed.introText,
      sections: parsed.sections,
    } as unknown as Record<string, unknown>,
    questionsGeneratedAt: new Date(),
  },
});
```

- [ ] **Step 2: Also fix the updateQuestions method (line 189-193)**

When a user edits questions, the sections are saved without `introText`. Fix to preserve the intro:

```typescript
// interview-questions.service.ts, lines 189-193
// BEFORE:
return client.interview.update({
  where: { id: interviewId },
  data: {
    generatedQuestions: sections as unknown as Record<string, unknown>[],
  },
  select: {
    id: true,
    generatedQuestions: true,
    questionsGeneratedAt: true,
  },
});

// AFTER:
return client.interview.update({
  where: { id: interviewId },
  data: {
    generatedQuestions: {
      introText: interview.generatedIntro ?? '',
      sections,
    } as unknown as Record<string, unknown>,
  },
  select: {
    id: true,
    generatedQuestions: true,
    questionsGeneratedAt: true,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/org-intelligence/services/interview-questions.service.ts
git commit -m "fix(org-intelligence): save generatedQuestions as {introText, sections} for correct frontend loading"
```

---

### Task 2: Remove legacy audio upload and fix frontend question loading

**Files:**
- Modify: `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`

- [ ] **Step 1: Fix question loading in fetchInterview**

```typescript
// page.tsx, lines 190-193
// BEFORE:
if (res.generatedQuestions) {
  setGeneratedIntroText(res.generatedQuestions.introText ?? "");
  setGeneratedSections(res.generatedQuestions.sections ?? []);
}

// AFTER:
if (res.generatedQuestions) {
  const gq = res.generatedQuestions as { introText?: string; sections?: typeof generatedSections };
  setGeneratedIntroText(gq.introText ?? res.generatedIntro ?? "");
  setGeneratedSections(gq.sections ?? []);
}
```

- [ ] **Step 2: Remove legacy audio upload card (lines 750-811)**

Delete the entire block from `{/* Legacy Audio Upload (drag & drop) */}` through its closing `</Card>` and `)}`.

Also remove the `showUpload` variable (line 671) since it's no longer used, and remove state variables `dragOver`, `fileInputRef`, `uploading`, `uploadProgress`, and the `handleFileUpload`, `handleDrop` functions that are only used by the legacy card. Keep only `InterviewAudioStep`.

Remove these unused state declarations:
```typescript
// DELETE these lines:
const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [dragOver, setDragOver] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
```

Remove the `handleFileUpload` function (lines 375-427) and `handleDrop` function (lines 429-434).

Remove `showUpload` from line 671.

Remove the `MAX_FILE_SIZE_MB`, `ALLOWED_AUDIO_TYPES`, and `ALLOWED_EXTENSIONS` constants (lines 368-374) — those validations should be in `InterviewAudioStep` if needed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx
git commit -m "fix(org-intelligence): remove duplicate audio upload, fix question loading from DB"
```

---

### Task 3: Move InterviewKnowledgeSummary out of question guide

**Files:**
- Modify: `apps/web/components/org-intelligence/interview-questions-view.tsx`
- Modify: `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`

- [ ] **Step 1: Remove InterviewKnowledgeSummary from InterviewQuestionsView**

```typescript
// interview-questions-view.tsx
// BEFORE (line 5):
import { InterviewKnowledgeSummary } from "./interview-knowledge-summary";

// DELETE that import

// BEFORE (line 49):
{!has && <InterviewKnowledgeSummary projectId={projectId} />}

// DELETE that line

// Also remove projectId from Props interface and function params:
// BEFORE:
interface Props { introText?: string; sections?: Section[]; interviewId: string; projectId: string; onQuestionsChange?: (s: Section[]) => void }

// AFTER:
interface Props { introText?: string; sections?: Section[]; interviewId: string; onQuestionsChange?: (s: Section[]) => void }
```

- [ ] **Step 2: In page.tsx, remove projectId prop from InterviewQuestionsView**

```typescript
// page.tsx, lines 733-739
// BEFORE:
<InterviewQuestionsView
  introText={generatedIntroText}
  sections={generatedSections}
  interviewId={interviewId}
  projectId={id}
  onQuestionsChange={(sections) => setGeneratedSections(sections)}
/>

// AFTER:
<InterviewQuestionsView
  introText={generatedIntroText}
  sections={generatedSections}
  interviewId={interviewId}
  onQuestionsChange={(sections) => setGeneratedSections(sections)}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/org-intelligence/interview-questions-view.tsx apps/web/app/\(dashboard\)/org-intelligence/projects/\[id\]/interviews/\[interviewId\]/page.tsx
git commit -m "fix(org-intelligence): remove InterviewKnowledgeSummary from question guide card"
```

---

### Task 4: Add checkbox marking and discard to question cards

**Files:**
- Modify: `apps/web/components/org-intelligence/interview-question-card.tsx`
- Modify: `apps/web/components/org-intelligence/interview-question-group.tsx`
- Modify: `apps/web/components/org-intelligence/interview-questions-view.tsx`

- [ ] **Step 1: Update InterviewQuestionCard with checkbox and discard**

Replace the full content of `interview-question-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

interface Question { text: string; rationale?: string; priority: string }
interface Props {
  question: Question;
  index: number;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onEdit?: (t: string) => void;
  onDelete?: () => void;
  onDiscard?: () => void;
}

const priorityLabels: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

const priorityStyles: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  LOW: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

export function InterviewQuestionCard({
  question,
  index,
  checked = false,
  onCheckedChange,
  onEdit,
  onDelete,
  onDiscard,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);

  const handleBlur = () => {
    setEditing(false);
    if (text !== question.text) onEdit?.(text);
  };

  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-2 text-sm transition-opacity ${
        checked ? "opacity-50" : ""
      }`}
    >
      {onCheckedChange && (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5 shrink-0"
          aria-label={`Marcar pregunta ${index + 1} como realizada`}
        />
      )}
      <span className="shrink-0 font-medium text-muted-foreground">
        {index + 1}.
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            className="w-full resize-none rounded border px-1 text-sm focus:outline-none"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            autoFocus
          />
        ) : (
          <p
            className={`leading-snug ${onEdit ? "cursor-text" : ""} ${
              checked ? "line-through" : ""
            }`}
            onClick={() => onEdit && !checked && setEditing(true)}
          >
            {question.text}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <Badge
            className={`text-[10px] ${priorityStyles[question.priority] ?? priorityStyles.LOW}`}
          >
            {priorityLabels[question.priority] ?? question.priority}
          </Badge>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onDiscard && !checked && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onDiscard}
            aria-label="Descartar pregunta"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update InterviewQuestionGroup to pass through new props**

Replace the full content of `interview-question-group.tsx`:

```tsx
"use client";

import { InterviewQuestionCard } from "./interview-question-card";

interface Question {
  text: string;
  rationale?: string;
  priority: string;
}

interface Props {
  theme: string;
  questions: Question[];
  checkedSet?: Set<string>;
  onCheckedChange?: (questionKey: string, checked: boolean) => void;
  onEditQuestion?: (index: number, text: string) => void;
  onDeleteQuestion?: (index: number) => void;
  onDiscardQuestion?: (index: number) => void;
}

export function InterviewQuestionGroup({
  theme,
  questions,
  checkedSet,
  onCheckedChange,
  onEditQuestion,
  onDeleteQuestion,
  onDiscardQuestion,
}: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{theme}</h3>
      <div className="space-y-1.5">
        {questions.map((q, i) => {
          const key = `${theme}::${i}`;
          return (
            <InterviewQuestionCard
              key={i}
              question={q}
              index={i}
              checked={checkedSet?.has(key) ?? false}
              onCheckedChange={
                onCheckedChange
                  ? (checked) => onCheckedChange(key, checked)
                  : undefined
              }
              onEdit={
                onEditQuestion ? (text) => onEditQuestion(i, text) : undefined
              }
              onDelete={
                onDeleteQuestion ? () => onDeleteQuestion(i) : undefined
              }
              onDiscard={
                onDiscardQuestion ? () => onDiscardQuestion(i) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update InterviewQuestionsView with checked state, discard, and auto-save**

Replace the full content of `interview-questions-view.tsx`:

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { InterviewGenerateButton } from "./interview-generate-button";
import { InterviewQuestionGroup } from "./interview-question-group";

type Question = { text: string; rationale?: string; priority: string };
type Section = { theme: string; questions: Question[] };

interface Props {
  introText?: string;
  sections?: Section[];
  interviewId: string;
  onQuestionsChange?: (s: Section[]) => void;
}

export function InterviewQuestionsView({
  introText: init,
  sections: initS,
  interviewId,
  onQuestionsChange,
}: Props) {
  const [intro, setIntro] = useState(init ?? "");
  const [sections, setSections] = useState<Section[]>(initS ?? []);
  const [downloading, setDownloading] = useState(false);
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(
    new Set(),
  );
  const has = sections.length > 0;

  // Debounced save to backend
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSections = useCallback(
    (updated: Section[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.patch(
            `/org-intelligence/interviews/${interviewId}/questions`,
            { sections: updated },
          );
        } catch {
          // silent — local state is source of truth during editing
        }
      }, 1500);
    },
    [interviewId],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const downloadPdf = async () => {
    const el = document.querySelector(
      ".print-container",
    ) as HTMLElement | null;
    if (!el) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      el.style.display = "block";
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: "guia-entrevista.pdf",
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
        })
        .from(el)
        .save();
      el.style.display = "";
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const update = (s: Section[]) => {
    setSections(s);
    onQuestionsChange?.(s);
    persistSections(s);
  };

  const onGen = (d: { introText: string; sections: Section[] }) => {
    setIntro(d.introText);
    setSections(d.sections);
    onQuestionsChange?.(d.sections);
    setCheckedQuestions(new Set());
  };

  const edit = (si: number, qi: number, text: string) =>
    update(
      sections.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              questions: s.questions.map((q, j) =>
                j !== qi ? q : { ...q, text },
              ),
            },
      ),
    );

  const discard = (si: number, qi: number) =>
    update(
      sections.map((s, i) =>
        i !== si
          ? s
          : { ...s, questions: s.questions.filter((_, j) => j !== qi) },
      ),
    );

  const handleCheckedChange = (key: string, checked: boolean) => {
    setCheckedQuestions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <InterviewGenerateButton
          interviewId={interviewId}
          onGenerated={onGen}
        />
        {has && (
          <Button
            variant="outline"
            onClick={downloadPdf}
            disabled={downloading}
          >
            {downloading ? "Generando PDF..." : "Descargar PDF"}
          </Button>
        )}
      </div>
      {has && (
        <div className="space-y-4">
          {intro && (
            <p className="text-sm text-muted-foreground">{intro}</p>
          )}
          {sections.map((s, si) => (
            <InterviewQuestionGroup
              key={si}
              theme={s.theme}
              questions={s.questions}
              checkedSet={checkedQuestions}
              onCheckedChange={handleCheckedChange}
              onEditQuestion={(qi, t) => edit(si, qi, t)}
              onDiscardQuestion={(qi) => discard(si, qi)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/org-intelligence/interview-question-card.tsx apps/web/components/org-intelligence/interview-question-group.tsx apps/web/components/org-intelligence/interview-questions-view.tsx
git commit -m "feat(org-intelligence): add question checkmarks, discard, Spanish priority labels, and auto-save"
```

---

### Task 5: Make question guide collapsible, auto-collapse when audio exists

**Files:**
- Modify: `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`

- [ ] **Step 1: Add Collapsible import and state**

Add imports at the top of page.tsx:

```typescript
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
```

Add a new import for an icon:

```typescript
// In the existing hugeicons imports or add new:
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
```

Add state variable near the other useState declarations:

```typescript
const [questionsOpen, setQuestionsOpen] = useState(!interview?.audioS3Key);
```

Note: This state is initialized AFTER interview is loaded, so it needs to be set in fetchInterview. Instead, use a ref-based approach:

```typescript
const [questionsOpen, setQuestionsOpen] = useState(true);
const questionsInitRef = useRef(false);
```

Then in fetchInterview, after `setInterview(res)`:

```typescript
if (!questionsInitRef.current) {
  questionsInitRef.current = true;
  setQuestionsOpen(!res.audioS3Key);
}
```

- [ ] **Step 2: Replace the Card with Collapsible Card for question guide**

Replace the question guide section (around lines 727-741):

```tsx
{/* Question Guide — collapsible, auto-collapsed when audio exists */}
<Collapsible open={questionsOpen} onOpenChange={setQuestionsOpen}>
  <Card>
    <CollapsibleTrigger asChild>
      <CardHeader className="cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <CardTitle>Guía de Preguntas</CardTitle>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={`size-4 text-muted-foreground transition-transform ${
              questionsOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </CardHeader>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <CardContent>
        <InterviewQuestionsView
          introText={generatedIntroText}
          sections={generatedSections}
          interviewId={interviewId}
          onQuestionsChange={(sections) => setGeneratedSections(sections)}
        />
      </CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>
```

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Fix any lint errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/org-intelligence/projects/\[id\]/interviews/\[interviewId\]/page.tsx
git commit -m "feat(org-intelligence): make question guide collapsible, auto-collapse when audio exists"
```

---

### Task 6: Fix remaining UX issues — edit dialog, objective, speaker delete

**Files:**
- Modify: `apps/web/components/org-intelligence/edit-interview-dialog.tsx`
- Modify: `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`

- [ ] **Step 1: Add date and objective fields to EditInterviewDialog**

Replace the full content of `edit-interview-dialog.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface EditInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (title: string) => void;
  interviewDate: string;
  onDateChange: (date: string) => void;
  objective: string;
  onObjectiveChange: (objective: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function EditInterviewDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  interviewDate,
  onDateChange,
  objective,
  onObjectiveChange,
  onSave,
  saving,
}: EditInterviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Entrevista</DialogTitle>
          <DialogDescription>
            Modifica los datos de la entrevista.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-interview-title">Título</Label>
            <Input
              id="edit-interview-title"
              placeholder="Título de la entrevista"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-interview-date">Fecha</Label>
            <Input
              id="edit-interview-date"
              type="date"
              value={interviewDate}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-interview-objective">Objetivo</Label>
            <Textarea
              id="edit-interview-objective"
              placeholder="¿Qué se busca obtener de esta entrevista?"
              value={objective}
              onChange={(e) => onObjectiveChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Update page.tsx — editForm state, openEditDialog, handleSaveEdit, and dialog props**

Update `editForm` state to include objective:

```typescript
// BEFORE:
const [editForm, setEditForm] = useState({ title: "", interviewDate: "" });

// AFTER:
const [editForm, setEditForm] = useState({ title: "", interviewDate: "", objective: "" });
```

Update `openEditDialog`:

```typescript
// BEFORE:
const openEditDialog = () => {
  if (!interview) return;
  setEditForm({
    title: interview.title ?? "",
    interviewDate: interview.interviewDate
      ? new Date(interview.interviewDate).toISOString().split("T")[0]
      : "",
  });
  setEditDialogOpen(true);
};

// AFTER:
const openEditDialog = () => {
  if (!interview) return;
  setEditForm({
    title: interview.title ?? "",
    interviewDate: interview.interviewDate
      ? new Date(interview.interviewDate).toISOString().split("T")[0]
      : "",
    objective: interview.objective ?? "",
  });
  setEditDialogOpen(true);
};
```

Update `handleSaveEdit` to send objective:

```typescript
// BEFORE:
await api.patch(`/org-intelligence/interviews/${interviewId}`, {
  title: editForm.title || undefined,
  interviewDate: editForm.interviewDate
    ? new Date(editForm.interviewDate + "T12:00:00").toISOString()
    : undefined,
});

// AFTER:
await api.patch(`/org-intelligence/interviews/${interviewId}`, {
  title: editForm.title || undefined,
  interviewDate: editForm.interviewDate
    ? new Date(editForm.interviewDate + "T12:00:00").toISOString()
    : undefined,
  objective: editForm.objective,
});
```

Update `EditInterviewDialog` usage to pass new props:

```tsx
// BEFORE:
<EditInterviewDialog
  open={editDialogOpen}
  onOpenChange={setEditDialogOpen}
  title={editForm.title}
  onTitleChange={(t) => setEditForm({ ...editForm, title: t })}
  onSave={handleSaveEdit}
  saving={savingEdit}
/>

// AFTER:
<EditInterviewDialog
  open={editDialogOpen}
  onOpenChange={setEditDialogOpen}
  title={editForm.title}
  onTitleChange={(t) => setEditForm({ ...editForm, title: t })}
  interviewDate={editForm.interviewDate}
  onDateChange={(d) => setEditForm({ ...editForm, interviewDate: d })}
  objective={editForm.objective}
  onObjectiveChange={(o) => setEditForm({ ...editForm, objective: o })}
  onSave={handleSaveEdit}
  saving={savingEdit}
/>
```

- [ ] **Step 3: Make objective card display editable state and add edit trigger**

Replace the static objective card (lines 715-725) with an inline display that opens the edit dialog:

```tsx
{/* Interview Objective */}
<Card>
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium">Objetivo de la entrevista</CardTitle>
      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={openEditDialog}>
        Editar
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">
      {interview.objective ?? "Sin objetivo definido. Haz clic en Editar para agregarlo."}
    </p>
  </CardContent>
</Card>
```

- [ ] **Step 4: Add speaker delete confirmation**

Add an `AlertDialog` import at the top of page.tsx (check if not already imported — it is NOT currently imported):

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
```

Add state for speaker delete confirmation:

```typescript
const [deleteSpeakerIndex, setDeleteSpeakerIndex] = useState<number | null>(null);
```

Change `InterviewParticipantsCard` `onDelete` to open confirmation instead of direct delete:

```tsx
<InterviewParticipantsCard
  speakers={interview.speakers}
  avatarUrls={speakerAvatarUrls}
  onAdd={openAddSpeakerDialog}
  onEdit={openEditSpeakerDialog}
  onDelete={(index) => setDeleteSpeakerIndex(index)}
  saving={savingSpeakers}
/>
```

Add the AlertDialog for speaker deletion (after the other dialogs, before `</div>`):

```tsx
{/* Speaker Delete Confirmation */}
<AlertDialog
  open={deleteSpeakerIndex !== null}
  onOpenChange={(open) => { if (!open) setDeleteSpeakerIndex(null); }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar participante?</AlertDialogTitle>
      <AlertDialogDescription>
        Se eliminará a &quot;{deleteSpeakerIndex !== null
          ? (interview.speakers[deleteSpeakerIndex]?.name ?? interview.speakers[deleteSpeakerIndex]?.speakerLabel)
          : ""}&quot; de la entrevista.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={savingSpeakers}>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        disabled={savingSpeakers}
        onClick={() => {
          if (deleteSpeakerIndex !== null) {
            handleDeleteSpeaker(deleteSpeakerIndex);
            setDeleteSpeakerIndex(null);
          }
        }}
      >
        Eliminar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 5: Verify AlertDialog component exists**

```bash
ls apps/web/components/ui/alert-dialog.tsx
```

If it doesn't exist, install it:
```bash
pnpm --filter @zeru/web dlx shadcn@latest add alert-dialog
```

- [ ] **Step 6: Run lint**

```bash
pnpm lint
```

Fix any lint errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/org-intelligence/edit-interview-dialog.tsx apps/web/app/\(dashboard\)/org-intelligence/projects/\[id\]/interviews/\[interviewId\]/page.tsx apps/web/components/ui/alert-dialog.tsx
git commit -m "feat(org-intelligence): add date+objective to edit dialog, editable objective, speaker delete confirmation"
```

---

### Task 7: Verify backend accepts objective in PATCH

**Files:**
- Check: `apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts`
- Check: `apps/api/src/modules/org-intelligence/dto/index.ts`

- [ ] **Step 1: Verify the PATCH endpoint accepts `objective`**

Check the DTO for updating interviews. If `objective` is not in the update DTO, add it:

```typescript
// In the update interview DTO/schema, ensure `objective` is an accepted optional field:
objective: z.string().optional(),
```

Also check that the controller passes it through to the service, and the service includes it in the Prisma update call.

- [ ] **Step 2: Commit if changes were needed**

```bash
git add apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts apps/api/src/modules/org-intelligence/dto/index.ts
git commit -m "fix(org-intelligence): accept objective field in interview PATCH endpoint"
```

---

### Task 8: Final cleanup and lint

- [ ] **Step 1: Run full lint check**

```bash
pnpm lint
```

- [ ] **Step 2: Fix any remaining lint errors**

- [ ] **Step 3: Verify the app builds**

```bash
pnpm --filter @zeru/web build
```

- [ ] **Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "chore: lint fixes for interview detail UX improvements"
```
