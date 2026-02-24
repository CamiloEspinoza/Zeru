"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChatStream, uploadFile, type AttachedDoc } from "@/hooks/use-chat-stream";
import { ThinkingBlock } from "@/components/ai/thinking-block";
import { ToolExecution } from "@/components/ai/tool-execution";
import { QuestionCard } from "@/components/ai/question-card";
import { JournalEntryReviewCard } from "@/components/ai/journal-entry-review-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Constants ────────────────────────────────────────────

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "text/markdown",
  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
];

function fileIcon(mime: string) {
  if (mime === "application/pdf") return "PDF";
  if (mime === "text/csv") return "CSV";
  if (mime.startsWith("text/")) return "TXT";
  if (mime === "application/json") return "JSON";
  if (
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.oasis.opendocument.spreadsheet"
  )
    return "XLS";
  return "FILE";
}

// ─── Pending file state (before upload completes) ────────

interface PendingFile {
  localId: string;
  file: File;
  previewUrl?: string;
  status: "uploading" | "done" | "error";
  documentId?: string;
  errorMessage?: string;
}

// ─── Attachment chip / thumbnail ──────────────────────────

function FileChip({
  pf,
  onRemove,
}: {
  pf: PendingFile;
  onRemove?: () => void;
}) {
  const isImage = pf.file.type.startsWith("image/");

  const statusBadge =
    pf.status === "uploading" ? (
      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
        <svg
          className="h-4 w-4 animate-spin text-white"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      </span>
    ) : pf.status === "error" ? (
      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-destructive/60">
        <svg
          className="h-4 w-4 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </span>
    ) : null;

  if (isImage && pf.previewUrl) {
    return (
      <div className="relative group flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pf.previewUrl}
          alt={pf.file.name}
          className="h-16 w-16 rounded-lg object-cover border border-border"
        />
        {statusBadge}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative group flex-shrink-0 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs">
      <span className="font-mono font-bold text-muted-foreground text-[10px]">
        {fileIcon(pf.file.type)}
      </span>
      <span className="max-w-[100px] truncate text-foreground">
        {pf.file.name}
      </span>
      {pf.status === "uploading" && (
        <svg
          className="h-3 w-3 animate-spin text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      )}
      {pf.status === "error" && (
        <svg
          className="h-3 w-3 text-destructive"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )}
      {pf.status === "done" && (
        <svg
          className="h-3 w-3 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hidden group-hover:flex ml-1 text-muted-foreground hover:text-destructive"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Typewriter title ─────────────────────────────────────

function ConversationTitle({
  title,
  animate,
}: {
  title: string;
  animate: boolean;
}) {
  const [displayed, setDisplayed] = useState(title);
  const [cursor, setCursor] = useState(false);
  const prevTitleRef = useRef(title);

  useEffect(() => {
    if (!animate || title === prevTitleRef.current) {
      setDisplayed(title);
      return;
    }
    prevTitleRef.current = title;
    setCursor(true);
    setDisplayed("");
    let i = 0;
    const speed = Math.max(30, Math.min(80, Math.floor(1200 / title.length)));
    const iv = setInterval(() => {
      i++;
      setDisplayed(title.slice(0, i));
      if (i >= title.length) {
        clearInterval(iv);
        setTimeout(() => setCursor(false), 400);
      }
    }, speed);
    return () => clearInterval(iv);
  }, [title, animate]);

  return (
    <h1 className="font-semibold truncate max-w-xs flex items-center gap-0.5">
      {displayed}
      {cursor && (
        <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse rounded-sm" />
      )}
    </h1>
  );
}

// ─── Main page ────────────────────────────────────────────

export default function AssistantChatPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";

  const { messages, conversationId, conversationTitle, streaming, sendMessage, answerQuestion, reset, loadHistory } =
    useChatStream();

  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  // Ref so loadHistory can check current messages without needing them in deps
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Reset on /new, load history on existing conversation
  useEffect(() => {
    if (isNew) {
      reset();
    } else if (typeof params.id === "string") {
      // Skip if we already have in-memory messages (navigated from /new after streaming)
      if (messagesRef.current.length === 0) {
        loadHistory(params.id);
      }
    }
  }, [isNew, params.id, reset, loadHistory]);

  // After streaming completes on a /new conversation, navigate to the real URL
  // so the browser history and breadcrumbs reflect the actual conversation.
  useEffect(() => {
    if (isNew && !streaming && conversationId) {
      router.replace(`/assistant/${conversationId}`);
    }
  }, [isNew, streaming, conversationId, router]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach((pf) => {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File upload ──────────────────────────────────────────

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) =>
      ACCEPTED_TYPES.includes(f.type)
    );
    if (!arr.length) return;

    // Create pending entries immediately so UI reflects them
    const newPending: PendingFile[] = arr.map((f) => ({
      localId: crypto.randomUUID(),
      file: f,
      previewUrl: f.type.startsWith("image/")
        ? URL.createObjectURL(f)
        : undefined,
      status: "uploading" as const,
    }));

    setPendingFiles((prev) => [...prev, ...newPending]);

    // Upload each file to the backend via multipart
    for (const pf of newPending) {
      uploadFile(pf.file)
        .then((documentId) => {
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.localId === pf.localId
                ? { ...p, status: "done", documentId }
                : p
            )
          );
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Error al subir";
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.localId === pf.localId
                ? { ...p, status: "error", errorMessage: message }
                : p
            )
          );
        });
    }
  }, []);

  const removePendingFile = useCallback((localId: string) => {
    setPendingFiles((prev) => {
      const pf = prev.find((p) => p.localId === localId);
      if (pf?.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  }, []);

  // ── Drag & drop ─────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  // ── Clipboard paste ──────────────────────────────────────

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.files);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [addFiles]
  );

  // ── Send ────────────────────────────────────────────────

  const anyUploading = pendingFiles.some((p) => p.status === "uploading");

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !pendingFiles.length) || streaming || anyUploading) return;

    // Collect only successfully uploaded docs
    const docs: AttachedDoc[] = pendingFiles
      .filter((p) => p.status === "done" && p.documentId)
      .map((p) => ({
        id: p.documentId!,
        name: p.file.name,
        mimeType: p.file.type,
      }));

    setInput("");
    // Keep preview so user sees them in the message bubble, but clear queue
    const cleared = [...pendingFiles];
    setPendingFiles([]);
    // Revoke preview URLs after a brief delay
    setTimeout(() => cleared.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)), 5000);

    await sendMessage(text || "Analiza los archivos adjuntos", { docs });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <svg
              className="h-10 w-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="font-medium text-sm">Suelta los archivos aquí</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
        <ConversationTitle
          title={conversationTitle ?? (isNew ? "Nueva conversación" : "Cargando...")}
          animate={!!conversationTitle}
        />
      </div>

      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">
                Asistente Contable Zeru
              </p>
              <p className="text-sm mt-1">
                Puedo crear cuentas contables, asientos de diario y procesar
                documentos como estatutos de sociedades.
              </p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                Arrastra archivos o pega imágenes directamente en el chat.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {[
                "Crea los asientos de constitución de sociedad",
                "¿Cuál es el balance de comprobación?",
                "Lista el plan de cuentas",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                  className="rounded-full border border-border/60 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.type === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[75%] space-y-2">
                  {/* Document chips in user bubble */}
                  {msg.docs && msg.docs.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      {msg.docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary"
                        >
                          {doc.mimeType.startsWith("image/") ? (
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                          <span className="max-w-[120px] truncate">{doc.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.text && (
                    <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground text-sm">
                      {msg.text}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold mt-0.5">
                  Z
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Render blocks in chronological order */}
                  {msg.blocks.map((block, blockIdx) => {
                    // Pre-compute which journal entry IDs have been posted across ALL messages
                    const postedEntryIds = new Set(
                      messages.flatMap((m) =>
                        m.type === "assistant"
                          ? m.blocks
                              .filter(
                                (b) =>
                                  b.kind === "tool" &&
                                  b.state.name === "post_journal_entry" &&
                                  b.state.status === "done"
                              )
                              .map((b) => {
                                const r = (b as Extract<typeof b, { kind: "tool" }>).state.result as { id?: string } | null;
                                return r?.id ?? "";
                              })
                          : []
                      )
                    );

                    if (block.kind === "thinking") {
                      return (
                        <ThinkingBlock
                          key={blockIdx}
                          text={block.text}
                          isStreaming={block.streaming}
                        />
                      );
                    }
                    if (block.kind === "tool") {
                      // Render a rich review card for journal entry creation
                      if (
                        block.state.name === "create_journal_entry" &&
                        block.state.status === "done" &&
                        block.state.result
                      ) {
                        const entry = block.state.result as {
                          id: string;
                          number: number;
                          date: string;
                          description: string;
                          status: "DRAFT" | "POSTED" | "VOIDED";
                          lines: Array<{
                            id: string;
                            debit: number | string;
                            credit: number | string;
                            description?: string | null;
                            account?: { code: string; name: string };
                          }>;
                        };
                        return (
                          <JournalEntryReviewCard
                            key={block.state.toolCallId}
                            entry={entry}
                            approved={postedEntryIds.has(entry.id)}
                            onApprove={(entryId, entryNumber) => {
                              sendMessage(
                                `Contabiliza el asiento #${entryNumber} (id: ${entryId})`
                              );
                            }}
                          />
                        );
                      }

                      return (
                        <ToolExecution
                          key={block.state.toolCallId}
                          toolCallId={block.state.toolCallId}
                          name={block.state.name}
                          label={block.state.label}
                          args={block.state.args}
                          status={block.state.status}
                          result={block.state.result}
                          summary={block.state.summary}
                        />
                      );
                    }
                    if (block.kind === "question") {
                      return (
                        <QuestionCard
                          key={block.toolCallId}
                          toolCallId={block.toolCallId}
                          payload={block.payload}
                          onAnswer={answerQuestion}
                          answered={block.answered}
                          answeredValue={block.answeredValue}
                        />
                      );
                    }
                    if (block.kind === "text") {
                      const isLast = blockIdx === msg.blocks.length - 1;
                      const showCursor = isLast && !msg.done;
                      return (
                        <div
                          key={blockIdx}
                          className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
                            prose-headings:font-semibold prose-headings:text-foreground
                            prose-p:text-foreground prose-p:leading-relaxed
                            prose-strong:text-foreground prose-strong:font-semibold
                            prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                            prose-pre:bg-muted prose-pre:rounded-md
                            prose-ul:text-foreground prose-ol:text-foreground
                            prose-li:text-foreground
                            prose-blockquote:border-l-muted-foreground prose-blockquote:text-muted-foreground
                            prose-a:text-primary"
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {showCursor ? block.text + "▋" : block.text}
                          </ReactMarkdown>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {/* Loading dots when no blocks yet */}
                  {msg.blocks.length === 0 && streaming && !msg.done && (
                    <div className="flex gap-0.5 mt-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t px-6 pt-4 pb-5 shrink-0">
        <div
          className={cn(
            "rounded-xl border bg-background shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
            isDragging && "border-primary ring-1 ring-primary"
          )}
        >
          {/* File chips above textarea */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {pendingFiles.map((pf) => (
                <FileChip
                  key={pf.localId}
                  pf={pf}
                  onRemove={() => removePendingFile(pf.localId)}
                />
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 px-4 py-3">
            {/* Attach file button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar archivo"
              className="flex-shrink-0 mb-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                pendingFiles.length
                  ? "Agrega un mensaje o envía solo los archivos…"
                  : "Escribe un mensaje, arrastra archivos o pega imágenes…"
              }
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />

            {streaming ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={handleSend}
                disabled={
                  (!input.trim() && !pendingFiles.length) ||
                  anyUploading
                }
                title={anyUploading ? "Esperando subida de archivos…" : undefined}
              >
                {anyUploading ? (
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          El asistente puede cometer errores. Verifica los asientos contables
          antes de contabilizarlos.
        </p>
      </div>
    </div>
  );
}
