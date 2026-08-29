"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { StarRating } from "@/components/StarRating";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewCard } from "@/components/ReviewCard";
import { Lightbox } from "@/components/Lightbox";
import type { PlaceDetail, ReviewPhoto } from "@/lib/types";

export default function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function load() {
    api
      .get<PlaceDetail>(`/places/${id}/`)
      .then(setPlace)
      .catch(() => setError("Impossible de charger cet établissement"));
  }

  useEffect(load, [id]);

  const gallery = useMemo(() => {
    if (!place) return [];
    return place.reviews.flatMap((r) => r.photos);
  }, [place]);

  const galleryUrls = useMemo(() => gallery.map((p) => mediaUrl(p.image)!).filter(Boolean), [gallery]);

  const ownReview = place?.reviews.find((r) => r.user.id === user?.id) ?? null;
  const otherReviews = place?.reviews.filter((r) => r.user.id !== user?.id) ?? [];

  function openPhotoInGallery(photo: ReviewPhoto) {
    const idx = gallery.findIndex((p) => p.id === photo.id);
    if (idx >= 0) setLightboxIndex(idx);
  }

  function onReviewSaved() {
    setEditing(false);
    load();
  }

  if (error) {
    return (
      <main className="p-6">
        <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>
      </main>
    );
  }

  if (!place || !user) {
    return <main className="flex h-dvh items-center justify-center text-ink-soft">Chargement…</main>;
  }

  const photo = mediaUrl(place.photo);

  return (
    <main className="mx-auto max-w-md pb-10">
      <div className="relative aspect-[4/3] w-full border-b-2 border-ink bg-ink">
        {photo ? (
          <Image src={photo} alt={place.name} fill sizes="480px" className="object-cover opacity-90" />
        ) : (
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#2a2718_0,#2a2718_2px,transparent_2px,transparent_14px)]" />
        )}
        <Link
          href={`/city/${place.city}`}
          className="absolute left-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-ink bg-paper-raised shadow-hard-sm"
        >
          ←
        </Link>
      </div>

      <div className="px-4">
        <header className="mt-4 flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl leading-tight">{place.name}</h1>
          <div className="shrink-0 rounded-block border-2 border-ink bg-yellow px-3 py-1.5 text-center shadow-hard-sm">
            <p className="font-display text-xl leading-none">{Number(place.avg_overall).toFixed(1)}</p>
            <p className="text-[10px] font-medium">note globale</p>
          </div>
        </header>

        <div className="mt-4 flex flex-col gap-2 rounded-card border-2 border-ink bg-paper-raised p-4 shadow-hard-sm">
          <SubRating label="Ambiance" value={Number(place.avg_atmosphere)} />
          <SubRating label="Boissons" value={Number(place.avg_drinks)} />
          <SubRating label="Rapport qualité-prix" value={Number(place.avg_price)} />
        </div>

        {gallery.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 font-display text-base">Photos ({gallery.length})</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {gallery.map((p, i) => {
                const src = mediaUrl(p.image);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="relative aspect-square overflow-hidden rounded-block border-2 border-ink"
                  >
                    {src && <Image src={src} alt="" fill sizes="160px" className="object-cover" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 font-display text-base">Votre avis</h2>
          {editing || !ownReview ? (
            <ReviewForm
              placeId={place.id}
              existingReview={ownReview}
              onSaved={onReviewSaved}
              onCancel={ownReview ? () => setEditing(false) : undefined}
            />
          ) : (
            <ReviewCard
              review={ownReview}
              currentUser={user}
              onEdit={() => setEditing(true)}
              onDeleted={load}
              onPhotoClick={openPhotoInGallery}
            />
          )}
        </section>

        {otherReviews.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-base">Avis ({otherReviews.length})</h2>
            <div className="flex flex-col gap-3">
              {otherReviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  currentUser={user}
                  onEdit={() => {}}
                  onDeleted={load}
                  onPhotoClick={openPhotoInGallery}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={galleryUrls}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </main>
  );
}

function SubRating({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-soft">{label}</span>
      <div className="flex items-center gap-2">
        <StarRating value={value} size={16} />
        <span className="w-8 text-right text-sm font-medium">{value.toFixed(1)}</span>
      </div>
    </div>
  );
}
