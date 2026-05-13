import type { GapAnalysis, KeywordCategory, KeywordGroups } from "./types";

const CATEGORIES: Record<KeywordCategory, string[]> = {
  "Programming Languages": [
    "Python",
    "SQL",
    "Java",
    "Scala",
    "R",
    "JavaScript",
    "TypeScript",
    "Bash",
    "Go",
    "C++"
  ],
  "Data Engineering Tools": [
    "Apache Spark",
    "Spark",
    "Databricks",
    "Airflow",
    "dbt",
    "Kafka",
    "Flink",
    "Hadoop",
    "Hive",
    "Snowflake",
    "BigQuery",
    "Redshift",
    "ETL",
    "ELT",
    "Data Lake",
    "Data Warehouse",
    "Pandas",
    "PySpark"
  ],
  "Cloud / DevOps": [
    "AWS",
    "Azure",
    "GCP",
    "Google Cloud",
    "Docker",
    "Kubernetes",
    "Terraform",
    "CI/CD",
    "Git",
    "Linux",
    "Lambda",
    "S3",
    "CloudFormation"
  ],
  Databases: [
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "DynamoDB",
    "Redis",
    "Oracle",
    "SQL Server",
    "NoSQL",
    "Cassandra",
    "Elasticsearch"
  ],
  "Data Concepts": [
    "Data Modeling",
    "Data Pipelines",
    "Data Quality",
    "Data Governance",
    "Data Visualization",
    "Analytics",
    "Machine Learning",
    "Batch Processing",
    "Streaming",
    "Orchestration",
    "Distributed Systems",
    "Dimensional Modeling",
    "A/B Testing",
    "Reporting"
  ],
  "Soft Skills / Collaboration": [
    "Stakeholder",
    "Cross-functional",
    "Collaboration",
    "Communication",
    "Leadership",
    "Mentoring",
    "Agile",
    "Scrum",
    "Documentation",
    "Problem Solving"
  ],
  "Domain Keywords": [
    "Finance",
    "Healthcare",
    "E-commerce",
    "SaaS",
    "Marketing",
    "Product",
    "Customer",
    "Security",
    "Compliance",
    "Privacy",
    "Payments",
    "Supply Chain",
    "Sales",
    "Risk",
    "Fraud"
  ]
};

const LOW_VALUE_SKILLS = [
  "Microsoft Office",
  "MS Office",
  "Windows",
  "Email",
  "Internet",
  "Typing",
  "Hardworking",
  "Detail-oriented",
  "Team player"
];

const REQUIRED_HINTS = /\b(required|must have|minimum|need|needs|required qualifications|you have|you will bring)\b/i;

export function createEmptyKeywordGroups(): KeywordGroups {
  return Object.keys(CATEGORIES).reduce((groups, category) => {
    groups[category as KeywordCategory] = [];
    return groups;
  }, {} as KeywordGroups);
}

export function extractKeywords(jobDescription: string): KeywordGroups {
  const groups = createEmptyKeywordGroups();

  for (const [category, terms] of Object.entries(CATEGORIES) as [
    KeywordCategory,
    string[]
  ][]) {
    groups[category] = terms.filter((term) => containsTerm(jobDescription, term));
  }

  const knownTerms = new Set(Object.values(CATEGORIES).flat().map(normalizeTerm));
  const inferredTerms = inferDomainTerms(jobDescription).filter(
    (term) => !knownTerms.has(normalizeTerm(term))
  );

  groups["Domain Keywords"] = uniqueTerms([
    ...groups["Domain Keywords"],
    ...inferredTerms
  ]).slice(0, 18);

  return groups;
}

export function analyzeKeywordGaps(
  resumeText: string,
  jobDescription: string,
  keywords: KeywordGroups
): GapAnalysis {
  const allKeywords = uniqueTerms(Object.values(keywords).flat());
  const matchedKeywords = allKeywords.filter((term) => containsTerm(resumeText, term));
  const missingKeywords = allKeywords.filter((term) => !containsTerm(resumeText, term));
  const weakKeywords = allKeywords.filter((term) => {
    const jdCount = countTerm(jobDescription, term);
    const resumeCount = countTerm(resumeText, term);
    return jdCount >= 2 && resumeCount === 1;
  });
  const lowValueSkills = LOW_VALUE_SKILLS.filter((term) =>
    containsTerm(resumeText, term)
  );

  return {
    matchedKeywords,
    missingKeywords,
    weakKeywords,
    lowValueSkills
  };
}

export function getRequiredKeywords(
  jobDescription: string,
  keywords: KeywordGroups
): string[] {
  const lines = jobDescription
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const requiredText = lines
    .filter((line) => REQUIRED_HINTS.test(line))
    .join(" ");
  const source = requiredText.length > 40 ? requiredText : jobDescription;

  return uniqueTerms(Object.values(keywords).flat()).filter((term) =>
    containsTerm(source, term)
  );
}

export function flattenKeywords(groups: KeywordGroups): string[] {
  return uniqueTerms(Object.values(groups).flat());
}

export function containsTerm(text: string, term: string): boolean {
  return buildTermRegex(term).test(text);
}

function countTerm(text: string, term: string): number {
  return [...text.matchAll(buildTermRegex(term))].length;
}

function buildTermRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexible = escaped.replace(/\\ /g, "\\s+");
  return new RegExp(`(^|[^a-zA-Z0-9+#])${flexible}([^a-zA-Z0-9+#]|$)`, "gi");
}

function inferDomainTerms(jobDescription: string): string[] {
  const cleaned = jobDescription
    .replace(/[^a-zA-Z0-9+#/.\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  const stopWords = new Set([
    "the",
    "and",
    "with",
    "for",
    "you",
    "our",
    "are",
    "will",
    "from",
    "that",
    "this",
    "have",
    "has",
    "job",
    "role",
    "team",
    "work",
    "data",
    "experience",
    "years",
    "skills",
    "ability",
    "including",
    "using"
  ]);

  const counts = new Map<string, number>();
  for (const word of cleaned) {
    const normalized = word.toLowerCase();
    const isAcronym = /^[A-Z]{2,6}$/.test(word);
    const isSpecific = /^[A-Z][a-zA-Z+#/.]{2,}$/.test(word) || isAcronym;

    if (!isSpecific || stopWords.has(normalized)) {
      continue;
    }

    const label = isAcronym ? word : word.replace(/,$/, "");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term)
    .slice(0, 10);
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const term of terms) {
    const normalized = normalizeTerm(term);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(term);
    }
  }

  return unique;
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}
