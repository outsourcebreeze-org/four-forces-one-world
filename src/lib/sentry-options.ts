import { readServerEnv } from "@/lib/env";

/** Default performance trace sample rate when no env override is set. */
export const DEFAULT_SENTRY_TRACES_SAMPLE_RATE = 0.1;

/**
 * Monitoring options shared by the browser, server, and edge SDKs.
 *
 * `sendDefaultPii: false` is set explicitly. `@sentry/nextjs` 11 no longer
 * reads that flag; it collects user info, cookies, headers, and bodies unless
 * `dataCollection` turns them off. Both are set so the privacy behavior stays
 * in place on this SDK and on a later one that understands the old flag.
 * Session Replay is not enabled.
 */
export function sentryMonitoringOptions(dsn: string, tracesSampleRate: number) {
  return {
    dsn,
    tracesSampleRate,
    sendDefaultPii: false as const,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    },
  };
}

export function parseTracesSampleRate(raw: string | undefined): number {
  if (raw == null) return DEFAULT_SENTRY_TRACES_SAMPLE_RATE;
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return DEFAULT_SENTRY_TRACES_SAMPLE_RATE;
  }
  return value;
}

/** Server and edge DSN. `SENTRY_DSN` wins; otherwise the public DSN is used. */
export function serverSentryDsn(env: NodeJS.ProcessEnv = process.env): string {
  return readServerEnv("SENTRY_DSN", env) || readServerEnv("NEXT_PUBLIC_SENTRY_DSN", env);
}

/**
 * Server and edge trace sample rate.
 * `SENTRY_TRACES_SAMPLE_RATE` wins. Otherwise the public rate is used.
 * An empty value falls through; an invalid value becomes the default 0.1.
 */
export function serverTracesSampleRate(env: NodeJS.ProcessEnv = process.env): number {
  const specific = readServerEnv("SENTRY_TRACES_SAMPLE_RATE", env);
  if (specific) return parseTracesSampleRate(specific);
  const shared = readServerEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", env);
  return parseTracesSampleRate(shared || undefined);
}

/**
 * Browser DSN. Pass `process.env.NEXT_PUBLIC_SENTRY_DSN` from client code so
 * Next.js can inline it. Server-only `SENTRY_DSN` is not available in the browser.
 */
export function clientSentryDsn(raw: string | undefined): string {
  return readServerEnv("NEXT_PUBLIC_SENTRY_DSN", {
    NEXT_PUBLIC_SENTRY_DSN: raw,
  } as NodeJS.ProcessEnv);
}

/** Browser trace sample rate. Pass `process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`. */
export function clientTracesSampleRate(raw: string | undefined): number {
  const shared = readServerEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", {
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: raw,
  } as NodeJS.ProcessEnv);
  return parseTracesSampleRate(shared || undefined);
}

/** Test error routes respond only when this is exactly `1`. */
export function isSentryDebugRouteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readServerEnv("SENTRY_DEBUG_ROUTE", env) === "1";
}
