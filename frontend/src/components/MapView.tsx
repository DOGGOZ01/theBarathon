"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, GeolocateControl, addProtocol, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";
import type { Place } from "@/lib/types";

const CLUSTER_PIXEL_RADIUS = 50;
const LABEL_MIN_ZOOM = 15;

let protocolRegistered = false;
function ensurePmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile);
  // Turbopack doesn't emit maplibre-gl's worker chunk (and its sibling
  // maplibre-gl-shared.mjs) correctly, so the library falls back to a
  // broken worker URL and tiles never load. Both files are copied into
  // public/ verbatim from node_modules/maplibre-gl/dist — re-copy them if
  // maplibre-gl is ever upgraded (see frontend/README.md).
  setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`);
  protocolRegistered = true;
}

function buildStyle(): StyleSpecification {
  // Tile fetches happen inside a worker, where a root-relative URL doesn't
  // reliably resolve against the page's origin — pmtiles always wants an
  // absolute URL here.
  const tilesUrl = `${window.location.origin}/tiles/france.pmtiles`;
  return {
    version: 8,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${tilesUrl}`,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: layers("protomaps", namedFlavor("light"), { lang: "fr" }),
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
  };
}

const PIN_SVG = (color: string, size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 2c-7 0-12 5.2-12 11.6C5 21.8 17 32 17 32s12-10.2 12-18.4C29 7.2 24 2 17 2z"
      fill="${color}" stroke="#16140f" stroke-width="2"/>
    <circle cx="17" cy="13" r="4.2" fill="#16140f"/>
  </svg>`;

function pinElement(label: string | null) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
  if (label) {
    const tag = document.createElement("span");
    tag.textContent = label;
    tag.style.cssText =
      "margin-bottom:4px;padding:2px 8px;border-radius:6px;border:2px solid #16140f;background:#faf7ef;" +
      "font-family:inherit;font-size:12px;font-weight:600;color:#16140f;white-space:nowrap;box-shadow:2px 2px 0 0 #16140f;";
    wrap.appendChild(tag);
  }
  const pin = document.createElement("div");
  pin.innerHTML = PIN_SVG("#ffc629", 34);
  wrap.appendChild(pin);
  return wrap;
}

function clusterElement(count: number) {
  const size = count < 10 ? 38 : count < 50 ? 46 : 54;
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:999px;background:#ffc629;border:3px solid #16140f;
    display:flex;align-items:center;justify-content:center;font-weight:700;font-family:inherit;color:#16140f;cursor:pointer;`;
  el.textContent = String(count);
  return el;
}

interface MapViewProps {
  center: [number, number];
  zoom?: number;
  places: Place[];
  onPlaceClick?: (place: Place) => void;
  onCenterChange?: (lat: number, lng: number) => void;
  geolocate?: boolean;
  focusPlaceId?: number | null;
}

export function MapView({
  center,
  zoom = 14,
  places,
  onPlaceClick,
  onCenterChange,
  geolocate,
  focusPlaceId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const placesRef = useRef(places);
  const onPlaceClickRef = useRef(onPlaceClick);
  const renderRef = useRef<() => void>(() => {});
  const lastFocusedRef = useRef<number | null>(null);

  useEffect(() => {
    placesRef.current = places;
    onPlaceClickRef.current = onPlaceClick;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensurePmtilesProtocol();

    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildStyle(),
      center: [center[1], center[0]],
      zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    if (geolocate) {
      map.addControl(
        new GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
        "bottom-left"
      );
    }

    function renderMarkers() {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const showLabels = map.getZoom() >= LABEL_MIN_ZOOM;
      const points = placesRef.current
        .filter((p) => p.latitude && p.longitude)
        .map((p) => {
          const lng = Number(p.longitude);
          const lat = Number(p.latitude);
          return { place: p, lng, lat, screen: map.project([lng, lat]) };
        });

      const used = new Array(points.length).fill(false);
      const groups: (typeof points)[] = [];
      for (let i = 0; i < points.length; i++) {
        if (used[i]) continue;
        const group = [points[i]];
        used[i] = true;
        for (let j = i + 1; j < points.length; j++) {
          if (used[j]) continue;
          const dx = points[i].screen.x - points[j].screen.x;
          const dy = points[i].screen.y - points[j].screen.y;
          if (Math.hypot(dx, dy) < CLUSTER_PIXEL_RADIUS) {
            group.push(points[j]);
            used[j] = true;
          }
        }
        groups.push(group);
      }

      for (const group of groups) {
        const lng = group.reduce((s, g) => s + g.lng, 0) / group.length;
        const lat = group.reduce((s, g) => s + g.lat, 0) / group.length;

        if (group.length > 1) {
          const el = clusterElement(group.length);
          el.addEventListener("click", () => {
            map.easeTo({ center: [lng, lat], zoom: Math.min(map.getZoom() + 2, 18) });
          });
          markersRef.current.push(new Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map));
        } else {
          const place = group[0].place;
          const el = pinElement(showLabels ? place.name : null);
          el.addEventListener("click", () => onPlaceClickRef.current?.(place));
          markersRef.current.push(new Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map));
        }
      }
    }
    renderRef.current = renderMarkers;

    map.on("load", renderMarkers);
    // "move" fires continuously during flyTo/easeTo zoom animations, not just
    // once at the end — needed so clusters split apart live as the pins grow
    // far enough apart, instead of staying frozen as one cluster marker
    // until the animation finishes and only "moveend" fires.
    map.on("move", renderMarkers);
    map.on("moveend", renderMarkers);

    if (onCenterChange) {
      const c = map.getCenter();
      onCenterChange(c.lat, c.lng);
      map.on("move", () => {
        const center = map.getCenter();
        onCenterChange(center.lat, center.lng);
      });
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; props are read via refs
  }, []);

  useEffect(() => {
    if (mapRef.current?.loaded()) {
      renderRef.current();
    }
  }, [places]);

  useEffect(() => {
    // Only fly once per distinct focusPlaceId — without this guard, any
    // unrelated refetch of `places` (e.g. after adding/editing a place
    // elsewhere on the map) re-runs this effect and yanks the map back to
    // the focused pin, undoing whatever the user has panned/zoomed to since.
    if (!focusPlaceId || lastFocusedRef.current === focusPlaceId) return;
    const target = places.find((p) => p.id === focusPlaceId);
    if (!target || !target.latitude || !target.longitude) return;

    const flyToTarget = () => {
      mapRef.current?.flyTo({ center: [Number(target.longitude), Number(target.latitude)], zoom: 20.5 });
      lastFocusedRef.current = focusPlaceId;
    };

    const map = mapRef.current;
    if (map?.loaded()) flyToTarget();
    else map?.once("load", flyToTarget);
  }, [focusPlaceId, places]);

  return <div ref={containerRef} className="h-full w-full" />;
}
