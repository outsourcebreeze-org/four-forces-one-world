"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <head>
        <title>Something went wrong</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#100e0c",
          color: "#f6f1e6",
          fontFamily: '"Segoe UI", sans-serif',
        }}
      >
        <main style={{ maxWidth: "32rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 560, margin: "0 0 0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 1.25rem", lineHeight: 1.5 }}>
            This page could not be shown. Try again.
          </p>
          {error.digest ? (
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", opacity: 0.75 }}>
              Reference {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#f6f1e6",
              color: "#1a1714",
              border: 0,
              borderRadius: "999px",
              padding: "0.5rem 1rem",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
