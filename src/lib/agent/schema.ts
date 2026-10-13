import { z } from "zod";

export const briefDraftSchema = z.object({
  headline: z.string().min(3).max(180),
  summary: z.string().min(1),
  affectedArea: z.string().nullable(),
  populationEstimate: z.string().nullable(),
  confidence: z.object({
    level: z.enum(["low", "medium", "high"]),
    score: z.number().min(0).max(100),
  }),
  evidence: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      source: z.string(),
      stance: z.enum(["agree", "disagree", "unconfirmed"]),
      note: z.string(),
    }),
  ),
  contradictions: z.array(z.string()),
  whatChanged: z.string(),
  guidanceLinks: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
    }),
  ),
});

export type BriefDraft = z.infer<typeof briefDraftSchema>;
