import type { ProposedChange, ResumeDocument } from "./types";

export function applyProposedChange(
  doc: ResumeDocument,
  change: ProposedChange
): ResumeDocument {
  if (change.status === "rejected") {
    return cloneResumeDocument(doc);
  }

  const next = cloneResumeDocument(doc);

  if (change.targetPath === "summary") {
    next.summary = change.optimized;
    return next;
  }

  const experienceMatch = change.targetPath.match(/^experience\.(\d+)\.bullets\.(\d+)$/);
  if (experienceMatch) {
    const [, itemIndex, bulletIndex] = experienceMatch;
    const item = next.experience[Number(itemIndex)];
    if (item) {
      item.bullets[Number(bulletIndex)] = change.optimized;
    }
    return next;
  }

  const projectMatch = change.targetPath.match(/^projects\.(\d+)\.bullets\.(\d+)$/);
  if (projectMatch) {
    const [, itemIndex, bulletIndex] = projectMatch;
    const item = next.projects[Number(itemIndex)];
    if (item) {
      item.bullets[Number(bulletIndex)] = change.optimized;
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
  return [
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
    ...Object.entries(doc.skills).map(([category, skills]) => `${category}: ${skills.join(", ")}`),
    "Unassigned Lines",
    ...doc.unassignedLines
  ]
    .filter(Boolean)
    .join("\n");
}

export function cloneResumeDocument(doc: ResumeDocument): ResumeDocument {
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
    ),
    unassignedLines: [...doc.unassignedLines],
    parserDebug: { ...doc.parserDebug }
  };
}

function splitSkills(value: string): string[] {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}
