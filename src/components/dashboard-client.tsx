"use client";

import dynamic from "next/dynamic";

// Browser translation rewrites server HTML before hydration (it wraps text in
// <font>). That mismatch can abort hydration, so the feed effect never runs and
// the translated loading sentence stays on screen. This shell has no text.
// The dashboard mounts only in the browser, then draws the globe immediately.
const Dashboard = dynamic(() => import("@/components/dashboard").then((mod) => mod.Dashboard), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-[#100e0c]" />,
});

export function DashboardClient() {
  return <Dashboard />;
}
