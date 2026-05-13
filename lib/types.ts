export type KeywordCategory =
  | "Programming Languages"
  | "Data Engineering Tools"
  | "Cloud / DevOps"
  | "Databases"
  | "Data Concepts"
  | "Soft Skills / Collaboration"
  | "Domain Keywords";

export type KeywordGroups = Record<KeywordCategory, string[]>;

export type GapAnalysis = {
  matchedKeywords: string[];
  missingKeywords: string[];
  weakKeywords: string[];
  lowValueSkills: string[];
};

export type ScoreBreakdown = {
  keywordCoverage: number;
  requiredSkillsCoverage: number;
  resumeStructure: number;
  metricsActionVerbs: number;
  formattingReadability: number;
};

export type AtsScore = {
  total: number;
  breakdown: ScoreBreakdown;
};

export type LocalAnalysis = {
  keywords: KeywordGroups;
  gapAnalysis: GapAnalysis;
  score: AtsScore;
};

export type BulletEdit = {
  section: string;
  original: string;
  optimized: string;
  keywordsAdded: string[];
  reason: string;
};

export type SkillsEdits = {
  add: string[];
  remove: string[];
  keep: string[];
};

export type OptimizationResult = {
  atsScoreBefore: number;
  atsScoreAfterEstimate: number;
  summaryRewrite: string;
  bulletEdits: BulletEdit[];
  skillsEdits: SkillsEdits;
  warnings: string[];
};

export type OptimizeRequest = {
  resumeText: string;
  jobDescription: string;
  analysis: LocalAnalysis;
};
