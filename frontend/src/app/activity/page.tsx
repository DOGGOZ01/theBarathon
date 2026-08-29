"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import type { ActivityItem } from "@/lib/types";

function actionLabel(item: ActivityItem): string {
  if (item.type === "place") return `a ajouté ${item.place_name}`;
  if (item.type === "review") return `a laissé un avis sur ${item.place_name}`;
  return `a commenté sur ${item.place_name}`;
}

function itemLink(item: ActivityItem): { href: string; label: string } {
  if (item.type === "place") {
    return { href: `/city/${item.city_id}?place=${item.place_id}`, label: "Voir sur la carte" };
  }
  if (item.type === "review") {
    return { href: `/place/${item.place_id}?focus=review-${item.id}&from=activity`, label: "Voir l'avis" };
  }
  return { href: `/place/${item.place_id}?focus=comment-${item.id}&from=activity`, label: "Voir le commentaire" };
}

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
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
          {items.map((item) => {
            const { href, label } = itemLink(item);
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-start gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm"
              >
                <Avatar user={item.user} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{item.user?.username ?? "Quelqu'un"}</span> {actionLabel(item)}
                  </p>
                  {item.text && <p className="mt-0.5 truncate text-xs text-ink-soft">« {item.text} »</p>}
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {new Date(item.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Link
                  href={href}
                  className="shrink-0 rounded-block border-2 border-ink bg-yellow px-2.5 py-1.5 text-xs font-medium shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                >
                  {label}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
