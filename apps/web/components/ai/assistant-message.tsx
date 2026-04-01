"use client";

import { ThinkingBlock } from "@/components/ai/thinking-block";
import { ToolExecution } from "@/components/ai/tool-execution";
import { QuestionCard } from "@/components/ai/question-card";
import { JournalEntryReviewCard } from "@/components/ai/journal-entry-review-card";
import { ImagePreviewCard } from "@/components/linkedin/image-preview-card";
import { PostDraftCard, type PostDraftData } from "@/components/linkedin/post-draft-card";
import { PostCarousel } from "@/components/linkedin/post-carousel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessageBlock } from "@/hooks/use-chat-stream";

type AssistantMsg = Extract<MessageBlock, { type: "assistant" }>;

interface AssistantMessageProps {
  msg: AssistantMsg;
  msgIdx: number;
  messages: MessageBlock[];
  streaming: boolean;
  postedEntryIds: Set<string>;
  pendingEntryRefs: { current: Record<string, HTMLDivElement | null> };
  onPostStatusChange: (postId: string, status: string) => void;
  onAnswerQuestion: (toolCallId: string, answer: string) => void;
  onSendMessage: (text: string) => void;
}

export function AssistantMessage({
  msg,
  msgIdx,
  messages,
  streaming,
  postedEntryIds,
  pendingEntryRefs,
  onPostStatusChange,
  onAnswerQuestion,
  onSendMessage,
}: AssistantMessageProps) {
  const POST_TOOL_NAMES = ["create_linkedin_post", "schedule_linkedin_post", "bulk_create_drafts"];
  const postDrafts: PostDraftData[] = [];
  const skipToolCallIds = new Set<string>();

  for (const block of msg.blocks) {
    if (block.kind !== "tool" || block.state.status !== "done" || !block.state.result) continue;
    if (block.state.name === "bulk_create_drafts") {
      const result = block.state.result as { posts?: PostDraftData[] };
      if (result.posts) {
        for (const p of result.posts) postDrafts.push(p);
        skipToolCallIds.add(block.state.toolCallId);
      }
    } else if (POST_TOOL_NAMES.includes(block.state.name)) {
      const post = block.state.result as PostDraftData;
      if (post?.id && post?.content) {
        postDrafts.push(post);
        skipToolCallIds.add(block.state.toolCallId);
      }
    }
    if (block.state.name === "suggest_image_prompt") {
      skipToolCallIds.add(block.state.toolCallId);
    }
  }

  const carouselBlockId = postDrafts.length > 0
    ? (msg.blocks.find((block) => block.kind === "tool" && skipToolCallIds.has((block as Extract<typeof block, { kind: "tool" }>).state.toolCallId)) as Extract<(typeof msg.blocks)[number], { kind: "tool" }> | undefined)?.state.toolCallId
    : undefined;

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold mt-0.5">
        Z
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {msg.blocks.map((block, blockIdx) => {
          if (block.kind === "thinking") {
            return (
              <ThinkingBlock key={blockIdx} text={block.text} isStreaming={block.streaming} />
            );
          }
          if (block.kind === "tool") {
            if (block.state.toolCallId === carouselBlockId) {
              if (postDrafts.length >= 2) {
                return (
                  <div
                    key={`carousel-${msg.blocks[0]?.kind === "tool" ? (msg.blocks[0] as { state: { toolCallId: string } }).state.toolCallId : blockIdx}`}
                    className="w-full my-2"
                  >
                    <PostCarousel posts={postDrafts} onStatusChange={onPostStatusChange} />
                  </div>
                );
              }
              return (
                <div key={block.state.toolCallId} className="flex justify-center w-full my-2">
                  <div className="w-full max-w-[560px]">
                    <PostDraftCard post={postDrafts[0]} onStatusChange={onPostStatusChange} />
                  </div>
                </div>
              );
            }
            if (skipToolCallIds.has(block.state.toolCallId)) return null;

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
                <div
                  key={block.state.toolCallId}
                  ref={(el) => {
                    if (entry.id) pendingEntryRefs.current[entry.id] = el;
                  }}
                >
                  <JournalEntryReviewCard
                    entry={entry}
                    approved={postedEntryIds.has(entry.id)}
                    onApprove={(entryId, entryNumber) => {
                      onSendMessage(`Contabiliza el asiento #${entryNumber} (id: ${entryId})`);
                    }}
                  />
                </div>
              );
            }

            if (
              (block.state.name === "create_linkedin_post" ||
                block.state.name === "schedule_linkedin_post") &&
              block.state.status === "done" &&
              block.state.result
            ) {
              const post = block.state.result as PostDraftData;
              if (post?.id && post?.content) {
                return (
                  <div key={block.state.toolCallId} className="flex justify-center w-full my-2">
                    <div className="w-full max-w-[560px]">
                      <PostDraftCard post={post} onStatusChange={onPostStatusChange} />
                    </div>
                  </div>
                );
              }
            }

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
        {streaming &&
          !msg.done &&
          !msg.blocks.some((b) => b.kind === "text") &&
          !msg.blocks.some((b) => b.kind === "tool" && b.state.status === "running") &&
          (() => {
            const prevMsg = messages[msgIdx - 1];
            const hasImages =
              prevMsg?.type === "user" &&
              ((prevMsg.uploadedImages && prevMsg.uploadedImages.length > 0) ||
                (prevMsg.docs && prevMsg.docs.some((d) => d.mimeType.startsWith("image/"))));
            const hasDocs =
              prevMsg?.type === "user" &&
              prevMsg.docs &&
              prevMsg.docs.length > 0 &&
              !hasImages;
            const label = hasImages
              ? "Analizando imagen…"
              : hasDocs
                ? "Analizando documento…"
                : "Pensando…";
            return (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground animate-pulse">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </span>
                <span>{label}</span>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
