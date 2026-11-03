"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-serif text-3xl">Something went wrong</h1>
      <p className="text-sm leading-6 text-[#f6f1e6]/80">This view hit an error. Try again.</p>
      {error.digest ? (
        <p className="text-xs text-[#f6f1e6]/60">Reference {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => retry()}
        className="w-fit rounded-full bg-[#f6f1e6] px-4 py-2 text-sm font-medium text-[#1a1714]"
      >
        Try again
      </button>
    </main>
  );
}
