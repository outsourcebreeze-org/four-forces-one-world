import { isSentryDebugRouteEnabled } from "@/lib/sentry-options";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  if (!isSentryDebugRouteEnabled()) {
    return new Response(null, { status: 404 });
  }

  throw new Error("Sentry test error");
}
