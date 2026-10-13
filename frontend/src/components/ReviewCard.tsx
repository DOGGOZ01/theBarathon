"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api";
import { StarRating } from "@/components/StarRating";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Avatar } from "@/components/Avatar";
import { ReactionBar } from "@/components/ReactionBar";
import { CommentList } from "@/components/CommentList";
import { CommentComposer } from "@/components/CommentComposer";
import { DRINKS_CRITERION_LABEL, type PlaceType, type ReactionSummary, type Review, type ReviewPhoto, type User } from "@/lib/types";

interface ReviewCardProps {
  review: Review;
  placeType: PlaceType;
  currentUser: User;
  onEdit: () => void;
  onDeleted: () => void;
  onPhotoClick: (photo: ReviewPhoto) => void;
  onCommentsChanged: () => void;
}

export function ReviewCard({
  review,
  placeType,
  currentUser,
  onEdit,
  onDeleted,
  onPhotoClick,
  onCommentsChanged,
}: ReviewCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reaction, setReaction] = useState<ReactionSummary>({
    reactions_summary: review.reactions_summary,
    my_reaction: review.my_reaction,
  });
  const [replying, setReplying] = useState(false);
  const isOwner = review.user.id === currentUser.id;
  const canManage = isOwner || currentUser.is_admin;

  async function doDelete() {
    setBusy(true);
    try {
      await api.delete(`/reviews/${review.id}/`);
      onDeleted();
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  return (
    <article id={`review-${review.id}`} className="rounded-card border-2 border-ink bg-paper-raised p-4 shadow-hard-sm">
      <header className="mb-2 flex items-start justify-between gap-2">
        <Link href={`/users/${review.user.id}`} className="flex min-w-0 items-center gap-2">
          <Avatar user={review.user} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium">{review.user.username}</p>
            <p className="text-xs text-ink-soft">{new Date(review.created_at).toLocaleDateString("fr-FR")}</p>
          </div>
        </Link>
        {canManage && (
          <div className="flex gap-1">
            {isOwner && (
              <button
                type="button"
                onClick={onEdit}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-block border-2 border-ink px-2 text-xs font-medium"
              >
                Modifier
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-block border-2 border-ink px-2 text-xs font-medium text-bad"
            >
              Supprimer
            </button>
          </div>
        )}
      </header>

      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {review.rating_atmosphere !== null && <RatingBadge label="Ambiance" value={review.rating_atmosphere} />}
        {review.rating_drinks !== null && (
          <RatingBadge label={DRINKS_CRITERION_LABEL[placeType]} value={review.rating_drinks} />
        )}
        {review.rating_price !== null && <RatingBadge label="Qualité-prix" value={review.rating_price} />}
        {review.rating_overall !== null && <RatingBadge label="Note globale" value={review.rating_overall} />}
        {review.amount_spent && (
          <span className="inline-flex items-center gap-1 rounded-pill border-2 border-ink bg-paper px-2 py-0.5">
            💶 {Number(review.amount_spent).toFixed(0)}€
          </span>
        )}
      </div>

      {review.text && <p className="break-words text-sm leading-relaxed">{review.text}</p>}

      {review.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((photo) => {
            const src = mediaUrl(photo.image);
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => onPhotoClick(photo)}
                className="relative h-16 w-16 overflow-hidden rounded-block border-2 border-ink"
              >
                {src && <Image src={src} alt="" fill sizes="64px" className="object-cover" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ReactionBar targetType="review" targetId={review.id} summary={reaction} onChange={setReaction} />
        <button
          type="button"
          onClick={() => setReplying((v) => !v)}
          className="text-xs font-medium text-ink-soft underline"
        >
          Répondre
        </button>
      </div>

      {replying && (
        <div className="mt-2">
          <CommentComposer
            target={{ type: "review", id: review.id }}
            onCancel={() => setReplying(false)}
            onSaved={() => {
              setReplying(false);
              onCommentsChanged();
            }}
          />
        </div>
      )}

      {review.comments.length > 0 && (
        <div className="mt-1">
          <CommentList comments={review.comments} currentUser={currentUser} depth={0} onChanged={onCommentsChanged} />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer cet avis ?"
        description={isOwner ? "L'avis et ses photos seront supprimés définitivement." : `Supprimer l'avis de ${review.user.username} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </article>
  );
}

function RatingBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border-2 border-ink bg-yellow-pale px-2 py-0.5">
      {label}
      <StarRating value={value} size={12} />
    </span>
  );
}
