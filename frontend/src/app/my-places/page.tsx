"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PLACE_TYPE_LABELS, type Place } from "@/lib/types";

export default function MyPlacesPage() {
  const { user, loading: authLoading } = useAuth();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<Place[]>("/places/mine/")
      .then(setPlaces)
      .catch(() => setError("Impossible de charger vos établissements"));
  }, [user]);

  if (authLoading || !user) {
    return <main className="p-6 text-ink-soft">Chargement…</main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Mes endroits</h1>
        <p className="text-sm text-ink-soft">Établissements que vous avez ajoutés</p>
      </header>

      {error && <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      {!places && !error && <p className="text-ink-soft">Chargement…</p>}

      {places && places.length === 0 && (
        <p className="text-ink-soft">Vous n&apos;avez encore ajouté aucun établissement.</p>
      )}

      {places && places.length > 0 && (
        <div className="flex flex-col gap-3">
          {places.map((place) => {
            const photo = mediaUrl(place.photo);
            return (
              <Link
                key={place.id}
                href={`/place/${place.id}`}
                className="flex items-center gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-block border-2 border-ink bg-ink">
                  {photo && <Image src={photo} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{place.name}</p>
                  <p className="text-xs text-ink-soft">{PLACE_TYPE_LABELS[place.place_type]}</p>
                </div>
                <div className="shrink-0 rounded-block border-2 border-ink bg-yellow px-2 py-1 text-center">
                  <p className="font-display text-sm leading-none">{Number(place.avg_overall).toFixed(1)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
