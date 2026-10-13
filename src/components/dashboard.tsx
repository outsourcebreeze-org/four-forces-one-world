"use client";

import { Droplets, Flame, Mountain, RefreshCw, Wind } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlobeView } from "@/components/globe-view";
import { FORCE_META, OPEN_METEO_NOTICE, WATCH_AREAS } from "@/lib/constants";
import { haversineKm } from "@/lib/geo";
import { SEVERITY_LABEL } from "@/lib/severity";
import { FORCES, type BriefResponse, type Force, type Situation, type WorldState } from "@/lib/types";

const ICONS = { water: Droplets, air: Wind, land: Mountain, fire: Flame };

const WINDOWS = [
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "14d", hours: 24 * 14 },
  { label: "All", hours: 0 },
];

export function Dashboard() {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forces, setForces] = useState<Force[]>([...FORCES]);
  const [minSeverity, setMinSeverity] = useState(1);
  const [hours, setHours] = useState(24 * 14);
  const [query, setQuery] = useState("");
  const [watch, setWatch] = useState("Any region");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const briefRequest = useRef(0);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(refresh ? "/api/events?refresh=1" : "/api/events");
      if (!response.ok) throw new Error(`Events request failed (${response.status})`);
      const payload = (await response.json()) as WorldState;
      setWorld(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visible = useMemo(() => {
    if (!world) return [];
    const area = WATCH_AREAS.find((item) => item.name === watch) ?? WATCH_AREAS[0];
    const needle = query.trim().toLowerCase();
    const generatedAt = new Date(world.generatedAt).getTime();
    const cutoff = hours === 0 ? null : generatedAt - hours * 36e5;
    return world.situations.filter((situation) => {
      if (!forces.includes(situation.force)) return false;
      if (situation.severity < minSeverity) return false;
      if (cutoff && new Date(situation.time).getTime() < cutoff) return false;
      if (needle && !`${situation.title} ${situation.place ?? ""}`.toLowerCase().includes(needle)) {
        return false;
      }
      if (area.name !== "Any region" && haversineKm(situation, area) > area.radiusKm) return false;
      return true;
    });
  }, [world, forces, minSeverity, hours, query, watch]);

  const selected = world?.situations.find((item) => item.id === selectedId) ?? null;
  const selectedEvents =
    world && selected ? world.events.filter((event) => selected.eventIds.includes(event.id)) : [];

  async function requestBrief(situation: Situation, kind: "situation" | "regional") {
    const requestId = briefRequest.current + 1;
    briefRequest.current = requestId;
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    try {
      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situationId: situation.id, kind }),
      });
      const payload = (await response.json()) as BriefResponse & { error?: string };
      if (requestId !== briefRequest.current) return;
      if (!response.ok) throw new Error(payload.error || "Brief failed");
      setBrief(payload);
    } catch (cause) {
      if (requestId !== briefRequest.current) return;
      setBriefError(cause instanceof Error ? cause.message : "Brief failed");
    } finally {
      if (requestId === briefRequest.current) setBriefLoading(false);
    }
  }

  useEffect(() => {
    if (!selected || !world) return;
    if (world.keys.nebius) return;
    const timer = window.setTimeout(() => {
      void requestBrief(selected, "situation");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selected, world]);

  function choose(id: string) {
    setSelectedId(id);
    setBrief(null);
    setBriefError(null);
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-4 py-3 lg:px-6">
        <div>
          <p className="font-serif text-2xl leading-none text-[#f6f1e6]">Four Forces, One World</p>
          <p className="mt-1 max-w-xl text-sm text-[#f6f1e6]/70">
            A civil public-safety picture of water, air, land, and fire. Each situation can be read as a short brief with a confidence score and the sources behind it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={world?.dataMode === "live" ? "outline" : "demo"} className="border-white/20 text-[#f6f1e6]">
            {world?.dataMode === "live" ? "Live public feeds" : loading ? "Loading feeds" : "Demo snapshot"}
          </Badge>
          <Badge variant="demo">
            {world?.keys.nebius ? "Nemotron briefs" : "Demo briefs"}
          </Badge>
          <Button variant="outline" size="sm" className="border-white/20 text-[#f6f1e6] hover:bg-white/10" onClick={() => void load(true)}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)_390px]">
        <aside className="order-2 border-white/10 bg-[#171411] p-4 lg:order-1 lg:overflow-y-auto lg:border-r">
          <p className="text-xs uppercase tracking-[0.16em] text-[#f6f1e6]/50">Filters</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {FORCES.map((force) => {
              const Icon = ICONS[force];
              const on = forces.includes(force);
              return (
                <button
                  key={force}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setForces((current) =>
                      current.includes(force) ? current.filter((item) => item !== force) : [...current, force],
                    )
                  }
                  className="flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left text-sm"
                  style={{
                    borderColor: on ? FORCE_META[force].color : "rgba(246,241,230,0.12)",
                    background: on ? "rgba(246,241,230,0.06)" : "transparent",
                    color: FORCE_META[force].color,
                  }}
                >
                  <Icon className="size-4" />
                  {FORCE_META[force].label}
                </button>
              );
            })}
          </div>
          <label className="mt-4 block text-xs uppercase tracking-[0.16em] text-[#f6f1e6]/50">
            Minimum severity {minSeverity}
            <input
              className="mt-2 w-full accent-[#f0b45a]"
              type="range"
              min={1}
              max={4}
              value={minSeverity}
              onChange={(event) => setMinSeverity(Number(event.target.value))}
            />
          </label>
          <div className="mt-3 flex gap-1">
            {WINDOWS.map((window) => (
              <button
                key={window.label}
                type="button"
                onClick={() => setHours(window.hours)}
                className={`rounded-full px-2.5 py-1 text-xs ${hours === window.hours ? "bg-[#f6f1e6] text-[#1a1714]" : "text-[#f6f1e6]/70"}`}
              >
                {window.label}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs uppercase tracking-[0.16em] text-[#f6f1e6]/50">
            Watch area
            <select
              className="mt-2 h-9 w-full rounded-full border border-white/15 bg-[#100e0c] px-3 text-sm text-[#f6f1e6]"
              value={watch}
              onChange={(event) => setWatch(event.target.value)}
            >
              {WATCH_AREAS.map((area) => (
                <option key={area.name}>{area.name}</option>
              ))}
            </select>
          </label>
          <div className="mt-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles"
              aria-label="Search situations"
            />
          </div>
          <ul className="mt-5 space-y-1.5 text-xs text-[#f6f1e6]/70">
            {(world?.health ?? []).map((row) => (
              <li key={row.source} className="flex items-center justify-between gap-2">
                <span>{row.source}</span>
                <span>
                  {row.skipped ? "no key" : row.ok ? `${row.count}` : "down"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-[#f6f1e6]/45">{OPEN_METEO_NOTICE}</p>
        </aside>

        <main className="relative order-1 h-[52vh] min-h-[320px] lg:order-2 lg:h-auto">
          {loading && !world ? (
            <div className="flex h-full items-center justify-center text-sm text-[#f6f1e6]/70">
              Gathering public hazard feeds…
            </div>
          ) : (
            <GlobeView situations={visible} selectedId={selected?.id ?? null} onSelect={choose} />
          )}
          {error ? (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-[#f6f1e6] p-3 text-sm text-[#1a1714]">
              {error}
              <Button className="ml-3" size="sm" onClick={() => void load(true)}>
                Try again
              </Button>
            </div>
          ) : null}
          {world?.notice ? (
            <p className="absolute left-4 right-4 top-3 rounded-2xl bg-[#f3d27a] px-3 py-2 text-xs text-[#1a1714]">
              {world.notice}
            </p>
          ) : null}
          {!loading && visible.length === 0 ? (
            <p className="pointer-events-none absolute bottom-4 left-4 right-4 text-center text-sm text-[#f6f1e6]/80">
              No situations match these filters. Lower the severity floor or widen the time window.
            </p>
          ) : null}
        </main>

        <section className="panel-scroll order-3 bg-[#f6f1e6] text-[#1a1714] lg:overflow-y-auto">
          <div className="border-b border-[#e4d8c4] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[#1a1714]/50">
              {visible.length} situations
            </p>
          </div>
          <ul className="max-h-64 divide-y divide-[#e4d8c4] overflow-y-auto lg:max-h-none">
            {visible.slice(0, 40).map((situation) => (
              <li key={situation.id}>
                <button
                  type="button"
                  onClick={() => choose(situation.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-white/50 ${selected?.id === situation.id ? "bg-white" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <Badge variant={situation.force}>{FORCE_META[situation.force].label}</Badge>
                    <span className="text-[11px] uppercase tracking-wide text-[#1a1714]/50">
                      {SEVERITY_LABEL[situation.severity]}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-snug">{situation.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-[#e4d8c4] px-4 py-4">
            {!selected ? (
              <p className="text-sm text-[#1a1714]/70">
                Choose a point on the globe, or a row above. The list is the keyboard path; the globe is the map.
              </p>
            ) : (
              <>
                <h2 className="font-serif text-2xl leading-tight">{selected.title}</h2>
                <p className="mt-2 text-sm text-[#1a1714]/70">
                  {selected.place ? `${selected.place}. ` : ""}
                  {selected.sources.join(", ")}. Updated {selected.time.replace("T", " ").slice(0, 16)} UTC.
                  {selected.nearby.length
                    ? ` ${selected.nearby.length} other force${selected.nearby.length === 1 ? "" : "s"} within 500 km.`
                    : ""}
                </p>
                <ul className="mt-3 space-y-2">
                  {selectedEvents.map((event) => (
                    <li key={event.id} className="text-sm">
                      <a className="underline decoration-[#e4d8c4] underline-offset-2" href={event.url} target="_blank" rel="noreferrer">
                        {event.source}: {event.type}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  {world?.keys.nebius ? (
                    <Button size="sm" onClick={() => void requestBrief(selected, "situation")}>
                      Ask Nemotron for a brief
                    </Button>
                  ) : null}
                  {selected.nearby.length > 0 ? (
                    <Button size="sm" variant="outline" onClick={() => void requestBrief(selected, "regional")}>
                      {world?.keys.nebius ? "Regional note (Ultra)" : "Regional note"}
                    </Button>
                  ) : null}
                </div>
                {briefLoading ? <p className="mt-4 text-sm">Writing the brief…</p> : null}
                {briefError ? <p className="mt-4 text-sm text-[#b33b28]">{briefError}</p> : null}
                {brief ? <BriefView brief={brief} /> : null}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function BriefView({ brief }: { brief: BriefResponse }) {
  const { brief: note, pipeline } = brief;
  return (
    <article className="mt-4 rounded-3xl bg-white p-4">
      {note.demo ? <Badge variant="demo">Demo</Badge> : <Badge>Live brief</Badge>}
      <h3 className="mt-2 font-serif text-xl leading-tight">{note.headline}</h3>
      {note.demoLabel ? <p className="mt-2 text-xs text-[#1a1714]/60">{note.demoLabel}</p> : null}
      <p className="mt-3 text-sm leading-relaxed">{note.summary}</p>
      <p className="mt-3 text-sm">
        Confidence {note.confidence.level} · {note.confidence.score}
        {note.affectedArea ? ` · ${note.affectedArea}` : ""}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4d8c4]">
        <div className="h-full bg-[#8d5c14]" style={{ width: `${note.confidence.score}%` }} />
      </div>
      <p className="mt-3 text-sm text-[#1a1714]/75">{note.whatChanged}</p>
      {note.contradictions.length ? (
        <ul className="mt-2 list-disc pl-4 text-sm text-[#b33b28]">
          {note.contradictions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2">
        {note.evidence.map((item) => (
          <li key={item.url}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#e4d8c4] px-2.5 py-1 text-xs"
            >
              <span className="uppercase tracking-wide text-[#1a1714]/50">{item.stance}</span>
              {item.source}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[#1a1714]/45">
        {pipeline.mode}
        {pipeline.models.length ? ` · ${pipeline.models.join(" → ")}` : ""}
        {pipeline.emptyContentFallback ? " · empty Super reply, used Nano" : ""}
        {pipeline.verifiedWithTavily ? " · Tavily" : ""}
        {pipeline.cached ? " · cached" : ""}
      </p>
    </article>
  );
}
