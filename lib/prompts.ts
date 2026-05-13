import type { LocalAnalysis } from "./types";

export function buildOptimizationPrompt(
  resumeText: string,
  jobDescription: string,
  analysis: LocalAnalysis
): string {
  return `
You are a resume ATS optimization assistant. Improve resume sections only when the original content supports the change.

Hard rules:
- Do not hallucinate fake experience.
- Do not remove or change metrics or numbers.
- Do not change company names, dates, education, or project names.
- Preserve bullet count unless the user explicitly asks otherwise.
- Preserve original work context.
- Keep bullet length close to the original.
- Add missing job description keywords naturally, not as keyword stuffing.
- Prioritize work experience and projects before skills.
- Keep writing professional, concise, and human.
- Avoid semicolons.
- Avoid big dashes.

Return strict JSON only. Do not include markdown, commentary, or code fences.

Expected JSON shape:
{
  "atsScoreBefore": number,
  "atsScoreAfterEstimate": number,
  "summaryRewrite": string,
  "bulletEdits": [
    {
      "section": string,
      "original": string,
      "optimized": string,
      "keywordsAdded": string[],
      "reason": string
    }
  ],
  "skillsEdits": {
    "add": string[],
    "remove": string[],
    "keep": string[]
  },
  "warnings": string[]
}

Local rule-based ATS score before: ${analysis.score.total}

Extracted keyword groups:
${JSON.stringify(analysis.keywords, null, 2)}

Matched keywords:
${analysis.gapAnalysis.matchedKeywords.join(", ") || "None detected"}

Missing keywords:
${analysis.gapAnalysis.missingKeywords.join(", ") || "None detected"}

Weakly represented keywords:
${analysis.gapAnalysis.weakKeywords.join(", ") || "None detected"}

Resume text:
${resumeText}

Job description:
${jobDescription}
`.trim();
}
