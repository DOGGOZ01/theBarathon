"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useHideBottomNav } from "@/lib/chrome-context";
import type { City } from "@/lib/types";

interface CityFormSheetProps {
  city?: City | null;
  pin?: [number, number] | null;
  onSaved: (city: City) => void;
  onCancel: () => void;
}

export function CityFormSheet({ city, pin, onSaved, onCancel }: CityFormSheetProps) {
  const [name, setName] = useState(city?.name ?? "");
  const [country, setCountry] = useState(city?.country ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useHideBottomNav();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("country", country);
      if (pin) {
        // Backend DecimalField allows at most 6 decimal places; raw
        // Leaflet click coordinates have far more (float precision) and
        // would otherwise fail serializer validation on every save.
        fd.append("latitude", pin[0].toFixed(6));
        fd.append("longitude", pin[1].toFixed(6));
      }
      if (photoFile) fd.append("photo", photoFile);

      const saved = city
        ? await api.patch<City>(`/cities/${city.id}/`, fd)
        : await api.post<City>("/cities/", fd);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la ville");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="anim-fade-in fixed inset-0 z-[950] flex items-end justify-center bg-ink/40 p-0" role="dialog" aria-modal="true">
      <form
        onSubmit={onSubmit}
        className="anim-sheet-in w-full max-w-md rounded-t-[24px] border-2 border-b-0 border-ink bg-paper-raised p-5 pb-8"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-pill bg-line" />
        <h2 className="mb-4 font-display text-lg">{city ? "Modifier la ville" : "Nouvelle ville"}</h2>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Nom</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] rounded-block border-2 border-ink bg-paper px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Pays</span>
            <input
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="min-h-[44px] rounded-block border-2 border-ink bg-paper px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Photo {city && "(facultatif — laissez vide pour ne pas la changer)"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error && <p className="mt-3 rounded-block border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} className="min-h-[44px] flex-1 rounded-block border-2 border-ink bg-paper font-medium">
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-block border-2 border-ink bg-yellow font-semibold shadow-hard-sm disabled:opacity-60"
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
