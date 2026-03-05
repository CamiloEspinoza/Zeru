"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLinkedInChatStream, type ContentBlock } from "@/hooks/use-linkedin-chat-stream";
import { ThinkingBlock } from "@/components/ai/thinking-block";
import { ToolExecution } from "@/components/ai/tool-execution";
import { QuestionCard } from "@/components/ai/question-card";
import { PostPreviewCard } from "@/components/linkedin/post-preview-card";
import { ImagePreviewCard } from "@/components/linkedin/image-preview-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ConversationTitle({ title, animate }: { title: string; animate: boolean }) {
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
      {cursor && <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse rounded-sm" />}
    </h1>
  );
}

function renderBlock(block: ContentBlock, idx: number, isLast: boolean, streaming: boolean, onAnswerQuestion: (toolCallId: string, answer: string) => void, onPublishPost: (postId: string) => void, onCancelPost: (postId: string) => void) {
  if (block.kind === "thinking") {
    return <ThinkingBlock key={idx} text={block.text} isStreaming={block.streaming} />;
  }

  if (block.kind === "tool") {
    // Render post preview card for create/schedule post results
    if (
      (block.state.name === "create_linkedin_post" || block.state.name === "schedule_linkedin_post") &&
      block.state.status === "done" &&
      block.state.result
    ) {
      const post = block.state.result as {
        id: string;
        content: string;
        mediaType: string;
        mediaUrl?: string | null;
        imageS3Key?: string | null;
        status: string;
        scheduledAt?: string | null;
        contentPillar?: string | null;
        visibility: string;
      };
      return (
        <PostPreviewCard
          key={block.state.toolCallId}
          post={post}
          onApprove={post.status === "PENDING_APPROVAL" ? onPublishPost : undefined}
          onReject={post.status === "PENDING_APPROVAL" ? onCancelPost : undefined}
        />
      );
    }

    // Render image preview for generate_image results
    if (
      block.state.name === "generate_image" &&
      block.state.status === "done" &&
      block.state.result
    ) {
      const img = block.state.result as { s3Key: string; imageUrl: string; mimeType: string };
      if (img.imageUrl) {
        return <ImagePreviewCard key={block.state.toolCallId} image={img} />;
      }
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
        onAnswer={onAnswerQuestion}
        answered={block.answered}
        answeredValue={block.answeredValue}
      />
    );
  }

  if (block.kind === "text") {
    const showCursor = isLast && !streaming;
    return (
      <div
        key={idx}
        className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
          prose-headings:font-semibold prose-headings:text-foreground
          prose-p:text-foreground prose-p:leading-relaxed
          prose-strong:text-foreground prose-strong:font-semibold
          prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
          prose-pre:bg-muted prose-pre:rounded-md
          prose-ul:text-foreground prose-ol:text-foreground
          prose-li:text-foreground
          prose-a:text-primary"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {showCursor ? block.text + "▋" : block.text}
        </ReactMarkdown>
      </div>
    );
  }

  return null;
}

const SUGGESTIONS = [
  "Crea un post sobre liderazgo en startups",
  "Programa 5 posts para esta semana",
  "Genera un calendario de contenido para 30 días",
  "¿Cómo puedo mejorar mi estrategia de contenido?",
];

export default function LinkedInChatPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";

  const { messages, conversationId, conversationTitle, streaming, sendMessage, answerQuestion, reset, loadHistory } =
    useLinkedInChatStream();

  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const SCROLL_BOTTOM_THRESHOLD = 100;

  const handleScrollContainerScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    setAutoScrollEnabled(scrollHeight - scrollTop - clientHeight <= SCROLL_BOTTOM_THRESHOLD);
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
      router.replace(`/linkedin/${conversationId}`);
    }
  }, [isNew, conversationId, router]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setAutoScrollEnabled(true);
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePublishPost = useCallback(async (postId: string) => {
    try {
      await api.post(`/linkedin/posts/${postId}/publish`, {});
      await sendMessage(`El post ${postId} fue aprobado y publicado en LinkedIn.`);
    } catch {
      await sendMessage(`Error al publicar el post ${postId}. Por favor intenta de nuevo.`);
    }
  }, [sendMessage]);

  const handleCancelPost = useCallback(async (postId: string) => {
    try {
      await api.post(`/linkedin/posts/${postId}/cancel`, {});
      await sendMessage(`El post ${postId} fue cancelado.`);
    } catch {
      await sendMessage(`Error al cancelar el post ${postId}.`);
    }
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0A66C2]">
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </div>
        <ConversationTitle
          title={conversationTitle ?? (isNew ? "Agente LinkedIn" : "Cargando...")}
          animate={!!conversationTitle}
        />
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScrollContainerScroll}
        className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0A66C2]/10">
              <svg className="h-8 w-8 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">Agente LinkedIn de Zeru</p>
              <p className="text-sm mt-1 max-w-md">
                Puedo crear posts, programar calendarios de contenido, generar imágenes con Gemini y publicar directamente en LinkedIn.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
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
                <div className="max-w-[75%]">
                  <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground text-sm">
                    {msg.text}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {msg.blocks.map((block, blockIdx) =>
                    renderBlock(
                      block,
                      blockIdx,
                      blockIdx === msg.blocks.length - 1 && streaming && !msg.done,
                      streaming && !msg.done,
                      answerQuestion,
                      handlePublishPost,
                      handleCancelPost,
                    )
                  )}
                  {msg.blocks.length === 0 && streaming && !msg.done && (
                    <div className="my-2 rounded-md border border-border/50 bg-muted/30 overflow-hidden">
                      <div className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>El agente está pensando...</span>
                      </div>
                    </div>
                  )}
                  {msg.blocks.length > 0 && streaming && !msg.done && (() => {
                    const last = msg.blocks[msg.blocks.length - 1];
                    return last?.kind === "tool" && last.state.status === "done";
                  })() && (
                    <div className="my-2 rounded-md border border-border/50 bg-muted/30 overflow-hidden">
                      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
                        <span className="flex gap-0.5">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                          <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                          <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                        </span>
                        Procesando...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-6 pt-4 pb-5 shrink-0">
        <div className={cn(
          "rounded-xl border bg-background shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring"
        )}>
          <div className="flex items-end gap-2 px-4 py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje al agente de LinkedIn..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {streaming ? (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0 bg-[#0A66C2] hover:bg-[#004182]"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          El agente puede generar contenido automáticamente. Revisa antes de publicar.
        </p>
      </div>
    </div>
  );
}
