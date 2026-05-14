import type {
  ProposedChange,
  ResumeDocument,
  ResumeEducation,
  ResumeExperience,
  ResumeProject
} from "./types";

type CommandCall = {
  args: string[];
  start: number;
  end: number;
};

export function parseLatexResume(latex: string): ResumeDocument {
  return {
    contact: parseContact(latex),
    summary: parseSummary(latex),
    experience: parseExperience(latex),
    projects: parseProjects(latex),
    education: parseEducation(latex),
    skills: parseSkills(latex)
  };
}

export function resumeDocumentToLatex(
  doc: ResumeDocument,
  originalTemplate?: string
): string {
  const preamble = getPreamble(originalTemplate);
  const closing = originalTemplate?.includes("\\end{document}") ? "\n\\end{document}\n" : "";
  const sections = [
    renderSummary(doc.summary),
    renderExperience(doc.experience),
    renderProjects(doc.projects),
    renderEducation(doc.education),
    renderSkills(doc.skills)
  ].filter(Boolean);

  if (preamble) {
    return `${preamble.trimEnd()}\n\n${sections.join("\n\n")}${closing}`;
  }

  return [
    "\\documentclass[letterpaper,11pt]{article}",
    "\\begin{document}",
    ...sections,
    "\\end{document}"
  ].join("\n\n");
}

export function applyProposedChange(
  doc: ResumeDocument,
  change: ProposedChange
): ResumeDocument {
  const next = cloneResumeDocument(doc);

  if (change.status === "rejected") {
    return next;
  }

  if (change.targetPath === "summary") {
    next.summary = change.optimized;
    return next;
  }

  if (change.targetPath.startsWith("experience.")) {
    const match = change.targetPath.match(/^experience\.(\d+)\.bullets\.(\d+)$/);
    if (match) {
      const [, itemIndex, bulletIndex] = match;
      const item = next.experience[Number(itemIndex)];
      if (item) {
        item.bullets[Number(bulletIndex)] = change.optimized;
      }
    }
    return next;
  }

  if (change.targetPath.startsWith("projects.")) {
    const match = change.targetPath.match(/^projects\.(\d+)\.bullets\.(\d+)$/);
    if (match) {
      const [, itemIndex, bulletIndex] = match;
      const item = next.projects[Number(itemIndex)];
      if (item) {
        item.bullets[Number(bulletIndex)] = change.optimized;
      }
    }
    return next;
  }

  if (change.targetPath.startsWith("skills.")) {
    const category = change.targetPath.replace(/^skills\./, "");
    next.skills[category] = splitSkills(change.optimized);
  }

  return next;
}

export function applyActiveChanges(
  doc: ResumeDocument,
  changes: ProposedChange[]
): ResumeDocument {
  return changes.reduce((current, change) => {
    if (change.status === "rejected") {
      return current;
    }

    return applyProposedChange(current, change);
  }, cloneResumeDocument(doc));
}

export function resumeDocumentToPlainText(doc: ResumeDocument): string {
  const lines = [
    doc.contact.name,
    doc.summary,
    "Experience",
    ...doc.experience.flatMap((item) => [
      `${item.company} ${item.title} ${item.location} ${item.dates}`,
      ...item.bullets
    ]),
    "Projects",
    ...doc.projects.flatMap((item) => [
      `${item.name} ${item.techStack ?? ""} ${item.dates ?? ""}`,
      ...item.bullets
    ]),
    "Education",
    ...doc.education.map(
      (item) => `${item.institution} ${item.degree} ${item.location} ${item.dates}`
    ),
    "Skills",
    ...Object.entries(doc.skills).map(([category, skills]) => `${category}: ${skills.join(", ")}`)
  ];

  return lines.filter(Boolean).join("\n");
}

function parseContact(latex: string): Record<string, string> {
  const beforeFirstSection = latex.split(/\\section\{/)[0] ?? "";
  const text = stripLatex(beforeFirstSection).replace(/\s+/g, " ").trim();
  const email = beforeFirstSection.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = beforeFirstSection.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] ?? "";
  const name =
    beforeFirstSection.match(/\\textbf\{\\Huge\s+([^{}]+)\}/)?.[1] ??
    beforeFirstSection.match(/\\textbf\{([^{}]+)\}/)?.[1] ??
    text.split(/\s{2,}|\|/)[0] ??
    "";

  return {
    name: stripLatex(name),
    email,
    phone,
    raw: beforeFirstSection.trim()
  };
}

function parseSummary(latex: string): string {
  const section = getSection(latex, ["Summary", "Professional Summary"]);
  if (!section) {
    return "";
  }

  const items = extractCommandCalls(section, "resumeItem").map((item) =>
    stripLatex(item.args[0] ?? "")
  );
  if (items.length > 0) {
    return items.join(" ");
  }

  return stripLatex(
    section
      .replace(/\\begin\{itemize\}[\s\S]*?\\end\{itemize\}/g, "")
      .replace(/\\small\{?|\\item\{?/g, "")
  );
}

function parseExperience(latex: string): ResumeExperience[] {
  const section = getSection(latex, ["Experience", "Work Experience", "Professional Experience"]);
  if (!section) {
    return [];
  }

  const headings = extractCommandCalls(section, "resumeSubheading");
  return headings.map((heading, index) => {
    const nextHeading = headings[index + 1]?.start ?? section.length;
    const block = section.slice(heading.end, nextHeading);
    const [company, dates, title, location] = normalizeSubheadingArgs(heading.args);

    return {
      company,
      title,
      location,
      dates,
      bullets: extractBullets(block)
    };
  });
}

function parseProjects(latex: string): ResumeProject[] {
  const section = getSection(latex, ["Projects", "Technical Projects"]);
  if (!section) {
    return [];
  }

  const headings = extractCommandCalls(section, "resumeProjectHeading");
  return headings.map((heading, index) => {
    const nextHeading = headings[index + 1]?.start ?? section.length;
    const block = section.slice(heading.end, nextHeading);
    const headingText = stripLatex(heading.args[0] ?? "");
    const [name, techStack] = headingText.split("|").map((part) => part.trim());

    return {
      name: name || "Project",
      techStack,
      dates: stripLatex(heading.args[1] ?? ""),
      bullets: extractBullets(block)
    };
  });
}

function parseEducation(latex: string): ResumeEducation[] {
  const section = getSection(latex, ["Education"]);
  if (!section) {
    return [];
  }

  return extractCommandCalls(section, "resumeSubheading").map((heading) => {
    const [institution, dates, degree, location] = normalizeSubheadingArgs(heading.args);
    return {
      institution,
      degree,
      location,
      dates
    };
  });
}

function parseSkills(latex: string): Record<string, string[]> {
  const section = getSection(latex, ["Technical Skills", "Skills"]);
  const skills: Record<string, string[]> = {};

  if (!section) {
    return skills;
  }

  for (const line of section.split(/\r?\n/)) {
    const text = line.trim();
    const textbfMatch = text.match(/\\textbf\{([^{}]+)\}\s*\{?:?\s*([^{}\\]+)\}?/);
    const plainMatch = stripLatex(text).match(/^([^:]{2,40}):\s*(.+)$/);
    const category = textbfMatch?.[1] ?? plainMatch?.[1];
    const value = textbfMatch?.[2] ?? plainMatch?.[2];

    if (category && value) {
      skills[stripLatex(category)] = splitSkills(stripLatex(value));
    }
  }

  return skills;
}

function getSection(latex: string, names: string[]): string {
  const sectionPattern = /\\section\{([^{}]+)\}/g;
  const sections = [...latex.matchAll(sectionPattern)];

  for (let index = 0; index < sections.length; index += 1) {
    const name = sections[index][1].trim();
    if (!names.some((candidate) => candidate.toLowerCase() === name.toLowerCase())) {
      continue;
    }

    const start = (sections[index].index ?? 0) + sections[index][0].length;
    const end = sections[index + 1]?.index ?? latex.indexOf("\\end{document}");
    return latex.slice(start, end === -1 ? latex.length : end).trim();
  }

  return "";
}

function extractCommandCalls(source: string, commandName: string): CommandCall[] {
  const calls: CommandCall[] = [];
  const command = `\\${commandName}`;
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(command, cursor);
    if (start === -1) {
      break;
    }

    let position = start + command.length;
    const args: string[] = [];

    while (source[position] && /\s/.test(source[position])) {
      position += 1;
    }

    while (source[position] === "{") {
      const parsed = readBraceGroup(source, position);
      if (!parsed) {
        break;
      }
      args.push(parsed.value);
      position = parsed.end;

      while (source[position] && /\s/.test(source[position])) {
        position += 1;
      }
    }

    calls.push({ args, start, end: position });
    cursor = position;
  }

  return calls;
}

function readBraceGroup(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== "{") {
    return null;
  }

  let depth = 0;
  let value = "";

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

    if (char === "{" && previous !== "\\") {
      depth += 1;
      if (depth > 1) {
        value += char;
      }
      continue;
    }

    if (char === "}" && previous !== "\\") {
      depth -= 1;
      if (depth === 0) {
        return { value, end: index + 1 };
      }
      value += char;
      continue;
    }

    value += char;
  }

  return null;
}

function normalizeSubheadingArgs(args: string[]): [string, string, string, string] {
  const clean = args.map((arg) => stripLatex(arg));
  const [first = "", second = "", third = "", fourth = ""] = clean;

  if (looksLikeDate(second)) {
    if (looksLikeRole(first) && !looksLikeRole(third)) {
      return [third, second, first, fourth];
    }
    return [first, second, third, fourth];
  }

  if (looksLikeDate(fourth)) {
    return [first, fourth, third, second];
  }

  return [first, second, third, fourth];
}

function extractBullets(block: string): string[] {
  return extractCommandCalls(block, "resumeItem")
    .map((item) => stripLatex(item.args[0] ?? ""))
    .filter(Boolean);
}

function renderSummary(summary: string): string {
  if (!summary.trim()) {
    return "";
  }

  return ["\\section{Summary}", `\\small{${escapeLatex(summary)}}`].join("\n");
}

function renderExperience(experience: ResumeExperience[]): string {
  if (experience.length === 0) {
    return "";
  }

  return [
    "\\section{Experience}",
    "\\resumeSubHeadingListStart",
    ...experience.map((item) =>
      [
        `  \\resumeSubheading{${escapeLatex(item.company)}}{${escapeLatex(item.dates)}}{${escapeLatex(item.title)}}{${escapeLatex(item.location)}}`,
        "  \\resumeItemListStart",
        ...item.bullets.map((bullet) => `    \\resumeItem{${escapeLatex(bullet)}}`),
        "  \\resumeItemListEnd"
      ].join("\n")
    ),
    "\\resumeSubHeadingListEnd"
  ].join("\n");
}

function renderProjects(projects: ResumeProject[]): string {
  if (projects.length === 0) {
    return "";
  }

  return [
    "\\section{Projects}",
    "\\resumeSubHeadingListStart",
    ...projects.map((item) => {
      const title = item.techStack
        ? `\\textbf{${escapeLatex(item.name)}} $|$ \\emph{${escapeLatex(item.techStack)}}`
        : `\\textbf{${escapeLatex(item.name)}}`;
      return [
        `  \\resumeProjectHeading{${title}}{${escapeLatex(item.dates ?? "")}}`,
        "  \\resumeItemListStart",
        ...item.bullets.map((bullet) => `    \\resumeItem{${escapeLatex(bullet)}}`),
        "  \\resumeItemListEnd"
      ].join("\n");
    }),
    "\\resumeSubHeadingListEnd"
  ].join("\n");
}

function renderEducation(education: ResumeEducation[]): string {
  if (education.length === 0) {
    return "";
  }

  return [
    "\\section{Education}",
    "\\resumeSubHeadingListStart",
    ...education.map(
      (item) =>
        `  \\resumeSubheading{${escapeLatex(item.institution)}}{${escapeLatex(item.dates)}}{${escapeLatex(item.degree)}}{${escapeLatex(item.location)}}`
    ),
    "\\resumeSubHeadingListEnd"
  ].join("\n");
}

function renderSkills(skills: Record<string, string[]>): string {
  const entries = Object.entries(skills).filter(([, values]) => values.length > 0);
  if (entries.length === 0) {
    return "";
  }

  return [
    "\\section{Technical Skills}",
    "\\begin{itemize}[leftmargin=0.15in, label={}]",
    "  \\small{\\item{",
    ...entries.map(
      ([category, values], index) =>
        `    \\textbf{${escapeLatex(category)}}{: ${escapeLatex(values.join(", "))}}${index === entries.length - 1 ? "" : " \\\\"}`
    ),
    "  }}",
    "\\end{itemize}"
  ].join("\n");
}

function getPreamble(originalTemplate?: string): string {
  if (!originalTemplate) {
    return "";
  }

  const firstSectionIndex = originalTemplate.search(/\\section\{/);
  if (firstSectionIndex === -1) {
    const documentIndex = originalTemplate.indexOf("\\begin{document}");
    return documentIndex === -1
      ? originalTemplate
      : originalTemplate.slice(0, documentIndex + "\\begin{document}".length);
  }

  return originalTemplate.slice(0, firstSectionIndex);
}

function stripLatex(value: string): string {
  return value
    .replace(/\\href\{([^{}]+)\}\{([^{}]+)\}/g, "$2")
    .replace(/\\(?:textbf|emph|small|Huge|large|normalsize)\{([^{}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\$|\|/g, " | ")
    .replace(/\\\\/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeLatex(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}

function splitSkills(value: string): string[] {
  return value
    .replace(/\\\\/g, "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function looksLikeDate(value: string): boolean {
  return /\b(19|20)\d{2}\b|present|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(
    value
  );
}

function looksLikeRole(value: string): boolean {
  return /\b(engineer|developer|analyst|scientist|intern|manager|assistant|lead|consultant|architect|designer)\b/i.test(
    value
  );
}

function cloneResumeDocument(doc: ResumeDocument): ResumeDocument {
  return {
    contact: { ...doc.contact },
    summary: doc.summary,
    experience: doc.experience.map((item) => ({ ...item, bullets: [...item.bullets] })),
    projects: doc.projects.map((item) => ({ ...item, bullets: [...item.bullets] })),
    education: doc.education.map((item) => ({
      ...item,
      details: item.details ? [...item.details] : undefined
    })),
    skills: Object.fromEntries(
      Object.entries(doc.skills).map(([category, values]) => [category, [...values]])
    )
  };
}

export function getDefaultLatexResume(): string {
  return `\\documentclass[letterpaper,11pt]{article}
\\begin{document}

\\begin{center}
    \\textbf{\\Huge Jane Candidate} \\\\
    jane@email.com $|$ (555) 123-4567 $|$ linkedin.com/in/jane
\\end{center}

\\section{Summary}
Data engineer with experience building analytics workflows, collaborating with stakeholders, and improving reporting processes.

\\section{Experience}
\\resumeSubHeadingListStart
  \\resumeSubheading{Acme Analytics}{Jan 2023 -- Present}{Data Engineer}{New York, NY}
  \\resumeItemListStart
    \\resumeItem{Built data pipelines that improved reporting reliability for customer analytics teams.}
    \\resumeItem{Worked with product and operations stakeholders to define data quality checks.}
  \\resumeItemListEnd
\\resumeSubHeadingListEnd

\\section{Projects}
\\resumeSubHeadingListStart
  \\resumeProjectHeading{\\textbf{Pipeline Monitor} $|$ \\emph{Python, SQL}}{2024}
  \\resumeItemListStart
    \\resumeItem{Created dashboard queries to track failed jobs and identify recurring workflow issues.}
  \\resumeItemListEnd
\\resumeSubHeadingListEnd

\\section{Education}
\\resumeSubHeadingListStart
  \\resumeSubheading{State University}{May 2022}{B.S. Computer Science}{Boston, MA}
\\resumeSubHeadingListEnd

\\section{Technical Skills}
\\begin{itemize}[leftmargin=0.15in, label={}]
  \\small{\\item{
    \\textbf{Programming Languages}{: Python, SQL} \\\\
    \\textbf{Data Engineering Tools}{: Airflow} \\\\
    \\textbf{Cloud / DevOps}{: Git} \\\\
    \\textbf{Databases}{: PostgreSQL}
  }}
\\end{itemize}

\\end{document}
`;
}
