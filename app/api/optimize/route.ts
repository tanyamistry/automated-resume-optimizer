import { NextResponse } from "next/server";
import { buildOptimizationPrompt } from "@/lib/prompts";
import type { LocalAnalysis, OptimizationResult, OptimizeRequest } from "@/lib/types";

const MAX_INPUT_CHARS = 30000;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server."
      },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const validation = validateOptimizeRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { resumeText, jobDescription, analysis } = validation.value;
  const prompt = buildOptimizationPrompt(resumeText, jobDescription, analysis);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You return only valid JSON for a resume optimization UI. You preserve factual accuracy and never invent experience."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        text: {
          format: {
            type: "json_object"
          }
        }
      })
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "The AI optimization request failed. Check your API key, model, and billing status."
        },
        { status: response.status }
      );
    }

    const data = (await response.json()) as OpenAIResponse;
    const text = extractResponseText(data);
    if (!text) {
      return NextResponse.json(
        { error: "The AI response was empty or unreadable." },
        { status: 502 }
      );
    }

    const parsed = parseOptimizationResult(text, analysis);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 502 });
    }

    return NextResponse.json({ result: parsed.value });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the AI provider right now." },
      { status: 502 }
    );
  }
}

type ValidationResult =
  | { ok: true; value: OptimizeRequest }
  | { ok: false; error: string };

type ParseResult =
  | { ok: true; value: OptimizationResult }
  | { ok: false; error: string };

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

function validateOptimizeRequest(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be an object." };
  }

  const resumeText = body.resumeText;
  const jobDescription = body.jobDescription;
  const analysis = body.analysis;

  if (typeof resumeText !== "string" || resumeText.trim().length < 80) {
    return { ok: false, error: "Resume text is too short to optimize." };
  }

  if (typeof jobDescription !== "string" || jobDescription.trim().length < 80) {
    return { ok: false, error: "Job description is too short to optimize." };
  }

  if (
    resumeText.length > MAX_INPUT_CHARS ||
    jobDescription.length > MAX_INPUT_CHARS
  ) {
    return {
      ok: false,
      error: "Resume text and job description must each be under 30,000 characters."
    };
  }

  if (!isLocalAnalysis(analysis)) {
    return { ok: false, error: "Analysis payload is invalid. Run analysis again." };
  }

  return {
    ok: true,
    value: {
      resumeText,
      jobDescription,
      analysis
    }
  };
}

function parseOptimizationResult(text: string, analysis: LocalAnalysis): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "The AI returned invalid JSON. Try again." };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: "The AI returned an unexpected response shape." };
  }

  const result: OptimizationResult = {
    atsScoreBefore: toScore(parsed.atsScoreBefore, analysis.score.total),
    atsScoreAfterEstimate: toScore(
      parsed.atsScoreAfterEstimate,
      Math.min(100, analysis.score.total + 8)
    ),
    summaryRewrite:
      typeof parsed.summaryRewrite === "string" ? parsed.summaryRewrite : "",
    bulletEdits: Array.isArray(parsed.bulletEdits)
      ? parsed.bulletEdits.filter(isBulletEdit).slice(0, 12)
      : [],
    skillsEdits: isRecord(parsed.skillsEdits)
      ? {
          add: toStringArray(parsed.skillsEdits.add),
          remove: toStringArray(parsed.skillsEdits.remove),
          keep: toStringArray(parsed.skillsEdits.keep)
        }
      : { add: [], remove: [], keep: [] },
    warnings: toStringArray(parsed.warnings)
  };

  if (!result.summaryRewrite && result.bulletEdits.length === 0) {
    return {
      ok: false,
      error: "The AI did not return usable resume suggestions. Try again."
    };
  }

  return { ok: true, value: result };
}

function extractResponseText(data: OpenAIResponse): string {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .find((text): text is string => typeof text === "string" && text.length > 0) ??
    ""
  );
}

function isLocalAnalysis(value: unknown): value is LocalAnalysis {
  if (!isRecord(value) || !isRecord(value.score) || !isRecord(value.gapAnalysis)) {
    return false;
  }

  return typeof value.score.total === "number" && isRecord(value.keywords);
}

function isBulletEdit(value: unknown): value is OptimizationResult["bulletEdits"][number] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.section === "string" &&
    typeof value.original === "string" &&
    typeof value.optimized === "string" &&
    Array.isArray(value.keywordsAdded) &&
    typeof value.reason === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 30)
    : [];
}

function toScore(value: unknown, fallback: number): number {
  return typeof value === "number"
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}
