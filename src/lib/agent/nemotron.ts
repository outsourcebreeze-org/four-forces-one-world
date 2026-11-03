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

/**
 * Ultra still spends tokens on reasoning before the JSON, so it keeps a 4000 budget.
 * Triage is called with thinking off, so 800 is enough for its short JSON object.
 */
export function maxTokensForModel(model: string, triageModel: string): number {
  return model === triageModel ? 800 : 4000;
}

/**
 * Lightning and Super VL think by default. A short budget then ends inside the
 * trace and `content` comes back empty, so the brief parser never sees JSON.
 * Triage, briefs, and a fallback onto the triage model ask for a JSON object
 * with thinking off. Ultra keeps the previous request shape.
 */
export function usesDirectJson(role: ModelRole, model: string, triageModel: string): boolean {
  if (model === triageModel) return true;
  return role !== "analyst";
}

export function isUnsupportedJsonMode(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  const status = error.status;
  if (status !== 400 && status !== 422) return false;
  const message = error instanceof Error ? error.message : "";
  return /response_format|chat_template_kwargs|enable_thinking|json_object/i.test(message);
}

type ChatMessage = { role: "system" | "user"; content: string };

export function completionBody(options: {
  model: string;
  messages: ChatMessage[];
  triageModel: string;
  directJson: boolean;
}): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
    chat_template_kwargs?: { enable_thinking: boolean };
  } = {
    model: options.model,
    temperature: 0.2,
    max_tokens: maxTokensForModel(options.model, options.triageModel),
    messages: options.messages,
  };
  if (options.directJson) {
    body.response_format = { type: "json_object" };
    body.chat_template_kwargs = { enable_thinking: false };
  }
  return body;
}

export function readMessageContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const record = part as { type?: unknown; text?: unknown };
      // Super VL can return the trace as its own part. The JSON answer is the text part.
      if (record.type === "reasoning" || record.type === "thinking") return "";
      return typeof record.text === "string" ? record.text : "";
    })
    .join("")
    .trim();
}

export function shouldFallbackToNano(content: string, model: string, nanoModel: string): boolean {
  return content.trim().length === 0 && model !== nanoModel;
}

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
    const directJson = usesDirectJson(options.role, model, settings.triage);
    const request = (useDirectJson: boolean) =>
      client.chat.completions.create(
        completionBody({
          model,
          messages: options.messages,
          triageModel: settings.triage,
          directJson: useDirectJson,
        }),
      );
    try {
      const completion = await request(directJson);
      return readMessageContent(completion.choices[0]?.message?.content);
    } catch (error) {
      if (!directJson || !isUnsupportedJsonMode(error)) throw error;
      const completion = await request(false);
      return readMessageContent(completion.choices[0]?.message?.content);
    }
  }

  const first = await call(requested);
  if (!shouldFallbackToNano(first, requested, settings.triage)) {
    if (!first) throw new Error(`Empty content from ${requested}`);
    return { text: first, model: requested, emptyContentFallback: false };
  }
  const second = await call(settings.triage);
  if (!second) {
    throw new Error(`Empty content from ${requested}, and the triage fallback was empty too`);
  }
  return { text: second, model: settings.triage, emptyContentFallback: true };
}
