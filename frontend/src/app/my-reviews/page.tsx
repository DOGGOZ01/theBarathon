"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { ActivityRow } from "@/components/ActivityRow";
import type { UserProfile } from "@/lib/types";

export default function MyReviewsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<UserProfile>(`/users/${user.id}/profile/`)
      .then(setProfile)
      .catch(() => setError("Impossible de charger vos avis"));
  }, [user]);

  if (authLoading || !user) {
    return <main className="p-6 text-ink-soft">Chargement…</main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Mes avis</h1>
        <p className="text-sm text-ink-soft">Les avis que vous avez laissés</p>
      </header>

      {error && <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      {!profile && !error && <p className="text-ink-soft">Chargement…</p>}

      {profile && profile.activity.length === 0 && (
        <p className="text-ink-soft">Vous n&apos;avez encore laissé aucun avis.</p>
      )}

      {profile && profile.activity.length > 0 && (
        <div className="flex flex-col gap-2">
          {profile.activity.map((item) => (
            <ActivityRow key={`${item.type}-${item.id}`} item={item} hideActor />
          ))}
        </div>
      )}
    </main>
  );
}
