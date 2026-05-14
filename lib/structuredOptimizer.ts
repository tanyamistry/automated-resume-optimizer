import { containsTerm, flattenKeywords } from "./keywordExtractor";
import type { KeywordCategory, LocalAnalysis, ProposedChange, ResumeDocument } from "./types";

const ACTION_VERB_UPGRADES: Record<string, string> = {
  worked: "Collaborated",
  helped: "Supported",
  made: "Built",
  did: "Delivered",
  used: "Applied",
  responsible: "Owned",
  created: "Developed"
};

export function generateStructuredChanges(
  doc: ResumeDocument,
  analysis: LocalAnalysis
): ProposedChange[] {
  const changes: ProposedChange[] = [];
  const matchedKeywords = analysis.gapAnalysis.matchedKeywords;
  const weakKeywords = analysis.gapAnalysis.weakKeywords;
  const allKeywords = flattenKeywords(analysis.keywords);

  const summaryChange = createSummaryChange(doc, matchedKeywords);
  if (summaryChange) {
    changes.push(summaryChange);
  }

  doc.experience.forEach((item, itemIndex) => {
    item.bullets.forEach((bullet, bulletIndex) => {
      const change = createBulletChange({
        allKeywords,
        bullet,
        id: `experience-${itemIndex}-${bulletIndex}`,
        sectionLabel: `${item.company} - ${item.title}`,
        targetPath: `experience.${itemIndex}.bullets.${bulletIndex}`,
        weakKeywords
      });

      if (change) {
        changes.push(change);
      }
    });
  });

  doc.projects.forEach((item, itemIndex) => {
    item.bullets.forEach((bullet, bulletIndex) => {
      const change = createBulletChange({
        allKeywords,
        bullet,
        id: `projects-${itemIndex}-${bulletIndex}`,
        sectionLabel: item.name,
        targetPath: `projects.${itemIndex}.bullets.${bulletIndex}`,
        weakKeywords
      });

      if (change) {
        changes.push(change);
      }
    });
  });

  changes.push(...createSkillChanges(doc, analysis));

  return changes.slice(0, 18);
}

export function validateProposedChanges(value: unknown): ProposedChange[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const validChanges = value.filter(isProposedChange);
  return validChanges.length === value.length ? validChanges : null;
}

function createSummaryChange(
  doc: ResumeDocument,
  matchedKeywords: string[]
): ProposedChange | null {
  const original = doc.summary.trim();
  const focusKeywords = matchedKeywords
    .filter((keyword) => !containsTerm(original, keyword))
    .slice(0, 4);

  if (!original && focusKeywords.length === 0) {
    return null;
  }

  const base =
    original ||
    "Technical professional with experience delivering data and software projects with cross-functional teams.";
  const optimized =
    focusKeywords.length > 0
      ? `${sanitizeSentence(base)} Skilled in ${focusKeywords.join(", ")} with a focus on accurate, maintainable delivery.`
      : sanitizeSentence(base);

  if (optimized === original) {
    return null;
  }

  return {
    id: "summary",
    section: "summary",
    targetPath: "summary",
    original,
    optimized,
    keywordsAdded: focusKeywords,
    reason: "Aligns the professional summary with relevant job description keywords already supported by the resume.",
    status: "pending"
  };
}

function createBulletChange({
  allKeywords,
  bullet,
  id,
  sectionLabel,
  targetPath,
  weakKeywords
}: {
  allKeywords: string[];
  bullet: string;
  id: string;
  sectionLabel: string;
  targetPath: string;
  weakKeywords: string[];
}): ProposedChange | null {
  let optimized = sanitizeSentence(bullet);
  const keywordsAlreadyPresent = allKeywords.filter((keyword) => containsTerm(bullet, keyword));
  const keywordToReinforce = weakKeywords.find((keyword) => containsTerm(bullet, keyword));
  const keywordsAdded: string[] = [];

  optimized = upgradeOpeningVerb(optimized);
  optimized = optimized
    .replace(/\bvarious\b/gi, "multiple")
    .replace(/\bin order to\b/gi, "to")
    .replace(/\butilized\b/gi, "used")
    .trim();

  if (keywordToReinforce && !containsTerm(optimized, `data ${keywordToReinforce}`)) {
    optimized = appendKeywordContext(optimized, keywordToReinforce);
    keywordsAdded.push(keywordToReinforce);
  }

  if (optimized === bullet && keywordsAlreadyPresent.length > 0) {
    optimized = appendKeywordContext(optimized, keywordsAlreadyPresent[0]);
  }

  if (optimized === bullet) {
    return null;
  }

  return {
    id,
    section: targetPath.startsWith("experience") ? "experience" : "projects",
    targetPath,
    original: bullet,
    optimized,
    keywordsAdded,
    reason: `Updates wording in ${sectionLabel} while preserving the original claim and metrics.`,
    status: "pending"
  };
}

function createSkillChanges(
  doc: ResumeDocument,
  analysis: LocalAnalysis
): ProposedChange[] {
  const changes: ProposedChange[] = [];

  for (const [category, keywords] of Object.entries(analysis.keywords) as [
    KeywordCategory,
    string[]
  ][]) {
    const current = doc.skills[category] ?? [];
    const additions = keywords
      .filter((keyword) => !current.some((skill) => skill.toLowerCase() === keyword.toLowerCase()))
      .filter((keyword) => analysis.gapAnalysis.missingKeywords.includes(keyword))
      .slice(0, 5);

    if (additions.length === 0) {
      continue;
    }

    changes.push({
      id: `skills-${category}`,
      section: "skills",
      targetPath: `skills.${category}`,
      original: current.join(", "),
      optimized: [...current, ...additions].join(", "),
      keywordsAdded: additions,
      reason: "Adds missing job description keywords to the skills section for review before approval.",
      status: "pending"
    });
  }

  return changes.slice(0, 5);
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

function appendKeywordContext(text: string, keyword: string): string {
  return `${text.replace(/\.$/, "")}, with emphasis on ${keyword}.`;
}

function sanitizeSentence(value: string): string {
  return value
    .replace(/;/g, ",")
    .replace(/\s[-–—]\s/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function isProposedChange(value: unknown): value is ProposedChange {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ProposedChange>;
  return (
    typeof candidate.id === "string" &&
    ["summary", "experience", "projects", "skills"].includes(candidate.section ?? "") &&
    typeof candidate.targetPath === "string" &&
    typeof candidate.original === "string" &&
    typeof candidate.optimized === "string" &&
    Array.isArray(candidate.keywordsAdded) &&
    candidate.keywordsAdded.every((keyword) => typeof keyword === "string") &&
    typeof candidate.reason === "string" &&
    ["pending", "approved", "rejected", "manual"].includes(candidate.status ?? "")
  );
}
