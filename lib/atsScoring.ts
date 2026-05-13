import {
  analyzeKeywordGaps,
  flattenKeywords,
  getRequiredKeywords
} from "./keywordExtractor";
import type { AtsScore, KeywordGroups, LocalAnalysis, ScoreBreakdown } from "./types";

const SECTION_HEADERS = [
  "summary",
  "experience",
  "work experience",
  "professional experience",
  "projects",
  "skills",
  "education"
];

const ACTION_VERBS = [
  "built",
  "developed",
  "led",
  "designed",
  "implemented",
  "optimized",
  "improved",
  "automated",
  "created",
  "delivered",
  "managed",
  "reduced",
  "increased",
  "launched",
  "analyzed",
  "collaborated"
];

export function createLocalAnalysis(
  resumeText: string,
  jobDescription: string,
  keywords: KeywordGroups
): LocalAnalysis {
  const gapAnalysis = analyzeKeywordGaps(resumeText, jobDescription, keywords);
  const score = scoreResume(resumeText, jobDescription, keywords);

  return {
    keywords,
    gapAnalysis,
    score
  };
}

export function scoreResume(
  resumeText: string,
  jobDescription: string,
  keywords: KeywordGroups
): AtsScore {
  const allKeywords = flattenKeywords(keywords);
  const gapAnalysis = analyzeKeywordGaps(resumeText, jobDescription, keywords);
  const requiredKeywords = getRequiredKeywords(jobDescription, keywords);

  const keywordCoverage =
    allKeywords.length === 0
      ? 70
      : Math.round((gapAnalysis.matchedKeywords.length / allKeywords.length) * 100);

  const requiredSkillsCoverage =
    requiredKeywords.length === 0
      ? keywordCoverage
      : Math.round(
          (requiredKeywords.filter((term) => gapAnalysis.matchedKeywords.includes(term))
            .length /
            requiredKeywords.length) *
            100
        );

  const resumeStructure = scoreStructure(resumeText);
  const metricsActionVerbs = scoreMetricsAndVerbs(resumeText);
  const formattingReadability = scoreReadability(resumeText);

  const breakdown: ScoreBreakdown = {
    keywordCoverage,
    requiredSkillsCoverage,
    resumeStructure,
    metricsActionVerbs,
    formattingReadability
  };

  const total = Math.round(
    keywordCoverage * 0.35 +
      requiredSkillsCoverage * 0.25 +
      resumeStructure * 0.15 +
      metricsActionVerbs * 0.15 +
      formattingReadability * 0.1
  );

  return {
    total: clampScore(total),
    breakdown: mapBreakdown(breakdown)
  };
}

function scoreStructure(resumeText: string): number {
  const lower = resumeText.toLowerCase();
  const foundSections = SECTION_HEADERS.filter((section) =>
    lower.includes(section)
  ).length;
  const bulletCount = extractBullets(resumeText).length;
  const hasContactSignal = /@|\blinkedin\b|\bgithub\b|\bportfolio\b/i.test(resumeText);

  return clampScore(foundSections * 12 + Math.min(bulletCount * 2, 30) + (hasContactSignal ? 10 : 0));
}

function scoreMetricsAndVerbs(resumeText: string): number {
  const bullets = extractBullets(resumeText);
  const source = bullets.length > 0 ? bullets : resumeText.split(/\r?\n/);
  const metricLines = source.filter((line) => /\d|%|\$|x\b|k\b|m\b/i.test(line)).length;
  const verbLines = source.filter((line) =>
    ACTION_VERBS.some((verb) => new RegExp(`\\b${verb}\\b`, "i").test(line))
  ).length;

  if (source.length === 0) {
    return 35;
  }

  return clampScore(
    Math.round((metricLines / source.length) * 50 + (verbLines / source.length) * 50)
  );
}

function scoreReadability(resumeText: string): number {
  const lines = resumeText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const longLines = lines.filter((line) => line.length > 180).length;
  const hasTablesOrOddChars = /[│┌┐└┘]/.test(resumeText);
  const bulletCount = extractBullets(resumeText).length;

  let score = 90;
  score -= Math.min(longLines * 8, 32);
  score -= hasTablesOrOddChars ? 15 : 0;
  score += bulletCount >= 5 ? 5 : 0;

  return clampScore(score);
}

function extractBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line));
}

function mapBreakdown(breakdown: ScoreBreakdown): ScoreBreakdown {
  return Object.fromEntries(
    Object.entries(breakdown).map(([key, value]) => [key, clampScore(value)])
  ) as ScoreBreakdown;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
