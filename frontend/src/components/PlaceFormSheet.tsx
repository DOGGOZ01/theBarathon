"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useHideBottomNav } from "@/lib/chrome-context";
import { PLACE_TYPE_LABELS, type Place, type PlaceType } from "@/lib/types";

const PLACE_TYPE_OPTIONS: PlaceType[] = ["bar", "restaurant", "endroit"];

interface PlaceFormSheetProps {
  cityId: number;
  place?: Place | null;
  pin?: [number, number] | null;
  onSaved: (place: Place) => void;
  onCancel: () => void;
}

export function PlaceFormSheet({ cityId, place, pin, onSaved, onCancel }: PlaceFormSheetProps) {
  const [name, setName] = useState(place?.name ?? "");
  const [placeType, setPlaceType] = useState<PlaceType>(place?.place_type ?? "bar");
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
      if (!place) {
        // Editing only ever touches name/photo — city, position and type
        // are set once at creation and aren't part of this form afterwards.
        fd.append("city", String(cityId));
        fd.append("place_type", placeType);
        if (pin) {
          // Backend DecimalField allows at most 6 decimal places; raw
          // Leaflet click coordinates have far more (float precision) and
          // would otherwise fail serializer validation on every save.
          fd.append("latitude", pin[0].toFixed(6));
          fd.append("longitude", pin[1].toFixed(6));
        }
      }
      if (photoFile) fd.append("photo", photoFile);

      const saved = place
        ? await api.patch<Place>(`/places/${place.id}/`, fd)
        : await api.post<Place>("/places/", fd);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer l'établissement");
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
        <h2 className="mb-4 font-display text-lg">{place ? "Modifier l'établissement" : "Nouvel établissement"}</h2>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Nom</span>
              <span className="text-xs text-ink-soft">{name.length}/50</span>
            </div>
            <input
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] rounded-block border-2 border-ink bg-paper px-3 py-2"
            />
          </label>
          {!place && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Type</span>
              <div className="flex gap-2">
                {PLACE_TYPE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPlaceType(t)}
                    className={`min-h-[40px] flex-1 rounded-block border-2 border-ink px-2 text-sm font-medium ${
                      placeType === t ? "bg-yellow" : "bg-paper"
                    }`}
                  >
                    {PLACE_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Photo {place && "(facultatif — laissez vide pour ne pas la changer)"}</span>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
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
