"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatEvent, QuestionPayload, ToolStartEvent, ToolDoneEvent, TitleUpdateEvent } from "@zeru/shared";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

const TOOL_LABELS: Record<string, string> = {
  update_conversation_title: "Actualizando título de conversación",
  list_accounts: "Consultando plan de cuentas",
  create_account: "Creando cuenta contable",
  create_journal_entry: "Creando asiento contable",
  create_fiscal_period: "Creando período fiscal",
  create_chart_of_accounts_template: "Creando plan de cuentas estándar",
  list_journal_entries: "Consultando asientos contables",
  list_fiscal_periods: "Consultando períodos fiscales",
  post_journal_entry: "Contabilizando asiento",
  get_trial_balance: "Obteniendo balance de comprobación",
  tag_document: "Clasificando documento",
  link_document_to_entry: "Vinculando documento a asiento",
  get_document_journal_entries: "Comprobando si el documento ya tiene asientos",
  ask_user_question: "Preguntando al usuario",
  memory_store: "Guardando en memoria",
  memory_search: "Buscando en memoria",
  memory_delete: "Eliminando de memoria",
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

// ─── File upload ─────────────────────────────────────────────────────────────

export interface PendingFile {
  localId: string;
  file: File;
  previewUrl?: string;
  status: "uploading" | "done" | "error";
  documentId?: string;
  errorMessage?: string;
}

export interface AttachedDoc {
  id: string;
  name: string;
  mimeType: string;
}

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

// ─── Content blocks (ordered, chronological) ─────────────────────────────────

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

// ─── Message blocks ───────────────────────────────────────────────────────────

export type MessageBlock =
  | { id: string; type: "user"; text: string; docs?: AttachedDoc[] }
  | {
      id: string;
      type: "assistant";
      blocks: ContentBlock[];
      done: boolean;
    };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChatStream() {
  const [messages, setMessages] = useState<MessageBlock[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversationTitle, setConversationTitle] = useState<string | undefined>();
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Updater for the last assistant message's blocks array
  const updateLastAssistantBlocks = useCallback(
    (updater: (blocks: ContentBlock[]) => ContentBlock[]) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.type !== "assistant") return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, blocks: updater(last.blocks) },
        ];
      });
    },
    []
  );

  const updateLastAssistant = useCallback(
    (
      updater: (
        msg: Extract<MessageBlock, { type: "assistant" }>
      ) => Partial<Extract<MessageBlock, { type: "assistant" }>>
    ) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.type !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, ...updater(last) }];
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: { questionToolCallId?: string; docs?: AttachedDoc[] }
    ) => {
      if (streaming) return;

      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, type: "user", text, docs: opts?.docs },
        {
          id: assistantMsgId,
          type: "assistant",
          blocks: [],
          done: false,
        },
      ]);

      setStreaming(true);
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`${API_BASE}/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            message: text,
            conversationId,
            questionToolCallId: opts?.questionToolCallId,
            documentIds: opts?.docs?.map((d) => d.id),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") break;

            let event: ChatEvent;
            try {
              event = JSON.parse(raw);
            } catch {
              continue;
            }

            handleEvent(event);
          }
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          updateLastAssistantBlocks((blocks) => {
            const hasText = blocks.some((b) => b.kind === "text");
            if (hasText) {
              return blocks.map((b) =>
                b.kind === "text"
                  ? { ...b, text: b.text || "Error al conectar con el asistente." }
                  : b
              );
            }
            return [
              ...blocks,
              { kind: "text", text: "Error al conectar con el asistente." },
            ];
          });
          updateLastAssistant(() => ({ done: true }));
        }
      } finally {
        setStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streaming, conversationId, updateLastAssistantBlocks, updateLastAssistant]
  );

  const handleEvent = useCallback(
    (event: ChatEvent) => {
      switch (event.type) {
        case "thinking":
          updateLastAssistantBlocks((blocks) => {
            const last = blocks[blocks.length - 1];
            if (last?.kind === "thinking") {
              // Append to the existing thinking block
              return [
                ...blocks.slice(0, -1),
                { ...last, text: last.text + event.delta },
              ];
            }
            // Mark any previous thinking block as done streaming
            const finalized = blocks.map((b) =>
              b.kind === "thinking" ? { ...b, streaming: false } : b
            );
            return [
              ...finalized,
              { kind: "thinking", text: event.delta, streaming: true },
            ];
          });
          break;

        case "text_delta":
          updateLastAssistantBlocks((blocks) => {
            const last = blocks[blocks.length - 1];
            if (last?.kind === "text") {
              return [
                ...blocks.slice(0, -1),
                { ...last, text: last.text + event.delta },
              ];
            }
            // Finalize any open thinking block when text starts
            const finalized = blocks.map((b) =>
              b.kind === "thinking" ? { ...b, streaming: false } : b
            );
            return [...finalized, { kind: "text", text: event.delta }];
          });
          break;

        case "tool_start": {
          const toolStartEvent = event as ToolStartEvent;
          updateLastAssistantBlocks((blocks) => {
            // If the tool block already exists (re-emitted with full args), update it
            const existing = blocks.findIndex(
              (b) => b.kind === "tool" && b.state.toolCallId === toolStartEvent.toolCallId
            );
            if (existing !== -1) {
              return blocks.map((b, i) =>
                i === existing && b.kind === "tool"
                  ? { ...b, state: { ...b.state, args: toolStartEvent.args } }
                  : b
              );
            }
            // Finalize open thinking block
            const finalized = blocks.map((b) =>
              b.kind === "thinking" ? { ...b, streaming: false } : b
            );
            return [
              ...finalized,
              {
                kind: "tool",
                state: {
                  toolCallId: toolStartEvent.toolCallId,
                  name: toolStartEvent.name,
                  label: toolStartEvent.label,
                  args: toolStartEvent.args,
                  status: "running" as const,
                },
              },
            ];
          });
          break;
        }

        case "tool_done": {
          const toolDoneEvent = event as ToolDoneEvent;
          updateLastAssistantBlocks((blocks) =>
            blocks.map((b) =>
              b.kind === "tool" && b.state.toolCallId === toolDoneEvent.toolCallId
                ? {
                    ...b,
                    state: {
                      ...b.state,
                      status: toolDoneEvent.success ? ("done" as const) : ("error" as const),
                      result: toolDoneEvent.result,
                      summary: toolDoneEvent.summary,
                    },
                  }
                : b
            )
          );
          break;
        }

        case "question":
          // Store conversationId so the answer goes to the same conversation
          setConversationId(event.conversationId);
          updateLastAssistantBlocks((blocks) => [
            ...blocks,
            {
              kind: "question",
              toolCallId: event.toolCallId,
              payload: event.payload,
              answered: false,
            },
          ]);
          break;

        case "title_update": {
          const titleEvent = event as TitleUpdateEvent;
          setConversationTitle(titleEvent.title);
          break;
        }

        case "done":
          setConversationId(event.conversationId);
          // Mark all open thinking blocks as done
          updateLastAssistantBlocks((blocks) =>
            blocks.map((b) =>
              b.kind === "thinking" ? { ...b, streaming: false } : b
            )
          );
          updateLastAssistant(() => ({ done: true }));
          break;

        case "error":
          updateLastAssistantBlocks((blocks) => {
            const hasText = blocks.some((b) => b.kind === "text");
            if (hasText) {
              return blocks.map((b) =>
                b.kind === "text"
                  ? { ...b, text: b.text || `Error: ${event.message}` }
                  : b
              );
            }
            return [
              ...blocks,
              { kind: "text", text: `Error: ${event.message}` },
            ];
          });
          updateLastAssistant(() => ({ done: true }));
          break;
      }
    },
    [updateLastAssistantBlocks, updateLastAssistant]
  );

  const answerQuestion = useCallback(
    (toolCallId: string, answer: string) => {
      // Mark the question as answered in the UI
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

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abort();
    setMessages([]);
    setConversationId(undefined);
    setConversationTitle(undefined);
  }, [abort]);

  /**
   * Load persisted conversation history from the backend and convert to
   * MessageBlock[] format for rendering. Call this when entering an existing
   * conversation (i.e. params.id !== "new").
   */
  const loadHistory = useCallback(async (convId: string) => {
    try {
      // Fetch conversation metadata (title) and messages in parallel
      const [convRes, msgRes] = await Promise.all([
        fetch(`${API_BASE}/ai/conversations/${convId}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/ai/conversations/${convId}/messages`, { headers: getAuthHeaders() }),
      ]);

      if (convRes.ok) {
        const conv = (await convRes.json()) as { title?: string };
        if (conv.title) setConversationTitle(conv.title);
      }

      const res = msgRes;
      if (!res.ok) return;

      type RawMessage = {
        id: string;
        role: "user" | "assistant" | "tool" | "question";
        content: {
          type?: string;
          text?: string;
          payload?: QuestionPayload;
          /** OpenAI call_id for question messages; required when sending the answer back */
          callId?: string;
        } | null;
        toolName?: string | null;
        toolArgs?: Record<string, unknown> | null;
        toolResult?: unknown | null;
      };

      const raw: RawMessage[] = await res.json();

      // Tools that are internal/noisy and shouldn't be shown in history
      const HIDDEN_TOOLS = new Set([
        "update_conversation_title",
      ]);

      // Build MessageBlock[] by grouping DB rows into UI message blocks.
      //
      // DB save order ≠ display order. Within each agent iteration:
      //   • tools and questions are saved DURING the stream (earlier timestamps)
      //   • thinking is saved POST-stream (later timestamp, always last in its iteration)
      //
      // Correct display order per iteration: thinking → tools → question
      //
      // Strategy: buffer every tool/question block encountered in `pending`. When
      // the `thinking` row for that iteration finally arrives, attach thinking first
      // then drain the buffer. This naturally reconstructs chronological display order.
      const blocks: MessageBlock[] = [];
      // Holds tool/question blocks waiting for the iteration's thinking block
      const pending: ContentBlock[] = [];

      const drainPending = () => {
        if (pending.length === 0) return;
        const last = blocks[blocks.length - 1];
        if (last?.type === "assistant") {
          blocks[blocks.length - 1] = {
            ...last,
            blocks: [...last.blocks, ...pending],
          };
        } else {
          // Pending tools/questions belong to the next assistant turn (no thinking yet in DB)
          const firstId =
            pending[0].kind === "tool"
              ? pending[0].state.toolCallId
              : pending[0].kind === "question"
                ? pending[0].toolCallId
                : `assistant-${blocks.length}`;
          blocks.push({
            id: firstId,
            type: "assistant",
            blocks: [...pending],
            done: true,
          });
        }
        pending.length = 0;
      };

      // Ensure a last assistant block exists; return its index.
      const getOrCreateAssistant = (fallbackId: string): number => {
        const last = blocks[blocks.length - 1];
        if (last?.type === "assistant") return blocks.length - 1;
        blocks.push({ id: fallbackId, type: "assistant", blocks: [], done: true });
        return blocks.length - 1;
      };

      for (let i = 0; i < raw.length; i++) {
        const msg = raw[i];

        if (msg.role === "user") {
          // Orphaned pending blocks (no thinking arrived) — attach to last assistant
          drainPending();
          blocks.push({
            id: msg.id,
            type: "user",
            text: msg.content?.text ?? "",
          });

        } else if (msg.role === "assistant") {
          const text = msg.content?.text ?? "";
          const type = msg.content?.type ?? "text";

          if (type === "thinking" && text) {
            // Attach thinking first, then drain buffered tools/question after it
            const thinkingBlock: ContentBlock = { kind: "thinking", text, streaming: false };
            const last = blocks[blocks.length - 1];
            if (last?.type === "assistant") {
              blocks[blocks.length - 1] = {
                ...last,
                blocks: [...last.blocks, thinkingBlock],
              };
            } else {
              blocks.push({ id: msg.id, type: "assistant", blocks: [thinkingBlock], done: true });
            }
            drainPending();

          } else if (type === "text" && text) {
            // Drain any pending blocks first (tools from a no-thinking iteration)
            drainPending();
            const idx = getOrCreateAssistant(msg.id);
            const prev = blocks[idx] as Extract<MessageBlock, { type: "assistant" }>;
            const lastContent = prev.blocks[prev.blocks.length - 1];
            if (lastContent?.kind !== "text") {
              blocks[idx] = { ...prev, blocks: [...prev.blocks, { kind: "text", text }] };
            } else {
              blocks.push({ id: msg.id, type: "assistant", blocks: [{ kind: "text", text }], done: true });
            }
          }

        } else if (msg.role === "tool") {
          const toolName = msg.toolName;
          if (!toolName || HIDDEN_TOOLS.has(toolName)) continue;

          pending.push({
            kind: "tool",
            state: {
              toolCallId: msg.id,
              name: toolName,
              label: TOOL_LABELS[toolName] ?? toolName,
              args: (msg.toolArgs as Record<string, unknown>) ?? {},
              status: "done",
              result: msg.toolResult,
            },
          });

        } else if (msg.role === "question") {
          const payload = msg.content?.payload;
          if (!payload) continue;

          const nextUser = raw.slice(i + 1).find((m) => m.role === "user");
          // Use OpenAI call_id when present so answering sends the correct id (fixes "No tool output found for function call")
          const toolCallId = msg.content?.callId ?? msg.id;

          // Buffer the question together with tools; all will be drained after thinking
          pending.push({
            kind: "question",
            toolCallId,
            payload,
            answered: !!nextUser,
            answeredValue: nextUser?.content?.text,
          });
        }
      }

      // Drain anything left at the end (e.g. conversation ends with a question)
      drainPending();

      setMessages(blocks);
      setConversationId(convId);
    } catch {
      // Fail silently — user can still start a new message
    }
  }, []);

  return {
    messages,
    conversationId,
    conversationTitle,
    streaming,
    sendMessage,
    answerQuestion,
    abort,
    reset,
    loadHistory,
  };
}
