import { NextResponse } from "next/server";
import { optimizeResumeLocally } from "@/lib/localOptimizer";
import type { LocalAnalysis, OptimizeRequest } from "@/lib/types";

const MAX_INPUT_CHARS = 30000;

export async function POST(request: Request) {
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
  const result = optimizeResumeLocally(resumeText, analysis);

  return NextResponse.json({
    result,
    meta: {
      jobDescriptionLength: jobDescription.length,
      optimizer: "local-rule-based"
    }
  });
}

type ValidationResult =
  | { ok: true; value: OptimizeRequest }
  | { ok: false; error: string };

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

function isLocalAnalysis(value: unknown): value is LocalAnalysis {
  if (!isRecord(value) || !isRecord(value.score) || !isRecord(value.gapAnalysis)) {
    return false;
  }

  return typeof value.score.total === "number" && isRecord(value.keywords);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
