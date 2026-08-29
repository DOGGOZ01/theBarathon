"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { ActivityRow } from "@/components/ActivityRow";
import type { ActivityItem } from "@/lib/types";

export default function ActivityPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<ActivityItem[]>("/activity/")
      .then(setItems)
      .catch(() => setError("Impossible de charger les nouveautés"));
  }, [user]);

  if (authLoading || !user) {
    return <main className="p-6 text-ink-soft">Chargement…</main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Nouveautés</h1>
        <p className="text-sm text-ink-soft">Derniers bars et avis de la bande</p>
      </header>

      {error && <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      {!items && !error && <p className="text-ink-soft">Chargement…</p>}

      {items && items.length === 0 && <p className="text-ink-soft">Rien de nouveau pour l&apos;instant.</p>}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ActivityRow key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
