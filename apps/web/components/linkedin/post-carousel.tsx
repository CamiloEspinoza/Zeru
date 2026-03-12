"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api-client";
import { PostDraftCard, type PostDraftData } from "./post-draft-card";

const STATUS_DOT_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-400",
  PENDING_APPROVAL: "bg-amber-400",
  SCHEDULED: "bg-blue-500",
  PUBLISHED: "bg-green-500",
  CANCELLED: "bg-red-400",
  FAILED: "bg-red-500",
};

export function PostCarousel({
  posts: initialPosts,
  onStatusChange: onStatusChangeProp,
}: {
  posts: PostDraftData[];
  onStatusChange?: (postId: string, newStatus: string) => void;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [currentPage, setCurrentPage] = useState(0);

  // Refetch current status for all posts when IDs change — tool results from history are snapshots
  const postIds = initialPosts.map((p) => p.id).join(",");
  useEffect(() => {
    if (initialPosts.length === 0) return;
    Promise.all(
      initialPosts.map((p) =>
        api.get<PostDraftData>(`/linkedin/posts/${p.id}`).catch(() => p)
      )
    ).then(setPosts);
  }, [postIds]);

  // Show 3 per page on large, 2 on medium, 1 on small (handled by grid CSS)
  const postsPerPage = 3;
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const startIdx = currentPage * postsPerPage;
  const visiblePosts = posts.slice(startIdx, startIdx + postsPerPage);

  const approvedCount = posts.filter((p) => ["SCHEDULED", "PUBLISHED"].includes(p.status)).length;

  const handleStatusChange = useCallback((postId: string, newStatus: string) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: newStatus } : p)));
    onStatusChangeProp?.(postId, newStatus);
  }, [onStatusChangeProp]);

  const prevPage = () => setCurrentPage((p) => Math.max(0, p - 1));
  const nextPage = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));

  return (
    <div className="w-full space-y-3 my-3">
      {/* Header with status dots */}
      <div className="flex items-center gap-3 px-1">
        {/* Status dots */}
        <div className="flex items-center gap-1 flex-wrap flex-1">
          {posts.map((post, i) => (
            <button
              key={post.id}
              onClick={() => setCurrentPage(Math.floor(i / postsPerPage))}
              className={`h-2.5 w-2.5 rounded-full transition-all ${
                STATUS_DOT_COLORS[post.status] ?? "bg-gray-400"
              } ${
                i >= startIdx && i < startIdx + postsPerPage
                  ? "ring-2 ring-offset-1 ring-primary/30"
                  : "opacity-60 hover:opacity-100"
              }`}
              title={`Post ${i + 1} — ${post.status}`}
            />
          ))}
        </div>
        {/* Counter */}
        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
          {approvedCount}/{posts.length} aprobados
        </span>
      </div>

      {/* Navigation + Cards */}
      <div className="flex items-stretch gap-2">
        {/* Left arrow */}
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="shrink-0 flex items-center justify-center w-8 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Cards grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
          {visiblePosts.map((post) => (
            <PostDraftCard
              key={post.id}
              post={post}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages - 1}
          className="shrink-0 flex items-center justify-center w-8 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Página siguiente"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Page indicator */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === currentPage
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
