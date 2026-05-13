import type { BulletEdit, OptimizationResult } from "./types";

export function applyApprovedEdits(
  resumeText: string,
  optimization: OptimizationResult,
  approvedBulletIndexes: number[],
  includeSummary: boolean,
  includeSkills: boolean
): string {
  const approved = new Set(approvedBulletIndexes);
  let output = resumeText;

  optimization.bulletEdits.forEach((edit, index) => {
    if (!approved.has(index)) {
      return;
    }

    output = replaceFirst(output, edit.original, edit.optimized);
  });

  const sections: string[] = [];
  if (includeSummary && optimization.summaryRewrite.trim()) {
    sections.push(["Optimized Professional Summary", optimization.summaryRewrite].join("\n"));
  }

  if (includeSkills) {
    sections.push(
      [
        "Skills Suggestions",
        `Add if accurate: ${optimization.skillsEdits.add.join(", ") || "None"}`,
        `Keep: ${optimization.skillsEdits.keep.join(", ") || "None"}`,
        `Review or remove: ${optimization.skillsEdits.remove.join(", ") || "None"}`
      ].join("\n")
    );
  }

  return sections.length > 0
    ? `${output.trim()}\n\n---\n${sections.join("\n\n")}\n`
    : `${output.trim()}\n`;
}

export function createApprovedSectionsText(
  optimization: OptimizationResult,
  approvedBulletIndexes: number[]
): string {
  const approved = new Set(approvedBulletIndexes);
  const approvedBullets = optimization.bulletEdits.filter((_, index) =>
    approved.has(index)
  );

  return [
    "Optimized Professional Summary",
    optimization.summaryRewrite,
    "",
    "Approved Bullet Edits",
    ...approvedBullets.flatMap((edit: BulletEdit) => [
      `[${edit.section}]`,
      edit.optimized,
      ""
    ]),
    "Skills Suggestions",
    `Add if accurate: ${optimization.skillsEdits.add.join(", ") || "None"}`,
    `Keep: ${optimization.skillsEdits.keep.join(", ") || "None"}`,
    `Review or remove: ${optimization.skillsEdits.remove.join(", ") || "None"}`
  ].join("\n");
}

function replaceFirst(source: string, target: string, replacement: string): string {
  const index = source.indexOf(target);
  if (index === -1) {
    return source;
  }

  return `${source.slice(0, index)}${replacement}${source.slice(index + target.length)}`;
}
