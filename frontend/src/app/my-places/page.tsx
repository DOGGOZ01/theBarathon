"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PlaceRow } from "@/components/PlaceRow";
import type { Place } from "@/lib/types";

export default function MyPlacesPage() {
  const { user, loading: authLoading } = useRequireAuth();
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
          {places.map((place) => (
            <PlaceRow key={place.id} place={place} />
          ))}
        </div>
      )}
    </main>
  );
}
