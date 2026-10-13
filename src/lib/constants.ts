import type { Force } from "./types";

export const APP_NAME = "Four Forces, One World";

export const USER_AGENT =
  "FourForcesOneWorld/0.1 (+https://github.com/four-forces-one-world; civil public-safety dashboard)";

export const NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";

/** Defaults verified against Token Factory on 13 Oct 2026. Override with env. */
export const DEFAULT_MODELS = {
  triage: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
  brief: "nvidia/nemotron-3-super-120b-a12b",
  analyst: "nvidia/Nemotron-3-Ultra-550b-a55b",
  lightning: "nvidia/Nemotron-3_5-Lightning",
} as const;

export const FORCE_META: Record<
  Force,
  { label: string; color: string; ink: string; blurb: string }
> = {
  water: {
    label: "Water",
    color: "#5eb0ff",
    ink: "#1d6fbf",
    blurb: "Floods, surge, drought, river discharge",
  },
  air: {
    label: "Air",
    color: "#c4b5fd",
    ink: "#5b4d96",
    blurb: "Storms, heat, wind, smoke, air quality",
  },
  land: {
    label: "Land",
    color: "#f0b45a",
    ink: "#8d5c14",
    blurb: "Earthquakes, volcanoes, landslides",
  },
  fire: {
    label: "Fire",
    color: "#ff6b4a",
    ink: "#b33b28",
    blurb: "Wildfires and active hotspots",
  },
};

/** GloFAS cells checked against Open-Meteo. Small side-channels were dropped. */
export const FLOOD_GAUGES = [
  { name: "Ganges near Patna", lat: 25.62, lon: 85.12 },
  { name: "Danube near Budapest", lat: 47.52, lon: 19.03 },
  { name: "Congo near Kinshasa", lat: -4.32, lon: 15.33 },
  { name: "Rhine near Cologne", lat: 50.825, lon: 6.975 },
  { name: "Amazon near Manaus", lat: -3.125, lon: -59.925 },
  { name: "Mississippi near Vicksburg", lat: 32.325, lon: -91.025 },
  { name: "Yangtze near Wuhan", lat: 30.675, lon: 114.325 },
  { name: "Mekong near Phnom Penh", lat: 11.425, lon: 104.875 },
  { name: "Indus near Hyderabad", lat: 25.425, lon: 68.275 },
] as const;

export const AIR_CITIES = [
  { name: "Delhi", lat: 28.61, lon: 77.21 },
  { name: "Lahore", lat: 31.52, lon: 74.36 },
  { name: "Dhaka", lat: 23.81, lon: 90.41 },
  { name: "Jakarta", lat: -6.21, lon: 106.85 },
  { name: "Beijing", lat: 39.9, lon: 116.41 },
  { name: "Lagos", lat: 6.52, lon: 3.38 },
  { name: "Cairo", lat: 30.04, lon: 31.24 },
  { name: "Mexico City", lat: 19.43, lon: -99.13 },
  { name: "Los Angeles", lat: 34.05, lon: -118.24 },
  { name: "Santiago", lat: -33.45, lon: -70.67 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
  { name: "Paris", lat: 48.86, lon: 2.35 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Nairobi", lat: -1.29, lon: 36.82 },
  { name: "Seoul", lat: 37.57, lon: 126.98 },
  { name: "New York", lat: 40.71, lon: -74.01 },
] as const;

export const NWS_POINTS = [
  { name: "Miami", lat: 25.76, lon: -80.19 },
  { name: "New Orleans", lat: 29.95, lon: -90.07 },
  { name: "Houston", lat: 29.76, lon: -95.37 },
  { name: "Los Angeles", lat: 34.05, lon: -118.24 },
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "Chicago", lat: 41.88, lon: -87.63 },
  { name: "Seattle", lat: 47.61, lon: -122.33 },
  { name: "San Juan", lat: 18.47, lon: -66.11 },
  { name: "Phoenix", lat: 33.45, lon: -112.07 },
  { name: "Atlanta", lat: 33.75, lon: -84.39 },
] as const;

export const WATCH_AREAS = [
  { name: "Any region", lat: 0, lon: 0, radiusKm: 20000 },
  { name: "Miami", lat: 25.76, lon: -80.19, radiusKm: 700 },
  { name: "New Orleans", lat: 29.95, lon: -90.07, radiusKm: 700 },
  { name: "Mexico City", lat: 19.43, lon: -99.13, radiusKm: 600 },
  { name: "Los Angeles", lat: 34.05, lon: -118.24, radiusKm: 600 },
  { name: "New York", lat: 40.71, lon: -74.01, radiusKm: 500 },
  { name: "San Juan", lat: 18.47, lon: -66.11, radiusKm: 500 },
  { name: "London", lat: 51.51, lon: -0.13, radiusKm: 600 },
  { name: "Paris", lat: 48.86, lon: 2.35, radiusKm: 600 },
  { name: "Lagos", lat: 6.52, lon: 3.38, radiusKm: 700 },
  { name: "Cairo", lat: 30.04, lon: 31.24, radiusKm: 700 },
  { name: "Nairobi", lat: -1.29, lon: 36.82, radiusKm: 700 },
  { name: "Dhaka", lat: 23.81, lon: 90.41, radiusKm: 700 },
  { name: "Jakarta", lat: -6.21, lon: 106.85, radiusKm: 700 },
  { name: "Tokyo", lat: 35.68, lon: 139.69, radiusKm: 600 },
  { name: "Sydney", lat: -33.87, lon: 151.21, radiusKm: 700 },
] as const;

export const OPEN_METEO_NOTICE =
  "Open-Meteo flood and air-quality calls are free for non-commercial use. Attribute Open-Meteo and, for rivers, GloFAS.";
