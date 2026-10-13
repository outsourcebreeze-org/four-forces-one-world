"use client";

import { useEffect, useState } from "react";
import type { PublicCamera } from "@/lib/cameras";

type CameraPayload = {
  radiusKm: number;
  cameras: PublicCamera[];
  notices: string[];
  error?: string;
};

export function LiveCameras({ lat, lon }: { lat: number; lon: number }) {
  const [payload, setPayload] = useState<CameraPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      setFailedImages({});
      void fetch(`/api/cameras?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as CameraPayload;
          if (!response.ok) throw new Error(body.error || "Cameras failed");
          setPayload(body);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setPayload(null);
          setError(cause instanceof Error ? cause.message : "Cameras failed");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lat, lon]);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [lat, lon]);

  const radius = payload?.radiusKm ?? 50;

  return (
    <section className="mt-4" aria-label="Live cameras">
      <h3 className="text-xs uppercase tracking-[0.16em] text-[#1a1714]/50">Live cameras</h3>
      {loading ? <p className="mt-2 text-sm text-[#1a1714]/70">Looking for public cameras within {radius} km…</p> : null}
      {error ? <p className="mt-2 text-sm text-[#b33b28]">{error}</p> : null}
      {!loading && !error && payload && payload.cameras.length === 0 ? (
        <p className="mt-2 text-sm text-[#1a1714]/70">
          No USGS river camera or Québec 511 camera within {radius} km.
          {payload.notices.length ? ` ${payload.notices.join(" ")}` : ""}
        </p>
      ) : null}
      {payload && payload.cameras.length > 0 ? (
        <ul className="mt-2 space-y-3">
          {payload.cameras.map((camera) => {
            const showImage = Boolean(camera.imageUrl) && !failedImages[camera.id];
            return (
              <li key={camera.id} className="overflow-hidden rounded-2xl border border-[#e4d8c4] bg-white">
                {showImage && camera.imageUrl ? (
                  // The still is the source's own newest frame. object-contain keeps the full frame, including any caption bar.
                  <img
                    src={`${camera.imageUrl}${camera.imageUrl.includes("?") ? "&" : "?"}v=${refreshKey}`}
                    alt={`Latest still from ${camera.name}`}
                    className="max-h-44 w-full bg-[#1a1714] object-contain"
                    onError={() => setFailedImages((current) => ({ ...current, [camera.id]: true }))}
                  />
                ) : null}
                <div className="px-3 py-2">
                  <p className="text-sm leading-snug">{camera.name}</p>
                  <p className="mt-1 text-xs text-[#1a1714]/60">
                    {camera.km} km away
                    {camera.observedAt ? ` · still ${camera.observedAt.replace("T", " ").slice(0, 16)} UTC` : ""}
                  </p>
                  {!camera.imageUrl ? (
                    <p className="mt-1 text-xs text-[#1a1714]/60">
                      Opens the official viewer. This panel does not embed that video.
                    </p>
                  ) : null}
                  {failedImages[camera.id] ? (
                    <p className="mt-1 text-xs text-[#b33b28]">The still did not load. The source page is still linked.</p>
                  ) : null}
                  <a
                    className="mt-1 inline-block text-sm underline decoration-[#e4d8c4] underline-offset-2"
                    href={camera.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {camera.source === "usgs-hivis" ? "Open on USGS HIVIS" : "Open on Québec 511"}
                  </a>
                  <p className="mt-1 text-[11px] leading-snug text-[#1a1714]/50">{camera.attribution}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {payload && payload.cameras.length > 0 && payload.notices.length ? (
        <p className="mt-2 text-xs text-[#1a1714]/60">{payload.notices.join(" ")}</p>
      ) : null}
    </section>
  );
}
