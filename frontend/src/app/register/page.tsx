"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { useAuth, isApiError } from "@/lib/auth-context";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="flex h-dvh items-center justify-center text-ink-soft">Chargement…</main>}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const { register } = useAuth();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function onAvatarSelected(file: File | null) {
    setAvatar(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(username, password, inviteCode, avatar, nextParam);
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
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Ajouter une photo de profil"
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-paper-raised shadow-hard-sm"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl text-ink-soft">＋</span>
            )}
          </button>
          <span className="text-xs text-ink-soft">Photo de profil (facultatif)</span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onAvatarSelected(e.target.files?.[0] ?? null)}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Identifiant</span>
            <span className="text-xs text-ink-soft">{username.length}/25</span>
          </div>
          <input
            required
            autoFocus
            maxLength={25}
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
        <Link
          href={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : "/login"}
          className="font-medium text-ink underline underline-offset-4"
        >
          Se connecter
        </Link>
      </p>
    </main>
  );
}
