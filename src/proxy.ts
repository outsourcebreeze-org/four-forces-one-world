import type { NextRequest } from "next/server";

/**
 * Temporary full-site closure. Runs before pages, API routes, and static
 * assets. Delete this file to reopen the site.
 */
const CLOSED_BODY = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Site closed</title>
</head>
<body>
<p>Site closed. Access restricted.</p>
</body>
</html>
`;

const ROBOTS_BODY = `User-agent: *
Disallow: /
Noindex: /
`;

const NOINDEX = "noindex, nofollow, noarchive";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/robots.txt") {
    return new Response(ROBOTS_BODY, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store, max-age=0",
        "cdn-cache-control": "no-store",
        "vercel-cdn-cache-control": "no-store",
        "x-robots-tag": NOINDEX,
      },
    });
  }

  return new Response(CLOSED_BODY, {
    status: 403,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "cdn-cache-control": "no-store",
      "vercel-cdn-cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": NOINDEX,
    },
  });
}
