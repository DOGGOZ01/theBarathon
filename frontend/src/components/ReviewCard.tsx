"use client";

import { useState } from "react";
import Image from "next/image";
import { api, mediaUrl } from "@/lib/api";
import { StarRating } from "@/components/StarRating";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Review, ReviewPhoto, User } from "@/lib/types";

interface ReviewCardProps {
  review: Review;
  currentUser: User;
  onEdit: () => void;
  onDeleted: () => void;
  onPhotoClick: (photo: ReviewPhoto) => void;
}

export function ReviewCard({ review, currentUser, onEdit, onDeleted, onPhotoClick }: ReviewCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
    <article className="rounded-card border-2 border-ink bg-paper-raised p-4 shadow-hard-sm">
      <header className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{review.user.username}</p>
          <p className="text-xs text-ink-soft">{new Date(review.created_at).toLocaleDateString("fr-FR")}</p>
        </div>
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

      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <RatingBadge label="Ambiance" value={review.rating_atmosphere} />
        <RatingBadge label="Boissons" value={review.rating_drinks} />
        <RatingBadge label="Prix" value={review.rating_price} />
      </div>

      {review.text && <p className="text-sm leading-relaxed">{review.text}</p>}

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
