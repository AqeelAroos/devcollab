import { Router, Response } from "express";
import Groq from "groq-sdk";
import { z } from "zod";
import type { AiSuggestion } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimiter";

export const aiRouter = Router();
aiRouter.use(authenticate);
aiRouter.use(aiRateLimiter);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const reviewSchema = z.object({
  pullRequestId: z.coerce.string(),
  diff: z.string().max(50000),
  language: z.string().optional(),
});

aiRouter.post("/review", async (req: AuthRequest, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { pullRequestId, diff, language } = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      stream: true,
      messages: [
        {
          role: "system",
          content: "You are an expert code reviewer. Be concise and actionable.",
        },
        {
          role: "user",
          content: `Review this pull request diff and provide structured feedback. For each issue use this format:
FILE: <filename>
LINE: <line number>
SEVERITY: <error|warning|info>
CATEGORY: <security|performance|style|logic>
SUGGESTION: <your suggestion>
---
${language ? `Primary language: ${language}.` : ""}

DIFF:
${diff}`,
        },
      ],
    });

    let fullText = "";

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) {
        fullText += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    const suggestions = parseSuggestions(fullText, pullRequestId);
    if (suggestions.length > 0) {
      await prisma.aiSuggestion.createMany({ data: suggestions });
    }

    res.write(`data: ${JSON.stringify({ done: true, count: suggestions.length })}\n\n`);
    res.end();
  } catch (err) {
    console.error("AI review error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI review failed" })}\n\n`);
    res.end();
  }
});

aiRouter.get("/suggestions/:pullRequestId", async (req: AuthRequest, res: Response) => {
  const suggestions = await prisma.aiSuggestion.findMany({
    where: { pullRequestId: req.params.pullRequestId },
    orderBy: { createdAt: "desc" },
  });
  res.json(suggestions.map((s: AiSuggestion) => ({
    id: s.id,
    filename: s.filePath,
    text: s.suggestion,
    severity: s.severity,
    category: s.category,
    lineStart: s.lineStart,
    lineEnd: s.lineEnd,
    createdAt: s.createdAt,
  })));
});

function parseSuggestions(text: string, pullRequestId: string) {
  const blocks = text.split("---").filter(Boolean);
  const suggestions = [];

  for (const block of blocks) {
    const file = block.match(/FILE:\s*(.+)/)?.[1]?.trim();
    const line = block.match(/LINE:\s*(.+)/)?.[1]?.trim();
    const severity = block.match(/SEVERITY:\s*(.+)/)?.[1]?.trim();
    const category = block.match(/CATEGORY:\s*(.+)/)?.[1]?.trim();
    const suggestion = block.match(/SUGGESTION:\s*([\s\S]+)/)?.[1]?.trim();

    if (file && suggestion) {
      const [lineStart, lineEnd] = (line || "1").split("-").map(Number);
      suggestions.push({
        pullRequestId,
        filePath: file,
        lineStart: lineStart || 1,
        lineEnd: lineEnd || lineStart || 1,
        severity: severity || "info",
        category: category || "style",
        suggestion,
      });
    }
  }

  return suggestions;
}
