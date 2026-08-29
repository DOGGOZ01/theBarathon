"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { CityCard } from "@/components/CityCard";
import type { City } from "@/lib/types";

export default function CitiesPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [cities, setCities] = useState<City[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<City[]>("/cities/")
      .then(setCities)
      .catch(() => setError("Impossible de charger les villes"));
  }, [user]);

  if (authLoading || !user) {
    return <main className="p-6 text-ink-soft">Chargement…</main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-2xl">Villes</h1>
        <span className="text-sm text-ink-soft">salut, {user.username}</span>
      </header>

      {error && <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      {!cities && !error && <p className="text-ink-soft">Chargement des villes…</p>}

      {cities && cities.length === 0 && (
        <p className="text-ink-soft">Aucune ville pour l&apos;instant. Un admin peut en ajouter depuis le panneau.</p>
      )}

      {cities && cities.length > 0 && (
        <div className="flex flex-col gap-4">
          {cities.map((city) => (
            <CityCard key={city.id} city={city} />
          ))}
        </div>
      )}
    </main>
  );
}
