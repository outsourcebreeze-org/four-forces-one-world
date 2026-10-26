"use client";

import { useState } from "react";

export function SentryExampleClient() {
  const [crash, setCrash] = useState(false);
  if (crash) {
    throw new Error("Sentry test error");
  }

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-serif text-3xl">Sentry test</h1>
      <p className="text-sm leading-6 text-[#f6f1e6]/80">
        This page is available only when <code>SENTRY_DEBUG_ROUTE=1</code>. The client button
        throws during render. The server button opens an API route that throws.
      </p>
      <button
        type="button"
        onClick={() => setCrash(true)}
        className="w-fit rounded-full bg-[#f6f1e6] px-4 py-2 text-sm font-medium text-[#1a1714]"
      >
        Throw client test error
      </button>
      <button
        type="button"
        onClick={() => {
          window.location.assign("/api/sentry-example-api");
        }}
        className="w-fit rounded-full border border-[#f6f1e6]/30 px-4 py-2 text-sm font-medium"
      >
        Throw server test error
      </button>
    </main>
  );
}
