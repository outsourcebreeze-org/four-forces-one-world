import OpenAI from "openai";
import { DEFAULT_MODELS, NEBIUS_BASE_URL } from "../constants";
import { readServerEnv } from "../env";

export type ModelRole = "triage" | "brief" | "analyst";

export type ModelSettings = {
  baseURL: string;
  apiKey: string;
  triage: string;
  brief: string;
  analyst: string;
};

export function modelSettings(env: NodeJS.ProcessEnv = process.env): ModelSettings {
  return {
    baseURL: readServerEnv("NEBIUS_BASE_URL", env) || NEBIUS_BASE_URL,
    apiKey: readServerEnv("NEBIUS_API_KEY", env),
    triage: readServerEnv("NEMOTRON_TRIAGE_MODEL", env) || DEFAULT_MODELS.triage,
    brief: readServerEnv("NEMOTRON_BRIEF_MODEL", env) || DEFAULT_MODELS.brief,
    analyst: readServerEnv("NEMOTRON_ANALYST_MODEL", env) || DEFAULT_MODELS.analyst,
  };
}

export function modelFor(role: ModelRole, settings: ModelSettings = modelSettings()): string {
  return settings[role];
}

/** Super and Ultra spend tokens on reasoning. Below 1000, content often comes back empty. */
export function maxTokensForModel(model: string, nanoModel: string): number {
  // Reasoning models spend most of the budget before the JSON, so leave room past 1000.
  return model === nanoModel ? 800 : 4000;
}

export function readMessageContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("")
    .trim();
}

export function shouldFallbackToNano(content: string, model: string, nanoModel: string): boolean {
  return content.trim().length === 0 && model !== nanoModel;
}

type ChatMessage = { role: "system" | "user"; content: string };

export async function completeJson(options: {
  role: ModelRole;
  messages: ChatMessage[];
  settings?: ModelSettings;
}): Promise<{ text: string; model: string; emptyContentFallback: boolean }> {
  const settings = options.settings ?? modelSettings();
  if (!settings.apiKey) {
    throw new Error("NEBIUS_API_KEY is not set");
  }
  const client = new OpenAI({ apiKey: settings.apiKey, baseURL: settings.baseURL });
  const requested = modelFor(options.role, settings);

  async function call(model: string): Promise<string> {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: maxTokensForModel(model, settings.triage),
      messages: options.messages,
    });
    return readMessageContent(completion.choices[0]?.message?.content);
  }

  const first = await call(requested);
  if (!shouldFallbackToNano(first, requested, settings.triage)) {
    if (!first) throw new Error(`Empty content from ${requested}`);
    return { text: first, model: requested, emptyContentFallback: false };
  }
  const second = await call(settings.triage);
  if (!second) {
    throw new Error(`Empty content from ${requested}, and the Nano fallback was empty too`);
  }
  return { text: second, model: settings.triage, emptyContentFallback: true };
}
