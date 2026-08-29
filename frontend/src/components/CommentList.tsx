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

/** Renders one level of a comment thread (a review's top-level replies, or
 * one comment's nested replies). More than COLLAPSE_THRESHOLD items at this
 * level and NONE of them render — just a single "show N replies" button —
 * rather than showing a partial preview.
 *
 * This is what makes deep threads stay collapsed level-by-level instead of
 * exploding open all at once: each comment's own replies go through this
 * same component independently, so a comment only reveals its children once
 * that specific level has been expanded, regardless of how many levels are
 * nested below it. */
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
