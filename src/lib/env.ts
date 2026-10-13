/**
 * Read a server env var at request time.
 * Bracket access stays dynamic so Next.js does not inline the value at build.
 * On Vercel a direct `process.env.TAVILY_API_KEY` read can be frozen to whatever
 * was present during `next build`, which leaves a later runtime key invisible.
 */
export function readServerEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[name];
  if (typeof raw !== "string") return "";
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

export function tavilyKeyStatus(env: NodeJS.ProcessEnv = process.env): {
  tavilyConfigured: boolean;
} {
  return { tavilyConfigured: readServerEnv("TAVILY_API_KEY", env).length > 0 };
}
