import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../src/proxy";

function call(path: string) {
  return proxy(new NextRequest(new URL(path, "https://four-forces-one-world.vercel.app")));
}

describe("site closure", () => {
  it("returns 403 with no app content for pages, APIs, and assets", async () => {
    for (const path of ["/", "/api/events", "/api/health", "/data/demo-snapshot.json", "/textures/earth-blue-marble.jpg", "/_next/static/chunks/app.js"]) {
      const response = await call(path);
      const body = await response.text();
      expect(response.status, path).toBe(403);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(body).toContain("Site closed. Access restricted.");
      expect(body.toLowerCase()).not.toContain("four forces");
      expect(body).not.toContain("http");
    }
  });

  it("serves a noindex robots file and nothing else", async () => {
    const response = await call("/robots.txt");
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain("Disallow: /");
    expect(body).toContain("Noindex: /");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});
