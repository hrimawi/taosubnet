"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { MAP_CENTER, MAP_DEFAULT_ZOOM } from "@/lib/config/cities";
import { SCORE_HEX, scoreBand } from "@/lib/format";
import type { MapPoint } from "@/lib/types";

/**
 * Clustered Google Map of every collected business, pin color = Lead Score
 * band (green ≥80 / yellow 60–79 / red <60 / gray unscored). Points stream in
 * paginated batches from /api/businesses/map; full records load on pin click.
 */

interface Props {
  points: MapPoint[];
  onSelect: (id: string) => void;
  loading?: boolean;
}

/** Night-mode map styling (Google's published dark style). */
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
];

type MapStatus = "loading" | "ready" | "missing-key" | "error";

export default function MapView({ points, onSelect, loading }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");

  // Keep the latest onSelect without rebuilding markers when it changes.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // One-time map init.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
    if (!key) {
      setStatus("missing-key");
      return;
    }
    let cancelled = false;
    const loader = new Loader({ apiKey: key, version: "weekly" });
    loader
      .load()
      .then((g) => {
        if (cancelled || !divRef.current) return;
        mapRef.current = new g.maps.Map(divRef.current, {
          center: MAP_CENTER,
          zoom: MAP_DEFAULT_ZOOM,
          styles: DARK_STYLE,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          backgroundColor: "#0f172a",
        });
        clustererRef.current = new MarkerClusterer({ map: mapRef.current });
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Google Maps failed to load:", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rebuild markers whenever the point set changes.
  useEffect(() => {
    if (status !== "ready" || !clustererRef.current) return;
    const clusterer = clustererRef.current;
    const markers = points.map((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        title: `${p.name} — Lead Score ${p.score ?? "n/a"}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: SCORE_HEX[scoreBand(p.score)],
          fillOpacity: 0.95,
          strokeColor: "#0f172a",
          strokeWeight: 1.5,
        },
      });
      marker.addListener("click", () => onSelectRef.current(p.id));
      return marker;
    });
    clusterer.clearMarkers();
    clusterer.addMarkers(markers);
    return () => {
      clusterer.clearMarkers();
    };
  }, [points, status]);

  if (status === "missing-key") {
    return (
      <Placeholder
        title="Google Maps key missing"
        body="Set NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY in .env.local (a browser key with the Maps JavaScript API enabled) and restart the dev server."
      />
    );
  }
  if (status === "error") {
    return (
      <Placeholder
        title="Map failed to load"
        body="Check the browser console — usually a key restriction (HTTP referrer) or the Maps JavaScript API not being enabled."
      />
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={divRef} className="h-full w-full" />
      {(status === "loading" || loading) && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300">
          {status === "loading" ? "Loading map…" : "Loading pins…"}
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-md bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-300">
        <LegendDot color={SCORE_HEX.green} label="80–100" />
        <LegendDot color={SCORE_HEX.yellow} label="60–79" />
        <LegendDot color={SCORE_HEX.red} label="0–59" />
        <LegendDot color={SCORE_HEX.none} label="unscored" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900 p-8 text-center">
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      <div className="max-w-md text-xs leading-relaxed text-slate-400">{body}</div>
    </div>
  );
}
