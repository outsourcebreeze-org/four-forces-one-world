import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clientSentryDsn,
  clientTracesSampleRate,
  isSentryDebugRouteEnabled,
  parseTracesSampleRate,
  sentryMonitoringOptions,
  serverSentryDsn,
  serverTracesSampleRate,
} from "../src/lib/sentry-options";

function env(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe("sentry options", () => {
  it("reads the server DSN and falls back to the public DSN", () => {
    expect(serverSentryDsn(env())).toBe("");
    expect(serverSentryDsn(env({ SENTRY_DSN: " https://server.example/1 " }))).toBe(
      "https://server.example/1",
    );
    expect(serverSentryDsn(env({ NEXT_PUBLIC_SENTRY_DSN: '"https://public.example/1"' }))).toBe(
      "https://public.example/1",
    );
    expect(
      serverSentryDsn(
        env({
          SENTRY_DSN: "https://server.example/1",
          NEXT_PUBLIC_SENTRY_DSN: "https://public.example/1",
        }),
      ),
    ).toBe("https://server.example/1");
  });

  it("keeps an empty DSN empty for the browser helper", () => {
    expect(clientSentryDsn(undefined)).toBe("");
    expect(clientSentryDsn("  ")).toBe("");
    expect(clientSentryDsn("https://public.example/1")).toBe("https://public.example/1");
  });

  it("defaults the trace sample rate to 0.1 and accepts 0 through 1", () => {
    expect(parseTracesSampleRate(undefined)).toBe(0.1);
    expect(parseTracesSampleRate("")).toBe(0.1);
    expect(parseTracesSampleRate("nope")).toBe(0.1);
    expect(parseTracesSampleRate("2")).toBe(0.1);
    expect(parseTracesSampleRate("-0.1")).toBe(0.1);
    expect(parseTracesSampleRate("0")).toBe(0);
    expect(parseTracesSampleRate("0.25")).toBe(0.25);
    expect(parseTracesSampleRate("1")).toBe(1);
    expect(serverTracesSampleRate(env())).toBe(0.1);
    expect(serverTracesSampleRate(env({ SENTRY_TRACES_SAMPLE_RATE: "0.4" }))).toBe(0.4);
    expect(serverTracesSampleRate(env({ NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "0.2" }))).toBe(
      0.2,
    );
    expect(
      serverTracesSampleRate(
        env({
          SENTRY_TRACES_SAMPLE_RATE: "0.4",
          NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "0.2",
        }),
      ),
    ).toBe(0.4);
    expect(clientTracesSampleRate(undefined)).toBe(0.1);
    expect(clientTracesSampleRate("0.3")).toBe(0.3);
  });

  it("turns the debug route on only for SENTRY_DEBUG_ROUTE=1", () => {
    expect(isSentryDebugRouteEnabled(env())).toBe(false);
    expect(isSentryDebugRouteEnabled(env({ SENTRY_DEBUG_ROUTE: "true" }))).toBe(false);
    expect(isSentryDebugRouteEnabled(env({ SENTRY_DEBUG_ROUTE: " 1 " }))).toBe(true);
  });

  it("does not enable replay and keeps personal data off", () => {
    const options = sentryMonitoringOptions("https://public.example/1", 0.1);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0.1);
    expect(options.dataCollection.userInfo).toBe(false);
    expect(options.dataCollection.cookies).toBe(false);
    expect(options.dataCollection.httpHeaders).toBe(false);
    expect(options.dataCollection.httpBodies).toEqual([]);
    expect(options.dataCollection.urlQueryParams).toBe(false);
    expect(options.dataCollection.stackFrameVariables).toBe(false);
    expect(options.dataCollection.genAI).toEqual({ inputs: false, outputs: false });
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
  });

  it("does not hardcode a DSN or Session Replay", () => {
    const files = [
      "next.config.ts",
      "src/instrumentation.ts",
      "src/instrumentation-client.ts",
      "src/sentry.server.config.ts",
      "src/sentry.edge.config.ts",
      "src/lib/sentry-options.ts",
      "src/app/global-error.tsx",
      "src/app/error.tsx",
      "src/app/sentry-example-page/page.tsx",
      "src/app/api/sentry-example-api/route.ts",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/https:\/\/[0-9a-f]+@/i);
      expect(source, file).not.toContain("ingest.sentry.io");
      expect(source, file).not.toContain("replayIntegration");
    }
  });
});
