"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useChatStream,
  uploadFile,
  uploadImage,
  type AttachedDoc,
} from "@/hooks/use-chat-stream";
import { TokenMeter } from "@/components/ai/token-meter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { AssistantMessage } from "@/components/ai/assistant-message";
import { ChatEmptyState } from "@/components/ai/chat-empty-state";
import { ChatInputArea } from "@/components/ai/chat-input-area";
import { type PendingFile, type PendingImage } from "@/components/ai/file-chip";

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
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
];

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

  const {
    messages,
    conversationId,
    conversationTitle,
    streaming,
    tokenUsage,
    sendMessage,
    answerQuestion,
    reset,
    loadHistory,
  } = useChatStream();

  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const pendingEntryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const SCROLL_BOTTOM_THRESHOLD = 100;

  const handleScrollContainerScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setAutoScrollEnabled(distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD);
  }, []);

  const { postedEntryIds, pendingDraftEntries } = useMemo(() => {
    const posted = new Set<string>();
    for (const m of messages) {
      if (m.type !== "assistant") continue;
      for (const b of m.blocks) {
        if (
          b.kind === "tool" &&
          b.state.name === "post_journal_entry" &&
          b.state.status === "done"
        ) {
          const r = b.state.result as { id?: string } | null;
          if (r?.id) posted.add(r.id);
        }
      }
    }
    const pending: Array<{ id: string; number: number }> = [];
    for (const m of messages) {
      if (m.type !== "assistant") continue;
      for (const b of m.blocks) {
        if (
          b.kind !== "tool" ||
          b.state.name !== "create_journal_entry" ||
          b.state.status !== "done" ||
          !b.state.result
        )
          continue;
        const entry = b.state.result as {
          id: string;
          number: number;
          status?: string;
        };
        if (entry.status === "DRAFT" && !posted.has(entry.id)) {
          pending.push({ id: entry.id, number: entry.number });
        }
      }
    }
    return { postedEntryIds: posted, pendingDraftEntries: pending };
  }, [messages]);

  const scrollToPendingEntry = useCallback((entryId: string) => {
    const el = pendingEntryRefs.current[entryId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    if (!autoScrollEnabled) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScrollEnabled]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (isNew) {
      reset();
    } else if (typeof params.id === "string") {
      if (messagesRef.current.length === 0) {
        loadHistory(params.id);
      }
    }
  }, [isNew, params.id, reset, loadHistory]);

  useEffect(() => {
    if (isNew && conversationId) {
      router.replace(`/assistant/${conversationId}`);
    }
  }, [isNew, conversationId, router]);

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
    const arr = Array.from(files).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && !f.type.startsWith("image/"),
    );
    if (!arr.length) return;

    const newPending: PendingFile[] = arr.map((f) => ({
      localId: crypto.randomUUID(),
      file: f,
      previewUrl: f.type.startsWith("image/")
        ? URL.createObjectURL(f)
        : undefined,
      status: "uploading" as const,
    }));

    setPendingFiles((prev) => [...prev, ...newPending]);

    for (const pf of newPending) {
      uploadFile(pf.file)
        .then((documentId) => {
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.localId === pf.localId ? { ...p, status: "done", documentId } : p,
            ),
          );
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Error al subir";
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.localId === pf.localId
                ? { ...p, status: "error", errorMessage: message }
                : p,
            ),
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

  // ── Image upload for social media posts ──────────────────

  const addImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      if (pendingImages.length >= 5) return;

      const pending: PendingImage = {
        localId: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      };
      setPendingImages((prev) => [...prev, pending]);

      try {
        const result = await uploadImage(file);
        setPendingImages((prev) =>
          prev.map((p) =>
            p.localId === pending.localId ? { ...p, status: "done", result } : p,
          ),
        );
      } catch (err) {
        setPendingImages((prev) =>
          prev.map((p) =>
            p.localId === pending.localId
              ? {
                  ...p,
                  status: "error",
                  error: err instanceof Error ? err.message : "Error al subir",
                }
              : p,
          ),
        );
      }
    },
    [pendingImages.length],
  );

  const removePendingImage = useCallback((localId: string) => {
    setPendingImages((prev) => {
      const target = prev.find((p) => p.localId === localId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  }, []);

  const [dismissedPostIds, setDismissedPostIds] = useState<Set<string>>(
    new Set(),
  );

  const handlePostStatusChange = useCallback(
    (postId: string, newStatus: string) => {
      if (!["PENDING_APPROVAL", "DRAFT"].includes(newStatus)) {
        setDismissedPostIds((prev) => new Set(prev).add(postId));
      }
    },
    [],
  );

  const pendingPosts = useMemo(() => {
    const result: { id: string }[] = [];
    for (const msg of messages) {
      if (msg.type !== "assistant") continue;
      for (const block of msg.blocks) {
        if (
          block.kind !== "tool" ||
          block.state.status !== "done" ||
          !block.state.result
        )
          continue;

        if (block.state.name === "bulk_create_drafts") {
          const res = block.state.result as {
            posts?: { id: string; status: string }[];
          };
          if (res.posts) {
            for (const p of res.posts) {
              if (
                ["PENDING_APPROVAL", "DRAFT"].includes(p.status) &&
                !dismissedPostIds.has(p.id)
              )
                result.push({ id: p.id });
            }
          }
        } else if (
          block.state.name === "create_linkedin_post" ||
          block.state.name === "schedule_linkedin_post"
        ) {
          const post = block.state.result as { id: string; status: string };
          if (
            ["PENDING_APPROVAL", "DRAFT"].includes(post.status) &&
            !dismissedPostIds.has(post.id)
          ) {
            result.push({ id: post.id });
          }
        }
      }
    }
    return result;
  }, [messages, dismissedPostIds]);

  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [isBulkCancelling, setIsBulkCancelling] = useState(false);

  const handlePublishAll = useCallback(async () => {
    if (pendingPosts.length === 0 || isBulkPublishing) return;
    setIsBulkPublishing(true);
    try {
      const ids = pendingPosts.map((p) => p.id);
      await Promise.allSettled(
        ids.map((id) => api.post(`/linkedin/posts/${id}/publish`, {})),
      );
      setDismissedPostIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    } finally {
      setIsBulkPublishing(false);
    }
  }, [pendingPosts, isBulkPublishing]);

  const handleCancelAll = useCallback(async () => {
    if (pendingPosts.length === 0 || isBulkCancelling) return;
    setIsBulkCancelling(true);
    try {
      const ids = pendingPosts.map((p) => p.id);
      await Promise.allSettled(
        ids.map((id) => api.post(`/linkedin/posts/${id}/cancel`, {})),
      );
      setDismissedPostIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    } finally {
      setIsBulkCancelling(false);
    }
  }, [pendingPosts, isBulkCancelling]);

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
      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;
      const images = files.filter((f) => f.type.startsWith("image/"));
      const docs = files.filter((f) => !f.type.startsWith("image/"));
      images.forEach((img) => addImage(img));
      if (docs.length > 0) addFiles(docs);
    },
    [addFiles, addImage],
  );

  // ── Clipboard paste ──────────────────────────────────────

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.files);
      if (!files.length) return;
      e.preventDefault();
      const images = files.filter((f) => f.type.startsWith("image/"));
      const docs = files.filter((f) => !f.type.startsWith("image/"));
      images.forEach((img) => addImage(img));
      if (docs.length > 0) addFiles(docs);
    },
    [addFiles, addImage],
  );

  // ── Send ────────────────────────────────────────────────

  const anyUploading = pendingFiles.some((p) => p.status === "uploading");

  const handleSend = async () => {
    const text = input.trim();
    const doneImages = pendingImages.filter(
      (p) => p.status === "done" && p.result,
    );
    const imageUploading = pendingImages.some((p) => p.status === "uploading");
    if (
      (!text && !pendingFiles.length && !doneImages.length) ||
      streaming ||
      anyUploading ||
      imageUploading
    )
      return;

    setAutoScrollEnabled(true);

    const docs: AttachedDoc[] = pendingFiles
      .filter((p) => p.status === "done" && p.documentId)
      .map((p) => ({
        id: p.documentId!,
        name: p.file.name,
        mimeType: p.file.type,
      }));

    const uploadedImagesData =
      doneImages.length > 0 ? doneImages.map((p) => p.result!) : undefined;

    setInput("");
    const cleared = [...pendingFiles];
    setPendingFiles([]);
    const clearedImages = [...pendingImages];
    setPendingImages([]);
    setTimeout(() => {
      cleared.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      clearedImages.forEach(
        (p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl),
      );
    }, 5000);

    const fallbackText =
      docs.length > 0
        ? "Analiza los archivos adjuntos"
        : uploadedImagesData
          ? "Crea post(s) con estas imágenes"
          : "";
    await sendMessage(text || fallbackText, {
      docs,
      uploadedImages: uploadedImagesData,
    });
    textareaRef.current?.focus();
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
      <div className="flex items-center gap-3 px-3 md:px-6 py-3 border-b shrink-0">
        <ConversationTitle
          title={
            conversationTitle ?? (isNew ? "Nueva conversación" : "Cargando...")
          }
          animate={!!conversationTitle}
        />
        <div className="ml-auto">
          <TokenMeter liveUsage={tokenUsage} conversationId={conversationId} />
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScrollContainerScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 md:px-6 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <ChatEmptyState
            onSuggestionClick={(s) => {
              setInput(s);
              textareaRef.current?.focus();
            }}
          />
        )}

        {messages.map((msg, msgIdx) => (
          <div key={msg.id}>
            {msg.type === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[90%] md:max-w-[75%] space-y-2">
                  {msg.uploadedImages && msg.uploadedImages.length > 0 && (
                    <div className="flex justify-end gap-2 flex-wrap">
                      {msg.uploadedImages.map((img, idx) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={idx}
                          src={img.imageUrl}
                          alt={`Imagen adjunta ${idx + 1}`}
                          className="h-32 w-32 rounded-xl object-cover border border-border"
                        />
                      ))}
                    </div>
                  )}
                  {msg.docs && msg.docs.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      {msg.docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary"
                        >
                          {doc.mimeType.startsWith("image/") ? (
                            <svg
                              className="h-4 w-4 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-4 w-4 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          )}
                          <span className="max-w-[120px] truncate">
                            {doc.name}
                          </span>
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
              <AssistantMessage
                msg={msg}
                msgIdx={msgIdx}
                messages={messages}
                streaming={streaming}
                postedEntryIds={postedEntryIds}
                pendingEntryRefs={pendingEntryRefs}
                onPostStatusChange={handlePostStatusChange}
                onAnswerQuestion={answerQuestion}
                onSendMessage={sendMessage}
              />
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Bulk post action bar */}
      {pendingPosts.length >= 2 && (
        <div className="mx-3 md:mx-6 mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 px-3 md:px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {pendingPosts.length}
            </span>
            <span className="text-amber-900 dark:text-amber-200 font-medium">
              posts pendientes de aprobación
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePublishAll}
              disabled={isBulkPublishing || isBulkCancelling}
              className="flex items-center gap-1.5 rounded-lg bg-[#0A66C2] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#004182] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBulkPublishing ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
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
                  Publicando…
                </>
              ) : (
                "Publicar todos"
              )}
            </button>
            <button
              onClick={handleCancelAll}
              disabled={isBulkPublishing || isBulkCancelling}
              className="rounded-lg border border-amber-300 dark:border-amber-700 px-4 py-1.5 text-sm text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBulkCancelling ? "Cancelando…" : "Cancelar todos"}
            </button>
          </div>
        </div>
      )}

      <ChatInputArea
        input={input}
        pendingFiles={pendingFiles}
        pendingImages={pendingImages}
        streaming={streaming}
        anyUploading={anyUploading}
        isDragging={isDragging}
        acceptedTypes={ACCEPTED_TYPES.join(",")}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        imageInputRef={imageInputRef}
        onInputChange={setInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onSend={handleSend}
        onAddFiles={addFiles}
        onAddImage={addImage}
        onRemoveFile={removePendingFile}
        onRemoveImage={removePendingImage}
      />

      {/* Botón flotante: asientos en borrador pendientes de contabilizar */}
      {!isNew && pendingDraftEntries.length > 0 && (
        <div className="fixed bottom-24 right-3 md:right-6 z-40">
          {pendingDraftEntries.length === 1 ? (
            <Button
              size="sm"
              variant="default"
              className="shadow-lg rounded-full gap-2"
              onClick={() => scrollToPendingEntry(pendingDraftEntries[0].id)}
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              1 asiento en borrador
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  className="shadow-lg rounded-full gap-2"
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {pendingDraftEntries.length} asientos en borrador
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="min-w-[200px]">
                {pendingDraftEntries.map(({ id, number }) => (
                  <DropdownMenuItem
                    key={id}
                    onClick={() => scrollToPendingEntry(id)}
                  >
                    Ir al asiento #{number}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
