import type { OptimizationResult } from "@/lib/types";

type ResumePreviewProps = {
  previewText: string;
  optimization: OptimizationResult;
  approvedBulletIndexes: number[];
};

export function ResumePreview({
  previewText,
  optimization,
  approvedBulletIndexes
}: ResumePreviewProps) {
  const approvedLines = new Set(
    approvedBulletIndexes.map((index) => optimization.bulletEdits[index]?.optimized)
  );

  return (
    <section className="panel preview-panel">
      <div>
        <h2>Resume preview</h2>
        <p className="helper-text">
          This updates as you approve recommended lines. Highlighted lines are approved edits.
        </p>
      </div>

      <div className="resume-paper" aria-label="Optimized resume preview">
        {previewText.split(/\r?\n/).map((line, index) => {
          const trimmed = line.trim();
          const isApproved = approvedLines.has(trimmed);
          const isHeading =
            trimmed.length > 0 &&
            trimmed.length < 42 &&
            !/^[-*•]/.test(trimmed) &&
            (trimmed === trimmed.toUpperCase() || /:$/.test(trimmed));

          return (
            <div
              className={[
                "preview-line",
                isApproved ? "approved-line" : "",
                isHeading ? "preview-heading" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={`${line}-${index}`}
            >
              {line || "\u00a0"}
            </div>
          );
        })}
      </div>
    </section>
  );
}
