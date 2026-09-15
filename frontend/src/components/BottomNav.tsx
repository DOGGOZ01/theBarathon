"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useChrome } from "@/lib/chrome-context";
import { Avatar } from "@/components/Avatar";

function NavIcon({ kind }: { kind: "cities" | "activity" | "notifications" | "admin" | "profile" }) {
  if (kind === "cities") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M10 21v-6h4v6" />
      </svg>
    );
  }
  if (kind === "activity") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h4l2-7 4 14 2-7h6" />
      </svg>
    );
  }
  if (kind === "notifications") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  if (kind === "admin") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21v-3.2c0-.9.6-1.7 1.4-2 2.1-.7 4.3-1.1 6.6-1.1s4.5.4 6.6 1.1c.8.3 1.4 1.1 1.4 2V21" />
        <circle cx="12" cy="7.5" r="4" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h11" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { user, logout, refreshUser } = useAuth();
  const { hideBottomNav } = useChrome();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ count: number }>("/notifications/unread-count/")
      .then((res) => setUnreadCount(res.count))
      .catch(() => {});
    // Not real-time: refetched whenever the user navigates somewhere new
    // (e.g. away from /notifications, which just marked things read).
  }, [user, pathname]);

  async function onAvatarSelected(file: File | null) {
    if (!file) return;
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      await api.patch("/auth/me/", fd);
      await refreshUser();
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  if (pathname === "/login" || pathname === "/register") return null;
  if (hideBottomNav) return null;
  if (!user) return null;

  const items: Array<{
    href?: string;
    kind: "cities" | "activity" | "notifications" | "admin" | "profile";
    label: string;
    onClick?: () => void;
    badge?: number;
  }> = [
    { href: "/", kind: "cities", label: "Villes" },
    { href: "/activity", kind: "activity", label: "Nouveautés" },
    { href: "/notifications", kind: "notifications", label: "Alertes", badge: unreadCount },
  ];
  if (user.is_admin) {
    items.push({ href: "/admin", kind: "admin", label: "Admin" });
  }
  items.push({ kind: "profile", label: "Menu", onClick: () => setSheetOpen(true) });

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-ink bg-paper-raised">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {items.map((item) => {
            const active = item.href && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
            const content = (
              <span
                className={`flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] w-full ${
                  active ? "text-ink" : "text-ink-soft"
                }`}
              >
                <span className={`relative ${active ? "rounded-block bg-yellow px-3 py-1 -mt-1" : "px-3 py-1"}`}>
                  <NavIcon kind={item.kind} />
                  {!!item.badge && (
                    <span className="anim-pop-in absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-paper-raised bg-bad px-1 text-[9px] font-bold leading-none text-paper">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium">{item.label}</span>
              </span>
            );
            return item.href ? (
              <Link key={item.label} href={item.href} className="flex-1">
                {content}
              </Link>
            ) : (
              <button key={item.label} type="button" onClick={item.onClick} className="flex-1">
                {content}
              </button>
            );
          })}
        </div>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end" role="dialog" aria-modal="true">
          <button
            aria-label="Fermer"
            className="anim-fade-in absolute inset-0 bg-ink/40"
            onClick={() => setSheetOpen(false)}
          />
          <div className="anim-sheet-in relative w-full rounded-t-[24px] border-2 border-b-0 border-ink bg-paper-raised p-5 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-pill bg-line" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                aria-label="Changer l'avatar"
                className="relative"
              >
                <Avatar user={user} size={56} />
                <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper-raised bg-yellow text-xs">
                  {avatarBusy ? "…" : "✎"}
                </span>
              </button>
              <div>
                <p className="font-display text-lg">{user.username}</p>
                <p className="text-sm text-ink-soft">{user.is_admin ? "Administrateur" : "Membre"}</p>
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onAvatarSelected(e.target.files?.[0] ?? null)}
            />
            <Link
              href="/my-places"
              onClick={() => setSheetOpen(false)}
              className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-block border-2 border-ink bg-paper font-medium shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              Mes endroits
            </Link>
            <Link
              href="/my-reviews"
              onClick={() => setSheetOpen(false)}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-block border-2 border-ink bg-paper font-medium shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              Mes avis
            </Link>
            <Link
              href="/leaderboard"
              onClick={() => setSheetOpen(false)}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-block border-2 border-ink bg-paper font-medium shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              Classement
            </Link>
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                logout();
              }}
              className="mt-2 min-h-[44px] w-full rounded-block border-2 border-ink bg-paper font-medium shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </>
  );
}
