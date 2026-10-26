import * as Sentry from "@sentry/nextjs";
import { clientSentryDsn, clientTracesSampleRate, sentryMonitoringOptions } from "@/lib/sentry-options";

const dsn = clientSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);

if (dsn) {
  Sentry.init(
    sentryMonitoringOptions(
      dsn,
      clientTracesSampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
    ),
  );
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
