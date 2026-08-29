"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, isApiError } from "@/lib/auth-context";

export default function RegisterPage() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(username, password, inviteCode);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Inscription impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <span className="inline-block rotate-[-2deg] rounded-block border-2 border-ink bg-yellow px-3 py-1 shadow-hard">
          <span className="font-display text-2xl font-bold">theBarathon</span>
        </span>
        <p className="mt-4 text-ink-soft">Inscription uniquement avec un code d&apos;invitation fourni par un admin.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Identifiant</span>
          <input
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="min-h-[44px] rounded-block border-2 border-ink bg-paper-raised px-4 py-2"
            autoComplete="username"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Mot de passe</span>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[44px] rounded-block border-2 border-ink bg-paper-raised px-4 py-2"
            autoComplete="new-password"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Code d&apos;invitation</span>
          <input
            required
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="min-h-[44px] rounded-block border-2 border-ink bg-paper-raised px-4 py-2 font-mono tracking-wide"
          />
        </label>

        {error && <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 min-h-[44px] rounded-block border-2 border-ink bg-yellow font-semibold shadow-hard transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
        >
          {busy ? "Création…" : "S'inscrire"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
