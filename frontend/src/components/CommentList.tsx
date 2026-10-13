"use client";

import { useState } from "react";
import { CommentThread } from "@/components/CommentThread";
import type { Comment, User } from "@/lib/types";

const COLLAPSE_THRESHOLD = 3;

interface CommentListProps {
  comments: Comment[];
  currentUser: User;
  depth: number;
  onChanged: () => void;
}

/**
 * One level of a comment thread. Above COLLAPSE_THRESHOLD replies the level is
 * collapsed behind a "show N replies" button, so deep threads open level by level.
 */
export function CommentList({ comments, currentUser, depth, onChanged }: CommentListProps) {
  const [expanded, setExpanded] = useState(comments.length <= COLLAPSE_THRESHOLD);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-3 text-xs font-medium text-ink-soft underline"
      >
        Voir {comments.length} réponse{comments.length > 1 ? "s" : ""}
      </button>
    );
  }

  return (
    <>
      {comments.map((comment) => (
        <CommentThread
          key={comment.id}
          comment={comment}
          currentUser={currentUser}
          depth={depth}
          onChanged={onChanged}
        />
      ))}
    </>
  );
}
