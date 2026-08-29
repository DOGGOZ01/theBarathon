"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CommentComposer } from "@/components/CommentComposer";
import { CommentList } from "@/components/CommentList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Lightbox } from "@/components/Lightbox";
import { ReactionBar } from "@/components/ReactionBar";
import { api, mediaUrl } from "@/lib/api";
import type { Comment, ReactionSummary, User } from "@/lib/types";

interface CommentThreadProps {
  comment: Comment;
  currentUser: User;
  depth: number;
  onChanged: () => void;
}

export function CommentThread({ comment, currentUser, depth, onChanged }: CommentThreadProps) {
  const [reaction, setReaction] = useState<ReactionSummary>({
    reactions_summary: comment.reactions_summary,
    my_reaction: comment.my_reaction,
  });
  const [replying, setReplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isOwner = comment.user.id === currentUser.id;
  const canManage = isOwner || currentUser.is_admin;
  const photoUrls = comment.photos.map((p) => mediaUrl(p.image)!).filter(Boolean);

  async function doDelete() {
    setBusy(true);
    try {
      await api.delete(`/comments/${comment.id}/`);
      onChanged();
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div id={`comment-${comment.id}`} className={depth > 0 ? "mt-3 border-l-2 border-line pl-3" : "mt-3"}>
      <div className="flex items-start gap-2">
        <Link href={`/users/${comment.user.id}`} className="shrink-0">
          <Avatar user={comment.user} size={28} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <Link href={`/users/${comment.user.id}`} className="min-w-0 truncate text-sm font-medium">
              {comment.user.username}
            </Link>
            <p className="shrink-0 text-[11px] text-ink-soft">
              {new Date(comment.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
          {comment.text && (
            <p className="mt-0.5 break-words text-sm leading-relaxed">{comment.text}</p>
          )}

          {comment.photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {comment.photos.map((photo, i) => {
                const src = mediaUrl(photo.image);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="relative h-12 w-12 overflow-hidden rounded-block border-2 border-ink"
                  >
                    {src && <Image src={src} alt="" fill sizes="48px" className="object-cover" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <ReactionBar targetType="comment" targetId={comment.id} summary={reaction} onChange={setReaction} />
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="text-xs font-medium text-ink-soft underline"
            >
              Répondre
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="text-xs font-medium text-bad underline"
              >
                Supprimer
              </button>
            )}
          </div>

          {replying && (
            <div className="mt-2">
              <CommentComposer
                target={{ type: "comment", id: comment.id }}
                onCancel={() => setReplying(false)}
                onSaved={() => {
                  setReplying(false);
                  onChanged();
                }}
              />
            </div>
          )}
        </div>
      </div>

      <CommentList comments={comment.replies} currentUser={currentUser} depth={depth + 1} onChanged={onChanged} />

      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer ce commentaire ?"
        description="Le commentaire et ses réponses seront supprimés définitivement."
        confirmLabel="Supprimer"
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      {lightboxIndex !== null && (
        <Lightbox
          images={photoUrls}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}
