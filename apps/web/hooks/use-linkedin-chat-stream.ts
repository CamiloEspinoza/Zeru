"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatEvent, QuestionPayload } from "@zeru/shared";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

const LINKEDIN_TOOL_LABELS: Record<string, string> = {
  create_linkedin_post: "Creando post de LinkedIn",
  schedule_linkedin_post: "Programando post de LinkedIn",
  bulk_schedule_posts: "Programando calendario de contenido",
  generate_image: "Generando imagen con Gemini",
  get_linkedin_connection_status: "Verificando conexión de LinkedIn",
  get_post_history: "Consultando historial de posts",
  get_scheduled_posts: "Consultando posts programados",
  cancel_scheduled_post: "Cancelando post programado",
  get_content_pillars: "Consultando pilares de contenido",
  ask_user_question: "Preguntando al usuario",
  update_conversation_title: "Actualizando título",
  memory_store: "Guardando en memoria",
  memory_search: "Buscando en memoria",
  get_skill_reference: "Cargando referencia del skill",
};

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("access_token");
  const tenantId = localStorage.getItem("tenantId");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "x-tenant-id": tenantId } : {}),
  };
}

const INACTIVITY_TIMEOUT_MS = 90_000;

async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const readPromise = reader.read();
    const timeoutPromise = new Promise<never>((_, reject) => {
      const id = setTimeout(
        () => reject(new Error("Stream inactivity timeout")),
        INACTIVITY_TIMEOUT_MS,
      );
      readPromise.then(() => clearTimeout(id), () => clearTimeout(id));
    });

    const { done, value } = await Promise.race([readPromise, timeoutPromise]);
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;

      let event: ChatEvent;
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }

      onEvent(event);
    }
  }
}

export type ToolState = {
  toolCallId: string;
  name: string;
  label: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
  result?: unknown;
  summary?: string;
};

export type ContentBlock =
  | { kind: "thinking"; text: string; streaming: boolean }
  | { kind: "tool"; state: ToolState }
  | {
      kind: "question";
      toolCallId: string;
      payload: QuestionPayload;
      answered: boolean;
      answeredValue?: string;
    }
  | { kind: "text"; text: string };

export type MessageBlock =
  | { id: string; type: "user"; text: string }
  | { id: string; type: "assistant"; blocks: ContentBlock[]; done: boolean };

export function useLinkedInChatStream() {
  const [messages, setMessages] = useState<MessageBlock[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const conversationIdRef = useRef<string | undefined>(undefined);
  const [conversationTitle, setConversationTitle] = useState<string | undefined>();
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const updateLastAssistantBlocks = useCallback(
    (updater: (blocks: ContentBlock[]) => ContentBlock[]) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.type !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, blocks: updater(last.blocks) }];
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string, opts?: { questionToolCallId?: string }) => {
      if (streaming) return;

      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, type: "user", text },
        { id: assistantMsgId, type: "assistant", blocks: [], done: false },
      ]);

      setStreaming(true);
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`${API_BASE}/linkedin/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            message: text,
            conversationId: conversationIdRef.current,
            questionToolCallId: opts?.questionToolCallId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) throw new Error("Error al conectar con el agente");

        const reader = res.body.getReader();

        await readSSEStream(reader, (event) => {
          if (event.type === "conversation_started") {
            const cid = (event as { type: string; conversationId: string }).conversationId;
            setConversationId(cid);
            conversationIdRef.current = cid;
          }

          if (event.type === "thinking") {
            const delta = (event as { type: string; delta: string }).delta;
            updateLastAssistantBlocks((blocks) => {
              const last = blocks[blocks.length - 1];
              if (last?.kind === "thinking") {
                return [...blocks.slice(0, -1), { ...last, text: last.text + delta }];
              }
              return [...blocks, { kind: "thinking", text: delta, streaming: true }];
            });
          }

          if (event.type === "text_delta") {
            const delta = (event as { type: string; delta: string }).delta;
            updateLastAssistantBlocks((blocks) => {
              const last = blocks[blocks.length - 1];
              if (last?.kind === "text") {
                return [...blocks.slice(0, -1), { ...last, text: last.text + delta }];
              }
              return [...blocks, { kind: "text", text: delta }];
            });
          }

          if (event.type === "tool_start") {
            const ev = event as { type: string; toolCallId: string; name: string; args: Record<string, unknown>; label: string };
            updateLastAssistantBlocks((blocks) => {
              const idx = blocks.findIndex(
                (b) => b.kind === "tool" && b.state.toolCallId === ev.toolCallId
              );
              const state: ToolState = {
                toolCallId: ev.toolCallId,
                name: ev.name,
                label: LINKEDIN_TOOL_LABELS[ev.name] ?? ev.label ?? ev.name,
                args: ev.args,
                status: "running",
              };
              if (idx >= 0) {
                const updated = [...blocks];
                updated[idx] = { kind: "tool", state };
                return updated;
              }
              return [...blocks, { kind: "tool", state }];
            });
          }

          if (event.type === "tool_done") {
            const ev = event as { type: string; toolCallId: string; name: string; success: boolean; result: unknown; summary: string };
            updateLastAssistantBlocks((blocks) =>
              blocks.map((b) =>
                b.kind === "tool" && b.state.toolCallId === ev.toolCallId
                  ? { kind: "tool", state: { ...b.state, status: ev.success ? "done" : "error", result: ev.result, summary: ev.summary } }
                  : b
              )
            );
          }

          if (event.type === "question") {
            const ev = event as { type: string; toolCallId: string; payload: QuestionPayload; conversationId: string };
            updateLastAssistantBlocks((blocks) => [
              ...blocks,
              { kind: "question", toolCallId: ev.toolCallId, payload: ev.payload, answered: false },
            ]);
          }

          if (event.type === "title_update") {
            const title = (event as { type: string; title: string }).title;
            setConversationTitle(title);
          }

          if (event.type === "done") {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (!last || last.type !== "assistant") return prev;
              return [...prev.slice(0, -1), { ...last, done: true }];
            });
          }
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.type !== "assistant") return prev;
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              blocks: [
                ...last.blocks,
                { kind: "text", text: `Error: ${(err as Error).message}` },
              ],
              done: true,
            },
          ];
        });
      } finally {
        setStreaming(false);
      }
    },
    [streaming, updateLastAssistantBlocks]
  );

  const answerQuestion = useCallback(
    (toolCallId: string, answer: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.type !== "assistant") return msg;
          return {
            ...msg,
            blocks: msg.blocks.map((b) =>
              b.kind === "question" && b.toolCallId === toolCallId
                ? { ...b, answered: true, answeredValue: answer }
                : b
            ),
          };
        })
      );
      sendMessage(answer, { questionToolCallId: toolCallId });
    },
    [sendMessage]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(undefined);
    conversationIdRef.current = undefined;
    setConversationTitle(undefined);
    setStreaming(false);
  }, []);

  const loadHistory = useCallback(async (convId: string) => {
    const res = await fetch(`${API_BASE}/linkedin/conversations/${convId}/messages`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return;
    const msgs = await res.json() as Array<{
      id: string;
      role: string;
      content: { type: string; text?: string; payload?: QuestionPayload; callId?: string } | null;
      toolName?: string;
      toolResult?: unknown;
      toolArgs?: Record<string, unknown>;
    }>;

    setConversationId(convId);
    conversationIdRef.current = convId;

    const reconstructed: MessageBlock[] = [];
    let currentAssistant: Extract<MessageBlock, { type: "assistant" }> | null = null;

    for (const msg of msgs) {
      if (msg.role === "user") {
        if (currentAssistant) {
          reconstructed.push({ ...currentAssistant, done: true });
          currentAssistant = null;
        }
        const text = typeof msg.content === "object" && msg.content?.type === "text"
          ? msg.content.text ?? ""
          : typeof msg.content === "string"
          ? msg.content
          : "";
        reconstructed.push({ id: msg.id, type: "user", text });
      } else if (msg.role === "assistant") {
        if (!currentAssistant) {
          currentAssistant = { id: msg.id, type: "assistant", blocks: [], done: false };
        }
        if (msg.content && typeof msg.content === "object") {
          const c = msg.content;
          if (c.type === "thinking") {
            currentAssistant.blocks.push({ kind: "thinking", text: c.text ?? "", streaming: false });
          } else if (c.type === "text") {
            currentAssistant.blocks.push({ kind: "text", text: c.text ?? "" });
          }
        }
      } else if (msg.role === "tool" && msg.toolName) {
        if (!currentAssistant) {
          currentAssistant = { id: msg.id, type: "assistant", blocks: [], done: false };
        }
        currentAssistant.blocks.push({
          kind: "tool",
          state: {
            toolCallId: msg.id,
            name: msg.toolName,
            label: LINKEDIN_TOOL_LABELS[msg.toolName] ?? msg.toolName,
            args: msg.toolArgs ?? {},
            status: "done",
            result: msg.toolResult,
          },
        });
      } else if (msg.role === "question" && msg.content && typeof msg.content === "object") {
        if (!currentAssistant) {
          currentAssistant = { id: msg.id, type: "assistant", blocks: [], done: false };
        }
        const c = msg.content as { type: string; payload?: QuestionPayload; callId?: string };
        if (c.payload) {
          currentAssistant.blocks.push({
            kind: "question",
            toolCallId: c.callId ?? msg.id,
            payload: c.payload,
            answered: true,
          });
        }
      }
    }

    if (currentAssistant) {
      reconstructed.push({ ...currentAssistant, done: true });
    }

    setMessages(reconstructed);
  }, []);

  return {
    messages,
    conversationId,
    conversationTitle,
    streaming,
    sendMessage,
    answerQuestion,
    reset,
    loadHistory,
  };
}
