"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { User } from "@/lib/types";

export default function AdminUsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api
      .get<User[]>("/admin/users/")
      .then(setUsers)
      .catch(() => setError("Impossible de charger les utilisateurs"));
  }

  useEffect(() => {
    if (currentUser?.is_admin) load();
  }, [currentUser]);

  if (authLoading) return <main className="p-6 text-ink-soft">Chargement…</main>;
  if (!currentUser?.is_admin) {
    return (
      <main className="flex flex-col gap-3 p-6">
        <p>Accès réservé aux administrateurs.</p>
        <Link href="/" className="font-medium text-ink underline underline-offset-4">
          Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  async function doDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/admin/users/${deleting.id}/`);
      setUsers((prev) => prev?.filter((u) => u.id !== deleting.id) ?? null);
      setDeleting(null);
    } catch {
      setError("Impossible de supprimer cet utilisateur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <Link
          href="/admin"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-ink bg-paper-raised shadow-hard-sm"
        >
          ←
        </Link>
        <h1 className="font-display text-2xl">Utilisateurs</h1>
      </header>

      {error && <p className="mb-3 rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      {!users && !error && <p className="text-ink-soft">Chargement…</p>}

      {users && (
        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const isSelf = u.id === currentUser.id;
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm"
              >
                <Link href={`/users/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={u} size={40} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.username}</p>
                    {u.is_admin && <p className="text-xs text-ink-soft">Administrateur</p>}
                  </div>
                </Link>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => setDeleting(u)}
                    className="shrink-0 rounded-block border-2 border-ink px-2.5 py-1.5 text-xs font-medium text-bad"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Supprimer cet utilisateur ?"
        description={
          deleting
            ? `Le compte de ${deleting.username} et ses avis/commentaires seront supprimés définitivement. Ses établissements et villes resteront, sans attribution.`
            : undefined
        }
        confirmLabel="Supprimer"
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
      />
    </main>
  );
}
