"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api, mediaUrl } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InviteCodeCard } from "@/components/admin/InviteCodeCard";
import { MapPickerOverlay } from "@/components/MapPickerOverlay";
import { CityFormSheet } from "@/components/admin/CityFormSheet";
import { PlaceFormSheet } from "@/components/PlaceFormSheet";
import type { City, Place } from "@/lib/types";

const WORLD_CENTER: [number, number] = [30, 10];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);

  const [cityPicking, setCityPicking] = useState(false);
  const [cityFormPin, setCityFormPin] = useState<[number, number] | null>(null);
  const [cityFormOpen, setCityFormOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [deletingCity, setDeletingCity] = useState<City | null>(null);
  const [deletingCityBusy, setDeletingCityBusy] = useState(false);

  const [placePicking, setPlacePicking] = useState(false);
  const [placeFormPin, setPlaceFormPin] = useState<[number, number] | null>(null);
  const [placeFormOpen, setPlaceFormOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [deletingPlace, setDeletingPlace] = useState<Place | null>(null);
  const [deletingPlaceBusy, setDeletingPlaceBusy] = useState(false);

  const [reordering, setReordering] = useState(false);

  function loadCities() {
    api.get<City[]>("/cities/").then((cs) => {
      setCities(cs);
      setSelectedCityId((prev) => prev ?? cs[0]?.id ?? null);
    });
  }

  async function moveCity(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= cities.length) return;
    const reordered = [...cities];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setCities(reordered);
    setReordering(true);
    try {
      await api.post<City[]>("/cities/reorder/", { order: reordered.map((c) => c.id) });
    } finally {
      setReordering(false);
    }
  }

  useEffect(loadCities, []);

  useEffect(() => {
    if (selectedCityId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing derived list when the selection is cleared
      setPlaces([]);
      return;
    }
    api.get<Place[]>(`/cities/${selectedCityId}/places/`).then(setPlaces);
  }, [selectedCityId]);

  if (loading) return <main className="p-6 text-ink-soft">Chargement…</main>;
  if (!user?.is_admin) {
    return <main className="p-6">Accès réservé aux administrateurs.</main>;
  }

  const selectedCity = cities.find((c) => c.id === selectedCityId) ?? null;

  async function deleteCity() {
    if (!deletingCity) return;
    setDeletingCityBusy(true);
    try {
      await api.delete(`/cities/${deletingCity.id}/`);
      setDeletingCity(null);
      if (selectedCityId === deletingCity.id) setSelectedCityId(null);
      loadCities();
    } finally {
      setDeletingCityBusy(false);
    }
  }

  async function deletePlace() {
    if (!deletingPlace) return;
    setDeletingPlaceBusy(true);
    try {
      await api.delete(`/places/${deletingPlace.id}/`);
      setDeletingPlace(null);
      if (selectedCityId != null) {
        const fresh = await api.get<Place[]>(`/cities/${selectedCityId}/places/`);
        setPlaces(fresh);
      }
    } finally {
      setDeletingPlaceBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-10">
      <h1 className="mb-5 font-display text-2xl">Panneau d&apos;administration</h1>

      <div className="flex flex-col gap-6">
        <InviteCodeCard />

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-base">Villes ({cities.length})</h2>
            <button
              type="button"
              onClick={() => setCityPicking(true)}
              className="min-h-[44px] rounded-block border-2 border-ink bg-yellow px-3 text-sm font-semibold shadow-hard-sm"
            >
              + Ville
            </button>
          </div>
          <p className="mb-2 text-xs text-ink-soft">Les flèches changent l&apos;ordre d&apos;affichage dans la liste des villes.</p>
          <div className="flex flex-col gap-2">
            {cities.map((city, index) => (
              <div key={city.id} className="flex items-center gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={index === 0 || reordering}
                    onClick={() => moveCity(index, -1)}
                    aria-label="Monter"
                    className="flex h-5 w-7 items-center justify-center rounded-block border-2 border-ink text-xs disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={index === cities.length - 1 || reordering}
                    onClick={() => moveCity(index, 1)}
                    aria-label="Descendre"
                    className="flex h-5 w-7 items-center justify-center rounded-block border-2 border-ink text-xs disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-block border-2 border-ink bg-ink">
                  {mediaUrl(city.photo) && <Image src={mediaUrl(city.photo)!} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{city.name}</p>
                  <p className="truncate text-xs text-ink-soft">{city.country}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCity(city)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-block border-2 border-ink px-2 text-xs font-medium"
                >
                  Mod.
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingCity(city)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-block border-2 border-ink px-2 text-xs font-medium text-bad"
                >
                  Suppr.
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-base">Établissements</h2>
            <button
              type="button"
              disabled={!selectedCity}
              onClick={() => setPlacePicking(true)}
              className="min-h-[44px] rounded-block border-2 border-ink bg-yellow px-3 text-sm font-semibold shadow-hard-sm disabled:opacity-50"
            >
              + Établissement
            </button>
          </div>

          <select
            value={selectedCityId ?? ""}
            onChange={(e) => setSelectedCityId(Number(e.target.value))}
            className="mb-3 min-h-[44px] w-full rounded-block border-2 border-ink bg-paper-raised px-3"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex flex-col gap-2">
            {places.map((place) => (
              <div key={place.id} className="flex items-center gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard-sm">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-block border-2 border-ink bg-ink">
                  {mediaUrl(place.photo) && <Image src={mediaUrl(place.photo)!} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{place.name}</p>
                  <p className="text-xs text-ink-soft">★ {Number(place.avg_overall).toFixed(1)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPlace(place)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-block border-2 border-ink px-2 text-xs font-medium"
                >
                  Mod.
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingPlace(place)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-block border-2 border-ink px-2 text-xs font-medium text-bad"
                >
                  Suppr.
                </button>
              </div>
            ))}
            {places.length === 0 && selectedCity && <p className="text-sm text-ink-soft">Aucun établissement dans cette ville pour l&apos;instant.</p>}
          </div>
        </section>
      </div>

      {cityPicking && (
        <MapPickerOverlay
          title="Où se trouve la ville ?"
          center={WORLD_CENTER}
          zoom={3}
          onConfirm={(lat, lng) => {
            setCityFormPin([lat, lng]);
            setCityPicking(false);
            setCityFormOpen(true);
          }}
          onCancel={() => setCityPicking(false)}
        />
      )}
      {cityFormOpen && (
        <CityFormSheet
          pin={cityFormPin}
          onCancel={() => setCityFormOpen(false)}
          onSaved={() => {
            setCityFormOpen(false);
            loadCities();
          }}
        />
      )}
      {editingCity && (
        <CityFormSheet
          city={editingCity}
          onCancel={() => setEditingCity(null)}
          onSaved={() => {
            setEditingCity(null);
            loadCities();
          }}
        />
      )}

      {placePicking && selectedCity && (
        <MapPickerOverlay
          title={`Établissement à : ${selectedCity.name}`}
          center={[Number(selectedCity.latitude), Number(selectedCity.longitude)]}
          zoom={13}
          contextPlaces={places}
          onConfirm={(lat, lng) => {
            setPlaceFormPin([lat, lng]);
            setPlacePicking(false);
            setPlaceFormOpen(true);
          }}
          onCancel={() => setPlacePicking(false)}
        />
      )}
      {placeFormOpen && selectedCityId != null && (
        <PlaceFormSheet
          cityId={selectedCityId}
          pin={placeFormPin}
          onCancel={() => setPlaceFormOpen(false)}
          onSaved={async () => {
            setPlaceFormOpen(false);
            const fresh = await api.get<Place[]>(`/cities/${selectedCityId}/places/`);
            setPlaces(fresh);
          }}
        />
      )}
      {editingPlace && selectedCityId != null && (
        <PlaceFormSheet
          cityId={selectedCityId}
          place={editingPlace}
          onCancel={() => setEditingPlace(null)}
          onSaved={async () => {
            setEditingPlace(null);
            const fresh = await api.get<Place[]>(`/cities/${selectedCityId}/places/`);
            setPlaces(fresh);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deletingCity}
        title={`Supprimer la ville « ${deletingCity?.name} » ?`}
        description="Tous les établissements, avis et photos de cette ville seront supprimés définitivement."
        confirmLabel="Supprimer la ville"
        busy={deletingCityBusy}
        onConfirm={deleteCity}
        onCancel={() => setDeletingCity(null)}
      />
      <ConfirmDialog
        open={!!deletingPlace}
        title={`Supprimer « ${deletingPlace?.name} » ?`}
        description="Tous les avis et photos de cet établissement seront supprimés définitivement."
        confirmLabel="Supprimer l'établissement"
        busy={deletingPlaceBusy}
        onConfirm={deletePlace}
        onCancel={() => setDeletingPlace(null)}
      />
    </main>
  );
}
