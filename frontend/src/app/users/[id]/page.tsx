"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { ActivityRow } from "@/components/ActivityRow";
import { PlaceRow } from "@/components/PlaceRow";
import { Lightbox } from "@/components/Lightbox";
import type { UserProfile } from "@/lib/types";

type Tab = "activity" | "places";

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("activity");
  const [avatarOpen, setAvatarOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    api
      .get<UserProfile>(`/users/${id}/profile/`)
      .then(setProfile)
      .catch(() => setError("Impossible de charger ce profil"));
  }, [id, currentUser]);

  if (error) {
    return (
      <main className="p-6">
        <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>
      </main>
    );
  }

  if (!profile || !currentUser) {
    return <main className="flex h-dvh items-center justify-center text-ink-soft">Chargement…</main>;
  }

  const avatarUrl = mediaUrl(profile.user.avatar);

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={() => avatarUrl && setAvatarOpen(true)}
          aria-label="Voir la photo de profil en plein écran"
          disabled={!avatarUrl}
          className="disabled:cursor-default"
        >
          <Avatar user={profile.user} size={88} />
        </button>
        <h1 className="font-display text-xl">{profile.user.username}</h1>
      </header>

      <div className="mt-6 flex gap-1 rounded-block border-2 border-ink bg-paper-raised p-1">
        <button
          type="button"
          onClick={() => setTab("activity")}
          className={`flex-1 rounded-block py-2 text-sm font-medium ${tab === "activity" ? "bg-yellow" : ""}`}
        >
          Avis
        </button>
        <button
          type="button"
          onClick={() => setTab("places")}
          className={`flex-1 rounded-block py-2 text-sm font-medium ${tab === "places" ? "bg-yellow" : ""}`}
        >
          Établissements ajoutés
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {tab === "activity" &&
          (profile.activity.length === 0 ? (
            <p className="text-ink-soft">Aucun avis pour l&apos;instant.</p>
          ) : (
            profile.activity.map((item) => <ActivityRow key={`${item.type}-${item.id}`} item={item} hideActor />)
          ))}

        {tab === "places" &&
          (profile.places.length === 0 ? (
            <p className="text-ink-soft">Aucun établissement ajouté.</p>
          ) : (
            profile.places.map((place) => <PlaceRow key={place.id} place={place} />)
          ))}
      </div>

      {avatarOpen && avatarUrl && (
        <Lightbox images={[avatarUrl]} index={0} onClose={() => setAvatarOpen(false)} onIndexChange={() => {}} />
      )}
    </main>
  );
}
