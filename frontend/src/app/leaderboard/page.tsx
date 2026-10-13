"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { PLACE_TYPE_LABELS, type LeaderboardPage, type PlaceLeaderboardRow, type UserLeaderboardRow } from "@/lib/types";

type Tab = "users" | "places";

const NEXT_PAGE_SIZE = 10;

// First page size fits the screen height, within limits.
function initialPageSize(): number {
  if (typeof window === "undefined") return 10;
  const estimatedRowHeight = 72;
  const chromeHeight = 320; // header + tabs + search + bottom nav, roughly
  const rows = Math.floor((window.innerHeight - chromeHeight) / estimatedRowHeight);
  return Math.min(15, Math.max(10, rows));
}

function rankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userRows, setUserRows] = useState<UserLeaderboardRow[]>([]);
  const [placeRows, setPlaceRows] = useState<PlaceLeaderboardRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstPageSize = useRef<number | null>(null);
  if (firstPageSize.current === null) firstPageSize.current = initialPageSize();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount/tab/search-change
    setLoading(true);
    setError(null);
    const path = tab === "users" ? "/leaderboard/users/" : "/leaderboard/places/";
    const qs = new URLSearchParams({ limit: String(firstPageSize.current), offset: "0" });
    if (debouncedSearch) qs.set("search", debouncedSearch);
    api
      .get<LeaderboardPage<UserLeaderboardRow | PlaceLeaderboardRow>>(`${path}?${qs}`)
      .then((res) => {
        if (tab === "users") setUserRows(res.results as UserLeaderboardRow[]);
        else setPlaceRows(res.results as PlaceLeaderboardRow[]);
        setHasMore(res.has_more);
      })
      .catch(() => setError("Impossible de charger le classement"))
      .finally(() => setLoading(false));
  }, [user, tab, debouncedSearch]);

  async function loadMore() {
    const path = tab === "users" ? "/leaderboard/users/" : "/leaderboard/places/";
    const offset = tab === "users" ? userRows.length : placeRows.length;
    const qs = new URLSearchParams({ limit: String(NEXT_PAGE_SIZE), offset: String(offset) });
    if (debouncedSearch) qs.set("search", debouncedSearch);
    setLoadingMore(true);
    setError(null);
    try {
      const res = await api.get<LeaderboardPage<UserLeaderboardRow | PlaceLeaderboardRow>>(`${path}?${qs}`);
      if (tab === "users") setUserRows((prev) => [...prev, ...(res.results as UserLeaderboardRow[])]);
      else setPlaceRows((prev) => [...prev, ...(res.results as PlaceLeaderboardRow[])]);
      setHasMore(res.has_more);
    } catch {
      setError("Impossible de charger la suite du classement");
    } finally {
      setLoadingMore(false);
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    setSearch("");
    setDebouncedSearch("");
  }

  if (!user) return <main className="flex h-dvh items-center justify-center text-ink-soft">Chargement…</main>;

  const rows = tab === "users" ? userRows : placeRows;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-24">
      <h1 className="mb-5 font-display text-2xl">Classement</h1>

      <div className="flex gap-1 rounded-block border-2 border-ink bg-paper-raised p-1">
        <button
          type="button"
          onClick={() => switchTab("users")}
          className={`flex-1 rounded-block py-2 text-sm font-medium ${tab === "users" ? "bg-yellow" : ""}`}
        >
          Utilisateurs
        </button>
        <button
          type="button"
          onClick={() => switchTab("places")}
          className={`flex-1 rounded-block py-2 text-sm font-medium ${tab === "places" ? "bg-yellow" : ""}`}
        >
          Établissements
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tab === "users" ? "Rechercher un utilisateur…" : "Rechercher un établissement…"}
        className="mt-3 min-h-[44px] w-full rounded-block border-2 border-ink bg-paper px-3 py-2 text-sm"
      />

      {error && <p className="mt-3 rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      <div className="mt-4 flex flex-col gap-2">
        {loading && rows.length === 0 && <p className="text-ink-soft">Chargement…</p>}
        {!loading && rows.length === 0 && !error && <p className="text-ink-soft">Aucun résultat.</p>}

        {tab === "users" &&
          userRows.map((row) => (
            <Link
              key={row.user.id}
              href={`/users/${row.user.id}`}
              className="flex items-center gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm"
            >
              <span className="w-7 shrink-0 text-center font-display text-sm">{rankBadge(row.rank)}</span>
              <Avatar user={row.user} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.user.username}</p>
                <p className="text-xs text-ink-soft">
                  {row.reviews_count} avis · {row.places_count} établissement{row.places_count > 1 ? "s" : ""} ·{" "}
                  {row.reactions_count} réaction{row.reactions_count > 1 ? "s" : ""}
                </p>
              </div>
              <div className="shrink-0 rounded-block border-2 border-ink bg-yellow px-2 py-1 text-center">
                <p className="font-display text-sm leading-none">{row.score}</p>
              </div>
            </Link>
          ))}

        {tab === "places" &&
          placeRows.map((row) => {
            const photo = mediaUrl(row.place.photo);
            return (
              <Link
                key={row.place.id}
                href={`/place/${row.place.id}`}
                className="flex items-center gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm"
              >
                <span className="w-7 shrink-0 text-center font-display text-sm">{rankBadge(row.rank)}</span>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-block border-2 border-ink bg-ink">
                  {photo && <Image src={photo} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.place.name}</p>
                  <p className="truncate text-xs text-ink-soft">{PLACE_TYPE_LABELS[row.place.place_type]}</p>
                </div>
                <div className="shrink-0 rounded-block border-2 border-ink bg-yellow px-2 py-1 text-center">
                  <p className="font-display text-sm leading-none">{row.place.top_count}</p>
                </div>
              </Link>
            );
          })}

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-2 min-h-[44px] rounded-block border-2 border-ink bg-paper font-medium shadow-hard-sm disabled:opacity-60"
          >
            {loadingMore ? "Chargement…" : "Charger 10 de plus"}
          </button>
        )}
      </div>
    </main>
  );
}
