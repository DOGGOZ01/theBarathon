"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { StarRating } from "@/components/StarRating";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewCard } from "@/components/ReviewCard";
import { Lightbox } from "@/components/Lightbox";
import { PlaceFormSheet } from "@/components/PlaceFormSheet";
import {
  DRINKS_CRITERION_LABEL,
  PLACE_TYPES_WITH_CRITERIA,
  PLACE_TYPES_WITH_DRINKS,
  type PlaceDetail,
  type ReviewPhoto,
} from "@/lib/types";

export default function PlaceDetailPage() {
  return (
    <Suspense fallback={<main className="flex h-dvh items-center justify-center text-ink-soft">Chargement…</main>}>
      <PlaceDetailPageInner />
    </Suspense>
  );
}

function PlaceDetailPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingPlace, setEditingPlace] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [topBusy, setTopBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  function load() {
    api
      .get<PlaceDetail>(`/places/${id}/`)
      .then(setPlace)
      .catch(() => setError("Impossible de charger cet établissement"));
  }

  useEffect(load, [id]);

  useEffect(() => {
    if (!place) return;
    const focus = searchParams.get("focus");
    if (!focus) return;
    const el = document.getElementById(focus);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "box-shadow 0.3s";
    el.style.boxShadow = "0 0 0 4px var(--color-yellow)";
    const timer = setTimeout(() => {
      el.style.boxShadow = "";
    }, 2000);
    return () => clearTimeout(timer);
  }, [place, searchParams]);

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

  async function onTopVote() {
    if (!place) return;
    setTopError(null);
    setTopBusy(true);
    try {
      const res = await api.post<{ top_count: number; next_available_at: string }>(`/places/${place.id}/top/`);
      setPlace((prev) => (prev ? { ...prev, top_count: res.top_count, my_top_next_available_at: res.next_available_at } : prev));
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Impossible de voter");
    } finally {
      setTopBusy(false);
    }
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
  const hasCriteria = PLACE_TYPES_WITH_CRITERIA.includes(place.place_type);
  const hasDrinks = PLACE_TYPES_WITH_DRINKS.includes(place.place_type);
  const canEditPlace = user.is_admin || place.created_by?.id === user.id;
  const topCooldownRemaining = place.my_top_next_available_at ? formatTopCooldown(place.my_top_next_available_at) : null;

  // Coming from the feed or notifications, "back" returns there, not to the map.
  const cameFrom = searchParams.get("from");
  const backHref =
    cameFrom === "activity" ? "/activity" : cameFrom === "notifications" ? "/notifications" : `/city/${place.city}`;

  return (
    <main className="mx-auto max-w-md pb-10">
      <div className="relative aspect-[4/3] w-full border-b-2 border-ink bg-ink">
        {photo ? (
          <Image src={photo} alt={place.name} fill sizes="480px" className="object-cover opacity-90" />
        ) : (
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#2a2718_0,#2a2718_2px,transparent_2px,transparent_14px)]" />
        )}
        <Link
          href={backHref}
          className="absolute left-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-ink bg-paper-raised shadow-hard-sm"
        >
          ←
        </Link>
        <Link
          href={`/city/${place.city}?place=${place.id}`}
          className="absolute right-3 top-3 flex min-h-[44px] items-center justify-center rounded-pill border-2 border-ink bg-yellow px-3 text-sm font-medium shadow-hard-sm"
        >
          Voir sur la carte
        </Link>
      </div>

      <div className="px-4">
        <header className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words font-display text-2xl leading-tight">{place.name}</h1>
              {canEditPlace && (
                <button
                  type="button"
                  onClick={() => setEditingPlace(true)}
                  className="rounded-block border-2 border-ink bg-paper px-2 py-0.5 text-xs font-medium shadow-hard-sm"
                >
                  Modifier
                </button>
              )}
            </div>
            {place.created_by && (
              <p className="mt-1 text-xs text-ink-soft">Ajouté par {place.created_by.username}</p>
            )}
            {place.place_type === "evenement" && place.event_date && (
              <p className="mt-1 text-xs font-medium text-ink">
                📅 {new Date(place.event_date).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
              </p>
            )}
          </div>
          <div className="shrink-0 rounded-block border-2 border-ink bg-yellow px-3 py-1.5 text-center shadow-hard-sm">
            <p className="font-display text-xl leading-none">{Number(place.avg_overall).toFixed(1)}</p>
            <p className="text-[10px] font-medium">note globale</p>
          </div>
        </header>

        {(hasCriteria || Number(place.avg_spent) > 0) && (
          <div className="mt-4 flex flex-col gap-2 rounded-card border-2 border-ink bg-paper-raised p-4 shadow-hard-sm">
            {hasCriteria && (
              <>
                <SubRating label="Ambiance" value={Number(place.avg_atmosphere)} />
                {hasDrinks && (
                  <SubRating label={DRINKS_CRITERION_LABEL[place.place_type]} value={Number(place.avg_drinks)} />
                )}
                <SubRating label="Rapport qualité-prix" value={Number(place.avg_price)} />
              </>
            )}
            {Number(place.avg_spent) > 0 && (
              <div className="flex items-center justify-between border-t-2 border-line pt-2">
                <span className="text-sm text-ink-soft">Prix moyen dépensé</span>
                <span className="text-sm font-medium">{Number(place.avg_spent).toFixed(0)}€</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 rounded-card border-2 border-ink bg-paper-raised p-4 shadow-hard-sm">
          <div>
            <p className="text-xs text-ink-soft">Top établissement</p>
            <p className="font-display text-xl leading-none">{place.top_count}</p>
          </div>
          {ownReview && (
            <button
              type="button"
              onClick={onTopVote}
              disabled={topBusy || !!topCooldownRemaining}
              className="min-h-[44px] rounded-block border-2 border-ink bg-yellow px-4 text-sm font-semibold shadow-hard-sm transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
            >
              {topBusy ? "…" : topCooldownRemaining ? `Top (${topCooldownRemaining})` : "Top"}
            </button>
          )}
        </div>
        {topError && <p className="mt-2 rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{topError}</p>}

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
              placeType={place.place_type}
              existingReview={ownReview}
              onSaved={onReviewSaved}
              onCancel={ownReview ? () => setEditing(false) : undefined}
            />
          ) : (
            <ReviewCard
              review={ownReview}
              placeType={place.place_type}
              currentUser={user}
              onEdit={() => setEditing(true)}
              onDeleted={load}
              onPhotoClick={openPhotoInGallery}
              onCommentsChanged={load}
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
                  placeType={place.place_type}
                  currentUser={user}
                  onEdit={() => {}}
                  onDeleted={load}
                  onPhotoClick={openPhotoInGallery}
                  onCommentsChanged={load}
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

      {editingPlace && (
        <PlaceFormSheet
          cityId={place.city}
          place={place}
          onCancel={() => setEditingPlace(false)}
          onSaved={() => {
            setEditingPlace(false);
            load();
          }}
        />
      )}
    </main>
  );
}

function formatTopCooldown(nextAvailableAt: string): string | null {
  const diffMs = new Date(nextAvailableAt).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours > 0) return `${hours} h`;
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  return `${minutes} min`;
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
