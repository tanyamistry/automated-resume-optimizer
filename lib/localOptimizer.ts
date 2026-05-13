import { containsTerm, flattenKeywords } from "./keywordExtractor";
import type { LocalAnalysis, OptimizationResult } from "./types";

const ACTION_VERB_UPGRADES: Record<string, string> = {
  worked: "Contributed",
  helped: "Supported",
  made: "Built",
  did: "Delivered",
  used: "Applied",
  responsible: "Owned",
  created: "Developed"
};

const SECTION_HINTS = [
  "summary",
  "experience",
  "work experience",
  "professional experience",
  "projects",
  "skills",
  "education"
];

export function optimizeResumeLocally(
  resumeText: string,
  analysis: LocalAnalysis
): OptimizationResult {
  const bullets = extractBulletsWithSections(resumeText);
  const matchedKeywords = analysis.gapAnalysis.matchedKeywords;
  const missingKeywords = analysis.gapAnalysis.missingKeywords;
  const weakKeywords = analysis.gapAnalysis.weakKeywords;
  const allKeywords = flattenKeywords(analysis.keywords);

  const bulletEdits = bullets
    .map((bullet) => createBulletEdit(bullet, allKeywords, weakKeywords))
    .filter((edit): edit is NonNullable<typeof edit> => Boolean(edit))
    .slice(0, 8);

  const safeSkillAdds = missingKeywords.slice(0, 12);
  const scoreLift = Math.min(18, safeSkillAdds.length * 2 + bulletEdits.length);

  return {
    atsScoreBefore: analysis.score.total,
    atsScoreAfterEstimate: Math.min(100, analysis.score.total + scoreLift),
    summaryRewrite: createSummaryRewrite(resumeText, matchedKeywords, missingKeywords),
    bulletEdits,
    skillsEdits: {
      add: safeSkillAdds,
      remove: analysis.gapAnalysis.lowValueSkills,
      keep: matchedKeywords.slice(0, 18)
    },
    warnings: createWarnings(missingKeywords, bulletEdits.length)
  };
}

type ResumeBullet = {
  section: string;
  text: string;
};

function createBulletEdit(
  bullet: ResumeBullet,
  allKeywords: string[],
  weakKeywords: string[]
): OptimizationResult["bulletEdits"][number] | null {
  const original = bullet.text;
  let optimized = stripBulletMarker(original).trim();
  const keywordsAlreadyPresent = allKeywords.filter((term) => containsTerm(original, term));
  const keywordToReinforce = weakKeywords.find((term) => containsTerm(original, term));
  const keywordsAdded: string[] = [];

  optimized = upgradeOpeningVerb(optimized);
  optimized = tightenFiller(optimized);

  if (keywordToReinforce && !endsWithKeywordContext(optimized, keywordToReinforce)) {
    optimized = appendContextPhrase(optimized, keywordToReinforce);
    keywordsAdded.push(keywordToReinforce);
  }

  if (optimized === stripBulletMarker(original).trim()) {
    if (keywordsAlreadyPresent.length === 0) {
      return null;
    }
    optimized = appendContextPhrase(optimized, keywordsAlreadyPresent[0]);
  }

  return {
    section: bullet.section,
    original,
    optimized: preserveBulletMarker(original, optimized),
    keywordsAdded,
    reason:
      keywordsAdded.length > 0
        ? "Reinforces a job description keyword already present in your resume context."
        : "Tightens phrasing while preserving the original claim, metric, and context."
  };
}

function createSummaryRewrite(
  resumeText: string,
  matchedKeywords: string[],
  missingKeywords: string[]
): string {
  const currentSummary = extractSummary(resumeText);
  const topMatched = matchedKeywords.slice(0, 6);
  const focus = topMatched.length > 0 ? topMatched.join(", ") : "relevant technical work";
  const base =
    currentSummary ||
    "Data-focused professional with experience delivering practical technical solutions across projects and cross-functional teams.";

  const cleaned = base
    .replace(/\s+/g, " ")
    .replace(/;/g, ",")
    .replace(/\s[-–—]\s/g, ", ")
    .trim();

  const missingNote =
    missingKeywords.length > 0
      ? ` Review whether ${missingKeywords.slice(0, 4).join(", ")} can be added where accurate.`
      : "";

  return `${cleaned} Emphasize ${focus} for this role while keeping claims tied to your actual experience.${missingNote}`;
}

function createWarnings(missingKeywords: string[], bulletEditCount: number): string[] {
  const warnings = [
    "This local optimizer does not invent missing experience. Add suggested skills only when they are true for you.",
    "Review every bullet before copying it back into your resume."
  ];

  if (missingKeywords.length > 0) {
    warnings.push(
      "Some job description keywords are missing from the resume. The app lists them as skill additions instead of forcing them into bullets."
    );
  }

  if (bulletEditCount === 0) {
    warnings.push(
      "No safe bullet rewrites were detected. Add more detailed experience bullets to get stronger suggestions."
    );
  }

  return warnings;
}

function extractBulletsWithSections(resumeText: string): ResumeBullet[] {
  const lines = resumeText.split(/\r?\n/);
  let section = "Resume";
  const bullets: ResumeBullet[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (isSectionHeader(trimmed)) {
      section = trimmed;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      bullets.push({ section, text: trimmed });
    }
  }

  return bullets;
}

function extractSummary(resumeText: string): string {
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const summaryIndex = lines.findIndex((line) => /^summary$/i.test(line));

  if (summaryIndex === -1) {
    return "";
  }

  return lines
    .slice(summaryIndex + 1)
    .find((line) => !isSectionHeader(line) && !/^[-*•]\s+/.test(line)) ?? "";
}

function isSectionHeader(line: string): boolean {
  const normalized = line.toLowerCase().replace(/:$/, "");
  return SECTION_HINTS.includes(normalized) || /^[A-Z][A-Z\s/&]+$/.test(line);
}

function upgradeOpeningVerb(text: string): string {
  for (const [weak, strong] of Object.entries(ACTION_VERB_UPGRADES)) {
    const regex = new RegExp(`^${weak}\\b`, "i");
    if (regex.test(text)) {
      return text.replace(regex, strong);
    }
  }

  return text;
}

function tightenFiller(text: string): string {
  return text
    .replace(/\bvarious\b/gi, "multiple")
    .replace(/\bin order to\b/gi, "to")
    .replace(/\butilized\b/gi, "used")
    .replace(/\s+/g, " ")
    .replace(/;/g, ",")
    .replace(/\s[-–—]\s/g, ", ")
    .trim();
}

function appendContextPhrase(text: string, keyword: string): string {
  const trimmed = text.replace(/[.。]\s*$/, "");
  return `${trimmed}, with emphasis on ${keyword}.`;
}

function endsWithKeywordContext(text: string, keyword: string): boolean {
  return new RegExp(`emphasis on ${escapeRegex(keyword)}`, "i").test(text);
}

function stripBulletMarker(text: string): string {
  return text.replace(/^([-*•]\s+)/, "");
}

function preserveBulletMarker(original: string, text: string): string {
  const marker = original.match(/^([-*•]\s+)/)?.[1] ?? "- ";
  return `${marker}${text}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
