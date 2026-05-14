import type { ResumeDocument, ResumeEducation, ResumeExperience, ResumeProject } from "./types";

const SECTION_ALIASES = {
  summary: ["summary", "professional summary", "profile"],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "employment experience"
  ],
  projects: ["projects", "technical projects", "project experience", "personal projects"],
  education: ["education", "educational background"],
  skills: ["skills", "technical skills", "technologies", "core skills"]
} as const;

const BULLET_STARTERS = [
  "achieved",
  "analyzed",
  "architected",
  "automated",
  "built",
  "collaborated",
  "created",
  "decreased",
  "delivered",
  "deployed",
  "designed",
  "developed",
  "drove",
  "enabled",
  "engineered",
  "implemented",
  "improved",
  "increased",
  "integrated",
  "led",
  "managed",
  "migrated",
  "modeled",
  "optimized",
  "owned",
  "partnered",
  "reduced",
  "streamlined",
  "supported"
];

type SectionName = keyof typeof SECTION_ALIASES;

type ParsedSections = Record<SectionName, string[]>;

export function parseRawResumeText(rawText: string): ResumeDocument {
  const lines = toContentLines(rawText);
  const bulletsDetected = lines.filter((line) => isBullet(line) || looksLikeImplicitBullet(line))
    .length;
  const sectionEvents = lines
    .map((line, index) => ({ index, section: detectSection(line) }))
    .filter((event): event is { index: number; section: SectionName } =>
      Boolean(event.section)
    );
  const firstSectionIndex = sectionEvents[0]?.index ?? -1;
  const sections = createEmptySections();
  const assignedLineIndexes = new Set<number>();
  const sectionHeaderIndexes = new Set(sectionEvents.map((event) => event.index));
  let currentSection: SectionName | null = null;

  lines.forEach((line, index) => {
    const detectedSection = detectSection(line);
    if (detectedSection) {
      currentSection = detectedSection;
      return;
    }

    if (currentSection) {
      sections[currentSection].push(line);
      assignedLineIndexes.add(index);
    }
  });

  const contactLineIndexes = getContactLineIndexes(lines, firstSectionIndex);
  contactLineIndexes.forEach((index) => assignedLineIndexes.add(index));

  const unassignedLines = lines.filter((line, index) => {
    if (sectionHeaderIndexes.has(index)) {
      return false;
    }

    return !assignedLineIndexes.has(index);
  });

  return {
    contact: parseContact(contactLineIndexes.map((index) => lines[index])),
    summary: parseSummary(sections.summary),
    experience: parseExperienceSection(sections.experience),
    projects: parseProjectSection(sections.projects),
    education: parseEducation(sections.education),
    skills: parseSkills(sections.skills),
    unassignedLines,
    parserDebug: {
      totalLinesExtracted: lines.length,
      bulletsDetected,
      sectionsDetected: sectionEvents.length,
      droppedLinesCount: 0
    }
  };
}

export const parseResumeText = parseRawResumeText;

function toContentLines(rawText: string): string[] {
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, " ").replace(/[ \u00a0]+/g, " ").trim())
    .filter(Boolean);
}

function createEmptySections(): ParsedSections {
  return {
    summary: [],
    experience: [],
    projects: [],
    education: [],
    skills: []
  };
}

function detectSection(line: string): SectionName | null {
  const normalized = normalizeHeader(line);

  for (const [section, aliases] of Object.entries(SECTION_ALIASES) as [
    SectionName,
    readonly string[]
  ][]) {
    if (aliases.includes(normalized)) {
      return section;
    }
  }

  return null;
}

function normalizeHeader(line: string): string {
  return line
    .replace(/^[-*•●]\s*/, "")
    .replace(/[:|]/g, "")
    .trim()
    .toLowerCase();
}

function getContactLineIndexes(lines: string[], firstSectionIndex: number): number[] {
  const end = firstSectionIndex === -1 ? Math.min(lines.length, 4) : firstSectionIndex;
  return Array.from({ length: Math.max(0, end) }, (_, index) => index);
}

function parseContact(lines: string[]): Record<string, string> {
  const joined = lines.join(" ");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = joined.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] ?? "";

  return {
    name: lines[0] ?? "",
    email,
    phone,
    raw: joined
  };
}

function parseSummary(lines: string[]): string {
  return lines.map(stripBullet).join(" ").trim();
}

function parseExperienceSection(lines: string[]): ResumeExperience[] {
  const groups = groupResumeEntries(lines);

  return groups.map((group, index) => {
    const dates = inferDates(group.heading);
    const location = inferLocation(group.heading);
    const headingWithoutMeta = group.heading.filter(
      (line) => line !== dates && line !== location
    );

    return {
      company: headingWithoutMeta[0] ?? `Experience ${index + 1}`,
      title: headingWithoutMeta.slice(1).join(" | "),
      location,
      dates,
      bullets: group.bullets
    };
  });
}

function parseProjectSection(lines: string[]): ResumeProject[] {
  const groups = groupResumeEntries(lines);

  return groups.map((group, index) => {
    const dates = inferDates(group.heading);
    const headingWithoutDate = group.heading.filter((line) => line !== dates);
    const heading = headingWithoutDate.join(" | ");
    const [name, techStack] = heading.split("|").map((part) => part.trim());

    return {
      name: name || `Project ${index + 1}`,
      techStack,
      dates,
      bullets: group.bullets
    };
  });
}

function parseEducation(lines: string[]): ResumeEducation[] {
  if (lines.length === 0) {
    return [];
  }

  const dates = inferDates(lines);
  const location = inferLocation(lines);
  const details = lines.filter((line, index) => index > 1 && line !== dates && line !== location);

  return [
    {
      institution: lines[0] ?? "",
      degree: lines[1] ?? "",
      location,
      dates,
      details
    }
  ];
}

function parseSkills(lines: string[]): Record<string, string[]> {
  const skills: Record<string, string[]> = {};
  let activeCategory = "Skills";

  for (const line of lines) {
    const clean = stripBullet(line);
    const match = clean.match(/^([^:]{2,50}):\s*(.+)$/);

    if (match) {
      activeCategory = match[1].trim();
      skills[activeCategory] = uniqueValues([
        ...(skills[activeCategory] ?? []),
        ...splitSkills(match[2])
      ]);
      continue;
    }

    if (!clean.includes(",") && clean.length <= 42 && /^[A-Za-z /&+#.-]+$/.test(clean)) {
      activeCategory = clean;
      skills[activeCategory] = skills[activeCategory] ?? [];
      continue;
    }

    skills[activeCategory] = uniqueValues([
      ...(skills[activeCategory] ?? []),
      ...splitSkills(clean)
    ]);
  }

  return Object.fromEntries(
    Object.entries(skills).filter(([, values]) => values.length > 0)
  );
}

function groupResumeEntries(lines: string[]): Array<{ heading: string[]; bullets: string[] }> {
  const groups: Array<{ heading: string[]; bullets: string[] }> = [];
  let heading: string[] = [];
  let bullets: string[] = [];

  for (const line of lines) {
    if (isBullet(line)) {
      bullets.push(stripBullet(line));
      continue;
    }

    if (heading.length > 0 && looksLikeImplicitBullet(line)) {
      bullets.push(stripBullet(line));
      continue;
    }

    if (bullets.length > 0 && looksLikeContinuation(line)) {
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`;
      continue;
    }

    if (bullets.length > 0) {
      groups.push({ heading: [...heading], bullets: [...bullets] });
      heading = [line];
      bullets = [];
      continue;
    }

    heading.push(line);
  }

  if (heading.length > 0 || bullets.length > 0) {
    groups.push({ heading, bullets });
  }

  return groups.filter((group) => group.heading.length > 0 || group.bullets.length > 0);
}

function isBullet(line: string): boolean {
  return /^[•●\-*]\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[•●\-*]\s+/, "").trim();
}

function looksLikeContinuation(line: string): boolean {
  return /^[a-z,)]/.test(line) || line.length > 120;
}

function looksLikeImplicitBullet(line: string): boolean {
  if (line.length < 35) {
    return false;
  }

  const firstWord = line.match(/^[A-Za-z]+/)?.[0].toLowerCase();
  return Boolean(firstWord && BULLET_STARTERS.includes(firstWord));
}

function splitSkills(value: string): string[] {
  return value
    .split(/,|•|●|\|/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(value);
    }
  }

  return unique;
}

function inferDates(lines: string[]): string {
  return (
    lines.find((line) =>
      /\b(19|20)\d{2}\b|present|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(line)
    ) ?? ""
  );
}

function inferLocation(lines: string[]): string {
  return lines.find((line) => /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(line)) ?? "";
}
