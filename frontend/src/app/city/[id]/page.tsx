"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PlaceFormSheet } from "@/components/PlaceFormSheet";
import type { City, Place } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-ink-soft">Chargement de la carte…</div>,
});

const MapPickerOverlay = dynamic(() => import("@/components/MapPickerOverlay").then((m) => m.MapPickerOverlay), {
  ssr: false,
});

export default function CityMapPage() {
  return (
    <Suspense fallback={<main className="flex h-dvh items-center justify-center text-ink-soft">Chargement…</main>}>
      <CityMapPageInner />
    </Suspense>
  );
}

function CityMapPageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusPlaceId = searchParams.get("place") ? Number(searchParams.get("place")) : null;
  const [city, setCity] = useState<City | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [picking, setPicking] = useState(false);
  const [formPin, setFormPin] = useState<[number, number] | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function load() {
    return Promise.all([api.get<City>(`/cities/${id}/`), api.get<Place[]>(`/cities/${id}/places/`)])
      .then(([c, p]) => {
        setCity(c);
        setPlaces(p);
      })
      .catch(() => setError("Impossible de charger la ville"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <main className="p-6">
        <p className="rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>
        <Link href="/" className="mt-4 inline-block underline">
          Retour aux villes
        </Link>
      </main>
    );
  }

  if (!city) {
    return <main className="flex h-dvh items-center justify-center text-ink-soft">Chargement…</main>;
  }

  return (
    <div className="relative h-[calc(100dvh-76px)] w-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex justify-between p-3">
        <Link
          href="/"
          className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-ink bg-paper-raised px-3 shadow-hard-sm"
        >
          ←
        </Link>
        <span className="pointer-events-auto rounded-pill border-2 border-ink bg-paper-raised px-3 py-2 text-sm font-medium shadow-hard-sm">
          {city.name} · {places.length} établissement{places.length > 1 ? "s" : ""}
        </span>
      </div>
      <MapView
        center={[Number(city.latitude), Number(city.longitude)]}
        places={places}
        onPlaceClick={(place) => router.push(`/place/${place.id}`)}
        geolocate
        focusPlaceId={focusPlaceId}
      />

      <button
        type="button"
        onClick={() => setPicking(true)}
        className="absolute bottom-5 right-4 z-[500] flex min-h-[52px] min-w-[52px] items-center justify-center rounded-pill border-2 border-ink bg-yellow text-2xl font-bold leading-none shadow-hard"
        aria-label="Ajouter un établissement"
      >
        +
      </button>

      {picking && (
        <MapPickerOverlay
          title="Où se trouve l'établissement ?"
          center={[Number(city.latitude), Number(city.longitude)]}
          zoom={15}
          contextPlaces={places}
          onConfirm={(lat, lng) => {
            setFormPin([lat, lng]);
            setPicking(false);
            setFormOpen(true);
          }}
          onCancel={() => setPicking(false)}
        />
      )}
      {formOpen && (
        <PlaceFormSheet
          cityId={city.id}
          pin={formPin}
          onCancel={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
