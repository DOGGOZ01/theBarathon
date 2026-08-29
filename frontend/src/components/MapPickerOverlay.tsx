"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useHideBottomNav } from "@/lib/chrome-context";
import type { Place } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-ink-soft">Chargement de la carte…</div>,
});

interface MapPickerOverlayProps {
  title: string;
  center: [number, number];
  zoom?: number;
  contextPlaces?: Place[];
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

export function MapPickerOverlay({ title, center, zoom = 13, contextPlaces = [], onConfirm, onCancel }: MapPickerOverlayProps) {
  const [liveCenter, setLiveCenter] = useState<[number, number]>(center);
  useHideBottomNav();

  return (
    <div className="anim-fade-in fixed inset-0 z-[900] bg-paper">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-center justify-between p-3">
        <span className="pointer-events-auto rounded-pill border-2 border-ink bg-paper-raised px-3 py-2 text-sm font-medium shadow-hard-sm">
          {title}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-ink bg-paper-raised shadow-hard-sm"
        >
          ✕
        </button>
      </div>

      <div className="h-full w-full">
        <MapView center={center} zoom={zoom} places={contextPlaces} onCenterChange={(lat, lng) => setLiveCenter([lat, lng])} />
      </div>

      {/* Fixed pin: stays centered on screen while the map pans underneath it — the pin's tip marks the exact point that will be dropped. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-full">
        <svg width="40" height="40" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M17 2c-7 0-12 5.2-12 11.6C5 21.8 17 32 17 32s12-10.2 12-18.4C29 7.2 24 2 17 2z"
            fill="#faf7ef"
            stroke="#16140f"
            strokeWidth="2"
          />
          <circle cx="17" cy="13" r="4.2" fill="#16140f" />
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-4">
        <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-card border-2 border-ink bg-paper-raised p-3 shadow-hard">
          <p className="text-sm text-ink-soft">
            {liveCenter[0].toFixed(5)}, {liveCenter[1].toFixed(5)}
          </p>
          <button
            type="button"
            onClick={() => onConfirm(liveCenter[0], liveCenter[1])}
            className="min-h-[44px] shrink-0 rounded-block border-2 border-ink bg-yellow px-4 font-semibold shadow-hard-sm"
          >
            Poser le repère ici
          </button>
        </div>
      </div>
    </div>
  );
}
