import type { ResumeDocument, ResumeEducation, ResumeExperience, ResumeProject } from "./types";

const SECTION_ALIASES = {
  summary: ["summary", "professional summary", "profile"],
  experience: ["experience", "work experience", "professional experience", "employment"],
  projects: ["projects", "technical projects", "project experience"],
  education: ["education"],
  skills: ["skills", "technical skills", "technologies"]
} as const;

type SectionName = keyof typeof SECTION_ALIASES;

export function parseResumeText(text: string): ResumeDocument {
  const lines = normalizeLines(text);
  const sections = splitIntoSections(lines);

  return {
    contact: parseContact(lines),
    summary: parseSummary(sections.summary),
    experience: parseExperienceLikeSection(sections.experience),
    projects: parseProjectSection(sections.projects),
    education: parseEducation(sections.education),
    skills: parseSkills(sections.skills)
  };
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\t/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitIntoSections(lines: string[]): Record<SectionName, string[]> {
  const sections: Record<SectionName, string[]> = {
    summary: [],
    experience: [],
    projects: [],
    education: [],
    skills: []
  };
  let current: SectionName | null = null;

  for (const line of lines) {
    const section = detectSection(line);
    if (section) {
      current = section;
      continue;
    }

    if (current) {
      sections[current].push(line);
    }
  }

  return sections;
}

function detectSection(line: string): SectionName | null {
  const normalized = line.toLowerCase().replace(/[:|]/g, "").trim();

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

function parseContact(lines: string[]): Record<string, string> {
  const firstSectionIndex = lines.findIndex((line) => Boolean(detectSection(line)));
  const contactLines = lines.slice(0, firstSectionIndex === -1 ? 4 : firstSectionIndex);
  const joined = contactLines.join(" ");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = joined.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] ?? "";

  return {
    name: contactLines[0] ?? "",
    email,
    phone,
    raw: joined
  };
}

function parseSummary(lines: string[]): string {
  return lines.filter((line) => !isBullet(line)).join(" ").trim();
}

function parseExperienceLikeSection(lines: string[]): ResumeExperience[] {
  const groups = groupByBulletClusters(lines);

  return groups.map((group, index) => {
    const heading = group.heading;
    return {
      company: heading[0] ?? `Experience ${index + 1}`,
      title: heading[1] ?? "",
      location: inferLocation(heading),
      dates: inferDates(heading),
      bullets: group.bullets
    };
  });
}

function parseProjectSection(lines: string[]): ResumeProject[] {
  const groups = groupByBulletClusters(lines);

  return groups.map((group, index) => {
    const heading = group.heading.join(" | ");
    const [name, techStack] = heading.split("|").map((part) => part.trim());

    return {
      name: name || `Project ${index + 1}`,
      techStack,
      dates: inferDates(group.heading),
      bullets: group.bullets
    };
  });
}

function parseEducation(lines: string[]): ResumeEducation[] {
  if (lines.length === 0) {
    return [];
  }

  return [
    {
      institution: lines[0] ?? "",
      degree: lines[1] ?? "",
      location: inferLocation(lines),
      dates: inferDates(lines),
      details: lines.slice(2)
    }
  ];
}

function parseSkills(lines: string[]): Record<string, string[]> {
  const skills: Record<string, string[]> = {};

  for (const line of lines) {
    const match = line.match(/^([^:]{2,50}):\s*(.+)$/);
    if (match) {
      skills[match[1].trim()] = splitSkills(match[2]);
      continue;
    }

    if (line.includes(",")) {
      skills["Skills"] = [...(skills.Skills ?? []), ...splitSkills(line)];
    }
  }

  return skills;
}

function groupByBulletClusters(lines: string[]): Array<{ heading: string[]; bullets: string[] }> {
  const groups: Array<{ heading: string[]; bullets: string[] }> = [];
  let heading: string[] = [];
  let bullets: string[] = [];

  for (const line of lines) {
    if (isBullet(line)) {
      bullets.push(stripBullet(line));
      continue;
    }

    if (bullets.length > 0) {
      groups.push({ heading, bullets });
      heading = [line];
      bullets = [];
      continue;
    }

    heading.push(line);
  }

  if (heading.length > 0 || bullets.length > 0) {
    groups.push({ heading, bullets });
  }

  return groups.filter((group) => group.bullets.length > 0 || group.heading.length > 0);
}

function isBullet(line: string): boolean {
  return /^[-*•◦▪●]\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[-*•◦▪●]\s+/, "").trim();
}

function splitSkills(value: string): string[] {
  return value
    .split(/,|•|\|/)
    .map((skill) => skill.trim())
    .filter(Boolean);
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
