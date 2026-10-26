import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // The dev server is bound on 0.0.0.0; browsers that open 127.0.0.1 must still receive JS.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

function readBuildEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value.length > 0 ? value : undefined;
}

const sentryAuthToken = readBuildEnv("SENTRY_AUTH_TOKEN");

export default withSentryConfig(nextConfig, {
  org: readBuildEnv("SENTRY_ORG") ?? "outsourcebreeze",
  project: readBuildEnv("SENTRY_PROJECT") ?? "four-forces-one-world",
  authToken: sentryAuthToken,
  // Upload source maps only when a token is present. Without one, disable
  // source map handling so the production build does not contact Sentry.
  sourcemaps: sentryAuthToken
    ? { disable: false, deleteSourcemapsAfterUpload: true }
    : { disable: true },
  widenClientFileUpload: Boolean(sentryAuthToken),
  telemetry: false,
  silent: !process.env.CI,
});
