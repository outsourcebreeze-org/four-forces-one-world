"use client";

import { useEffect, useRef, useState } from "react";
import { FORCE_META } from "@/lib/constants";
import { escapeHtml } from "@/lib/agent/text";
import type { Situation } from "@/lib/types";

type GlobePoint = Situation & { color: string; radius: number };

type GlobeApi = {
  width: (value: number) => GlobeApi;
  height: (value: number) => GlobeApi;
  backgroundColor: (value: string) => GlobeApi;
  globeImageUrl: (value: string) => GlobeApi;
  bumpImageUrl: (value: string) => GlobeApi;
  showAtmosphere: (value: boolean) => GlobeApi;
  atmosphereColor: (value: string) => GlobeApi;
  atmosphereAltitude: (value: number) => GlobeApi;
  pointsData: (value: GlobePoint[]) => GlobeApi;
  pointLat: (value: string) => GlobeApi;
  pointLng: (value: string) => GlobeApi;
  pointColor: (value: string) => GlobeApi;
  pointAltitude: (value: number) => GlobeApi;
  pointRadius: (value: string) => GlobeApi;
  pointLabel: (value: (point: GlobePoint) => string) => GlobeApi;
  onPointClick: (value: (point: GlobePoint) => void) => GlobeApi;
  ringsData: (value: GlobePoint[]) => GlobeApi;
  ringLat: (value: string) => GlobeApi;
  ringLng: (value: string) => GlobeApi;
  ringColor: (value: () => string) => GlobeApi;
  ringMaxRadius: (value: number) => GlobeApi;
  ringPropagationSpeed: (value: number) => GlobeApi;
  ringRepeatPeriod: (value: number) => GlobeApi;
  pointOfView: (value: { lat: number; lng: number; altitude: number }, ms?: number) => GlobeApi;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
  _destructor: () => void;
};

export function GlobeView({
  situations,
  selectedId,
  onSelect,
}: {
  situations: Situation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeApi | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      const { default: Globe } = await import("globe.gl");
      if (disposed || !host.current) return;
      const instance = new Globe(host.current) as unknown as GlobeApi;
      instance
        .backgroundColor("#100e0c")
        .globeImageUrl("/textures/earth-blue-marble.jpg")
        .bumpImageUrl("/textures/earth-topology.png")
        .showAtmosphere(true)
        .atmosphereColor("#c4b49a")
        .atmosphereAltitude(0.16)
        .pointLat("lat")
        .pointLng("lon")
        .pointColor("color")
        .pointAltitude(0.012)
        .pointRadius("radius")
        .pointLabel((point) => {
          return `<div style="font:13px/1.35 Outfit,sans-serif;background:#f6f1e6;color:#1a1714;padding:8px 10px;border-radius:10px;max-width:240px"><strong>${escapeHtml(point.title)}</strong><div style="margin-top:4px;opacity:.75">${escapeHtml(point.force)} · severity ${point.severity}</div></div>`;
        })
        .onPointClick((point) => onSelectRef.current(point.id))
        .ringLat("lat")
        .ringLng("lon")
        .ringColor(() => "rgba(240,180,90,0.55)")
        .ringMaxRadius(4)
        .ringPropagationSpeed(1.4)
        .ringRepeatPeriod(900)
        .pointOfView({ lat: 18, lng: 12, altitude: 2.35 });
      const controls = instance.controls();
      controls.autoRotate = !reduced;
      controls.autoRotateSpeed = 0.28;
      globe.current = instance;
      const resize = () => {
        if (!host.current || !globe.current) return;
        globe.current.width(host.current.clientWidth).height(host.current.clientHeight);
      };
      resize();
      observer.current = new ResizeObserver(resize);
      observer.current.observe(host.current);
      if (!disposed) setReady(true);
    })();

    return () => {
      disposed = true;
      observer.current?.disconnect();
      globe.current?._destructor();
      globe.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = globe.current;
    if (!instance || !ready) return;
    const points: GlobePoint[] = situations.map((situation) => ({
      ...situation,
      color: FORCE_META[situation.force].color,
      radius: (situation.id === selectedId ? 0.62 : 0.34) + situation.severity * 0.08,
    }));
    instance.pointsData(points);
    instance.ringsData(points.filter((point) => point.severity >= 3));
    const selected = points.find((point) => point.id === selectedId);
    if (selected) {
      instance.controls().autoRotate = false;
      instance.pointOfView({ lat: selected.lat, lng: selected.lon, altitude: 1.7 }, 700);
    }
  }, [situations, selectedId, ready]);

  return <div ref={host} className="h-full w-full" />;
}
