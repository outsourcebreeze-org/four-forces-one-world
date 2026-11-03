import { notFound } from "next/navigation";
import { isSentryDebugRouteEnabled } from "@/lib/sentry-options";
import { SentryExampleClient } from "./sentry-example-client";

export const dynamic = "force-dynamic";

export default function SentryExamplePage() {
  if (!isSentryDebugRouteEnabled()) {
    notFound();
  }

  return <SentryExampleClient />;
}
