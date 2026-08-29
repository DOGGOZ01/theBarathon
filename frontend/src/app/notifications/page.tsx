"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { REACTION_GLYPHS, type AppNotification } from "@/lib/types";

function notificationHref(n: AppNotification): string {
  const focus = n.comment ? `comment-${n.comment}` : `review-${n.review}`;
  return `/place/${n.place_id}?focus=${focus}&from=notifications`;
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<AppNotification[]>("/notifications/")
      .then((data) => {
        setItems(data);
        if (data.some((n) => !n.is_read)) {
          api.post("/notifications/mark-read/").catch(() => {});
        }
      })
      .catch(() => setError("Impossible de charger les notifications"));
  }, [user]);

  if (authLoading || !user) {
    return <main className="p-6 text-ink-soft">Chargement…</main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Notifications</h1>
      </header>

      {error && <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      {!items && !error && <p className="text-ink-soft">Chargement…</p>}

      {items && items.length === 0 && <p className="text-ink-soft">Rien de nouveau pour l&apos;instant.</p>}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <Link
              key={n.id}
              href={notificationHref(n)}
              className={`flex items-start gap-3 rounded-card border-2 border-ink p-3 shadow-hard-sm ${
                n.is_read ? "bg-paper" : "bg-paper-raised"
              }`}
            >
              <Avatar user={n.actor} size={36} />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm">
                  <span className="font-medium">{n.actor.username}</span>{" "}
                  {n.verb === "reaction" ? (
                    <>
                      a réagi {REACTION_GLYPHS[n.reaction_emoji as keyof typeof REACTION_GLYPHS]} à votre message
                    </>
                  ) : n.verb === "place_activity" ? (
                    n.comment ? "a commenté sur votre établissement" : "a laissé un avis sur votre établissement"
                  ) : (
                    "a répondu à votre message"
                  )}
                </p>
                {n.preview_text && (
                  <p className="mt-0.5 truncate text-xs text-ink-soft">« {n.preview_text} »</p>
                )}
                <p className="mt-1 text-[11px] text-ink-soft">
                  {n.place_name} · {new Date(n.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-yellow" />}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
