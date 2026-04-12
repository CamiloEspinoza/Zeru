"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, FileIcon, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";
import type { TaskComment, ProjectMember } from "@/types/projects";

const EMPTY_COMMENTS: TaskComment[] = [];
import { tasksApi } from "@/lib/api/tasks";
import { projectsApi } from "@/lib/api/projects";
import { TaskCommentTyping } from "./task-comment-typing";

// ─── Attachment parsing helpers ──────────────────────────

interface ParsedAttachment {
  type: "image" | "file";
  filename: string;
  url: string;
  size?: string;
}

const IMAGE_PATTERN = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const FILE_PATTERN = /^\ud83d\udcce \[([^\]]+)\]\(([^)]+)\)(?: \(([^)]+)\))?$/;

function parseAttachment(content: string): ParsedAttachment | null {
  const imgMatch = content.match(IMAGE_PATTERN);
  if (imgMatch) {
    return { type: "image", filename: imgMatch[1], url: imgMatch[2] };
  }
  const fileMatch = content.match(FILE_PATTERN);
  if (fileMatch) {
    return {
      type: "file",
      filename: fileMatch[1],
      url: fileMatch[2],
      size: fileMatch[3],
    };
  }
  return null;
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Mention rendering helper ────────────────────────────

const MENTION_REGEX = /@([\w\s]+?)(?=\s@|[.,;:!?]|\s|$)/g;

function renderCommentContent(
  content: string,
  memberNames: Set<string>,
) {
  // Check if this is a pure attachment comment
  const attachment = parseAttachment(content);
  if (attachment) {
    if (attachment.type === "image") {
      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={attachment.filename}
            className="max-w-xs max-h-48 rounded-md border object-cover"
          />
        </a>
      );
    }
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        download={attachment.filename}
        className="mt-1 inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm hover:bg-muted transition-colors"
      >
        <FileIcon className="size-4 text-muted-foreground" />
        <span className="font-medium">{attachment.filename}</span>
        {attachment.size && (
          <span className="text-xs text-muted-foreground">
            ({attachment.size})
          </span>
        )}
        <Download className="size-3.5 text-muted-foreground" />
      </a>
    );
  }

  // Render text with @mentions highlighted
  if (memberNames.size === 0) {
    return <p className="mt-0.5 text-sm whitespace-pre-wrap">{content}</p>;
  }

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, "g");

  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim();
    if (!memberNames.has(name)) continue;

    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary"
      >
        @{name}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  if (parts.length === 0) {
    return <p className="mt-0.5 text-sm whitespace-pre-wrap">{content}</p>;
  }

  return <p className="mt-0.5 text-sm whitespace-pre-wrap">{parts}</p>;
}

// ─── Main component ──────────────────────────────────────

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function TaskComments({ taskId, projectId }: TaskCommentsProps) {
  const socket = useSocket();
  const setComments = useProjectStore((s) => s.setComments);
  const comments =
    useProjectStore((s) => s.commentsByTask.get(taskId)) ?? EMPTY_COMMENTS;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  // @Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  // Member names set for rendering
  const memberNames = new Set(
    members.map((m) => `${m.user.firstName} ${m.user.lastName}`),
  );

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.listComments(taskId);
      setComments(taskId, data);
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId, setComments]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tasksApi
      .listComments(taskId)
      .then((data) => {
        if (cancelled) return;
        setComments(taskId, data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error loading comments:", err);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, setComments]);

  // Fetch project members for @mentions (lazy, once)
  useEffect(() => {
    if (membersLoaded) return;
    projectsApi
      .listMembers(projectId)
      .then((data) => {
        setMembers(data);
        setMembersLoaded(true);
      })
      .catch(() => {
        // ignore
      });
  }, [projectId, membersLoaded]);

  // ─── Typing indicator ────────────────────────────────

  function emitTyping() {
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("task:comment:typing", { taskId, projectId });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("task:comment:typing:stop", { taskId, projectId });
    }, 2500);
  }

  // ─── @Mention detection ──────────────────────────────

  function detectMention(value: string, cursorPos: number) {
    // Look backward from cursor to find @
    const textBefore = value.slice(0, cursorPos);
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex === -1) {
      setMentionQuery(null);
      return;
    }

    // Must be at start or after a space/newline
    if (atIndex > 0 && !/\s/.test(textBefore[atIndex - 1])) {
      setMentionQuery(null);
      return;
    }

    const query = textBefore.slice(atIndex + 1);
    // If query has newline, dismiss
    if (query.includes("\n")) {
      setMentionQuery(null);
      return;
    }

    setMentionQuery(query);
    setMentionStart(atIndex);
    setMentionIndex(0);
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setContent(value);
    emitTyping();
    detectMention(value, e.target.selectionStart ?? value.length);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredMembers.length - 1,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
  }

  function insertMention(member: ProjectMember) {
    const name = `${member.user.firstName} ${member.user.lastName}`;
    const before = content.slice(0, mentionStart);
    const cursorPos = textareaRef.current?.selectionStart ?? content.length;
    const after = content.slice(cursorPos);
    const newContent = `${before}@${name} ${after}`;
    setContent(newContent);
    setMentionQuery(null);

    // Refocus textarea
    requestAnimationFrame(() => {
      const pos = mentionStart + name.length + 2; // @name + space
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  const filteredMembers =
    mentionQuery !== null
      ? members.filter((m) => {
          const fullName =
            `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
          return fullName.includes(mentionQuery.toLowerCase());
        })
      : [];

  // ─── File upload logic ───────────────────────────────

  async function uploadAndComment(file: File) {
    setUploading(true);
    try {
      const result = await tasksApi.uploadCommentFile(taskId, file);
      const isImage = isImageMimeType(file.type);
      let commentContent: string;
      if (isImage) {
        commentContent = `![${result.filename}](${result.url})`;
      } else {
        commentContent = `\ud83d\udcce [${result.filename}](${result.url}) (${formatFileSize(result.size)})`;
      }
      await tasksApi.createComment(taskId, commentContent);
      await fetchComments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al subir archivo",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleFilesSelected(files: FileList | File[]) {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      uploadAndComment(file);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
      e.target.value = "";
    }
  }

  // ─── Drag & drop handlers ───────────────────────────

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  }

  // ─── Submit handler ──────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      // Detect @mentions in the content and resolve to user IDs
      const mentionedUserIds: string[] = [];
      const mentionRegex = new RegExp(MENTION_REGEX.source, "g");
      let m: RegExpExecArray | null;
      while ((m = mentionRegex.exec(content)) !== null) {
        const name = m[1].trim();
        const member = members.find(
          (mb) =>
            `${mb.user.firstName} ${mb.user.lastName}` === name,
        );
        if (member && !mentionedUserIds.includes(member.userId)) {
          mentionedUserIds.push(member.userId);
        }
      }

      await tasksApi.createComment(
        taskId,
        content.trim(),
        undefined,
        mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
      );
      setContent("");
      setMentionQuery(null);
      if (socket && isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit("task:comment:typing:stop", { taskId, projectId });
      }
      await fetchComments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al publicar comentario",
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (socket && isTypingRef.current) {
        socket.emit("task:comment:typing:stop", { taskId, projectId });
      }
    };
  }, [socket, taskId, projectId]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Comentarios</h3>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aun no hay comentarios.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <UserAvatar
                name={`${comment.author.firstName} ${comment.author.lastName}`}
                avatarUrl={comment.author.avatarUrl}
                className="size-8"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.author.firstName} {comment.author.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                {renderCommentContent(comment.content, memberNames)}
              </div>
            </div>
          ))}
        </div>
      )}
      <TaskCommentTyping taskId={taskId} />

      {/* Comment form with drop zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative"
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/5">
            <p className="text-sm font-medium text-primary">
              Suelta para adjuntar
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un comentario... usa @ para mencionar"
              rows={3}
              maxLength={10000}
            />

            {/* @Mention popup */}
            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div
                ref={mentionListRef}
                className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-md border bg-popover p-1 shadow-md"
              >
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {filteredMembers.slice(0, 8).map((member, idx) => (
                    <button
                      key={member.userId}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(member);
                      }}
                      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors ${
                        idx === mentionIndex
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <UserAvatar
                        name={`${member.user.firstName} ${member.user.lastName}`}
                        avatarUrl={member.user.avatarUrl}
                        className="size-5"
                      />
                      <span className="truncate">
                        {member.user.firstName} {member.user.lastName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInputChange}
                multiple
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Adjuntar archivo"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </Button>
              {uploading && (
                <span className="text-xs text-muted-foreground">
                  Subiendo...
                </span>
              )}
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !content.trim()}
            >
              {submitting ? "Enviando..." : "Comentar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
