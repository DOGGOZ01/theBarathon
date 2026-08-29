"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { api, mediaUrl, ApiError } from "@/lib/api";
import { StarRating } from "@/components/StarRating";
import { DRINKS_CRITERION_LABEL, PLACE_TYPES_WITH_DRINKS, type PlaceType, type Review, type ReviewPhoto } from "@/lib/types";

const MAX_PHOTOS = 5;

interface ReviewFormProps {
  placeId: number;
  placeType: PlaceType;
  existingReview: Review | null;
  onSaved: (review: Review) => void;
  onCancel?: () => void;
}

export function ReviewForm({ placeId, placeType, existingReview, onSaved, onCancel }: ReviewFormProps) {
  const hasDrinks = PLACE_TYPES_WITH_DRINKS.includes(placeType);
  const [atmosphere, setAtmosphere] = useState(existingReview?.rating_atmosphere ?? 0);
  const [drinks, setDrinks] = useState(existingReview?.rating_drinks ?? 0);
  const [price, setPrice] = useState(existingReview?.rating_price ?? 0);
  const [amountSpent, setAmountSpent] = useState(existingReview?.amount_spent ?? "");
  const [text, setText] = useState(existingReview?.text ?? "");
  const [photos, setPhotos] = useState<ReviewPhoto[]>(existingReview?.photos ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Tracks the review id once create/update has succeeded, so that if a
  // later step (photo upload) fails and the user retries, we PATCH the
  // already-created review instead of POSTing a duplicate (which would
  // 409 since a review already exists for this user+place).
  const [savedReviewId, setSavedReviewId] = useState<number | null>(existingReview?.id ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slotsLeft = MAX_PHOTOS - photos.length - newFiles.length;

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, slotsLeft);
    setNewFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeExistingPhoto(photo: ReviewPhoto) {
    try {
      await api.delete(`/photos/${photo.id}/`);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch {
      setError("Impossible de supprimer la photo");
    }
  }

  function removeNewFile(idx: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!atmosphere || !price || (hasDrinks && !drinks)) {
      setError(hasDrinks ? "Notez les trois critères" : "Notez les deux critères");
      return;
    }
    setBusy(true);
    try {
      const body = {
        rating_atmosphere: atmosphere,
        rating_drinks: hasDrinks ? drinks : null,
        rating_price: price,
        amount_spent: amountSpent.trim() === "" ? null : amountSpent,
        text,
      };
      const review = savedReviewId
        ? await api.patch<Review>(`/reviews/${savedReviewId}/`, body)
        : await api.post<Review>(`/places/${placeId}/reviews/`, body);
      setSavedReviewId(review.id);

      // Upload sequentially and drop each file from state as soon as it
      // succeeds, so a failure partway through only leaves the
      // not-yet-uploaded files queued for the next retry (instead of
      // re-sending photos that already made it to the server).
      let remaining = newFiles;
      while (remaining.length > 0) {
        const [file, ...rest] = remaining;
        const fd = new FormData();
        fd.append("image", file);
        await api.post(`/reviews/${review.id}/photos/`, fd);
        remaining = rest;
        setNewFiles(remaining);
      }

      const fresh = await api.get<Review>(`/reviews/${review.id}/`).catch(() => review);
      onSaved(fresh);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Vous avez déjà laissé un avis pour cet établissement");
      } else {
        setError(err instanceof Error ? err.message : "Impossible d'enregistrer l'avis");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="anim-fade-in-up flex flex-col gap-4 rounded-card border-2 border-ink bg-paper-raised p-4 shadow-hard">
      <div className="grid grid-cols-1 gap-3">
        <RatingRow label="Ambiance" value={atmosphere} onChange={setAtmosphere} />
        {hasDrinks && <RatingRow label={DRINKS_CRITERION_LABEL[placeType]} value={drinks} onChange={setDrinks} />}
        <RatingRow label="Rapport qualité-prix" value={price} onChange={setPrice} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Montant dépensé (€, facultatif)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amountSpent}
          onChange={(e) => setAmountSpent(e.target.value)}
          placeholder="ex : 25"
          className="min-h-[44px] rounded-block border-2 border-ink bg-paper px-3 py-2 text-sm"
        />
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Vos impressions (facultatif)"
        rows={3}
        maxLength={2000}
        className="rounded-block border-2 border-ink bg-paper px-3 py-2 text-sm"
      />
      <p className="-mt-2 text-right text-xs text-ink-soft">{text.length}/2000</p>

      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => {
          const src = mediaUrl(photo.image);
          return (
            <div key={photo.id} className="relative h-16 w-16">
              <div className="absolute inset-0 overflow-hidden rounded-block border-2 border-ink">
                {src && <Image src={src} alt="" fill sizes="64px" className="object-cover" />}
              </div>
              <button
                type="button"
                onClick={() => removeExistingPhoto(photo)}
                aria-label="Supprimer la photo"
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper-raised bg-ink text-xs text-paper after:absolute after:-inset-2.5 after:content-['']"
              >
                ✕
              </button>
            </div>
          );
        })}
        {newFiles.map((file, idx) => (
          <div key={idx} className="relative h-16 w-16">
            <div className="h-full w-full overflow-hidden rounded-block border-2 border-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
            </div>
            <button
              type="button"
              onClick={() => removeNewFile(idx)}
              aria-label="Retirer la photo"
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper-raised bg-ink text-xs text-paper after:absolute after:-inset-2.5 after:content-['']"
            >
              ✕
            </button>
          </div>
        ))}
        {slotsLeft > 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-16 w-16 flex-col items-center justify-center rounded-block border-2 border-dashed border-ink-soft text-ink-soft"
          >
            <span className="text-xl leading-none">+</span>
            <span className="text-[10px]">photo</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {error && <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] flex-1 rounded-block border-2 border-ink bg-yellow font-semibold shadow-hard-sm transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-60"
        >
          {busy ? "Enregistrement…" : existingReview ? "Enregistrer" : "Publier"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-block border-2 border-ink bg-paper px-4 font-medium"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <StarRating value={value} onChange={onChange} size={26} label={label} />
    </div>
  );
}
