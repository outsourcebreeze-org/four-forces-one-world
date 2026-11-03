import * as Sentry from "@sentry/nextjs";
import { sentryMonitoringOptions, serverSentryDsn, serverTracesSampleRate } from "@/lib/sentry-options";

const dsn = serverSentryDsn();

if (dsn) {
  Sentry.init(sentryMonitoringOptions(dsn, serverTracesSampleRate()));
}
