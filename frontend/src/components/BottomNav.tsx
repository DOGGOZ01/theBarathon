"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

function NavIcon({ kind }: { kind: "cities" | "admin" | "profile" }) {
  if (kind === "cities") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M10 21v-6h4v6" />
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
  const { user, logout } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (pathname === "/login" || pathname === "/register") return null;
  if (!user) return null;

  const items: Array<{ href?: string; kind: "cities" | "admin" | "profile"; label: string; onClick?: () => void }> = [
    { href: "/", kind: "cities", label: "Villes" },
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
                <span className={active ? "rounded-block bg-yellow px-3 py-1 -mt-1" : "px-3 py-1"}>
                  <NavIcon kind={item.kind} />
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
            className="absolute inset-0 bg-ink/40"
            onClick={() => setSheetOpen(false)}
          />
          <div className="relative w-full rounded-t-[24px] border-2 border-b-0 border-ink bg-paper-raised p-5 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-pill bg-line" />
            <p className="font-display text-lg">{user.username}</p>
            <p className="mb-4 text-sm text-ink-soft">{user.is_admin ? "Administrateur" : "Membre"}</p>
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                logout();
              }}
              className="min-h-[44px] w-full rounded-block border-2 border-ink bg-paper font-medium shadow-hard-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </>
  );
}
