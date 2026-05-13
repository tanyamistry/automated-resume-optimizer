import type { BulletEdit, OptimizationResult } from "@/lib/types";

type DiffViewProps = {
  result: OptimizationResult;
  onCopy: () => void;
  copyStatus: string;
};

export function DiffView({ result, onCopy, copyStatus }: DiffViewProps) {
  return (
    <section className="panel">
      <div className="optimization-header">
        <div>
          <h2>Optimization suggestions</h2>
          <p className="helper-text">Review before applying anything to your resume.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onCopy}>
          {copyStatus || "Copy Optimized Resume Sections"}
        </button>
      </div>

      <div className="summary-box">
        <h3>Updated professional summary</h3>
        <p>{result.summaryRewrite}</p>
      </div>

      <div className="diff-list">
        {result.bulletEdits.map((edit, index) => (
          <DiffItem edit={edit} key={`${edit.section}-${index}`} />
        ))}
      </div>

      <div className="skills-grid">
        <SkillList title="Add" items={result.skillsEdits.add} tone="success" />
        <SkillList title="Keep" items={result.skillsEdits.keep} tone="success" />
        <SkillList title="Review or remove" items={result.skillsEdits.remove} tone="warning" />
      </div>

      {result.warnings.length > 0 ? (
        <div className="summary-box">
          <h3>Warnings</h3>
          <ul className="warning-list">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function DiffItem({ edit }: { edit: BulletEdit }) {
  return (
    <article className="diff-item">
      <div className="diff-meta">
        <strong>{edit.section || "Resume bullet"}</strong>
        <div className="inline-list">
          {edit.keywordsAdded.map((keyword) => (
            <span className="tag success" key={keyword}>
              {keyword}
            </span>
          ))}
        </div>
      </div>
      <div className="diff-columns">
        <div className="diff-column">
          <h3>Original</h3>
          <p>{edit.original}</p>
        </div>
        <div className="diff-column">
          <h3>Optimized</h3>
          <p>{highlightKeywords(edit.optimized, edit.keywordsAdded)}</p>
          <p className="helper-text">{edit.reason}</p>
        </div>
      </div>
    </article>
  );
}

function SkillList({
  title,
  items,
  tone
}: {
  title: string;
  items: string[];
  tone: "success" | "warning";
}) {
  return (
    <div className="analysis-block">
      <h3>{title}</h3>
      <div className="inline-list">
        {items.length > 0 ? (
          items.map((item) => (
            <span className={`tag ${tone}`} key={item}>
              {item}
            </span>
          ))
        ) : (
          <p className="helper-text">No suggestions.</p>
        )}
      </div>
    </div>
  );
}

function highlightKeywords(text: string, keywords: string[]) {
  if (keywords.length === 0) {
    return text;
  }

  const escaped = keywords
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (escaped.length === 0) {
    return text;
  }

  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(regex).map((part, index) => {
    const isMatch = keywords.some(
      (keyword) => keyword.toLowerCase() === part.toLowerCase()
    );
    return isMatch ? (
      <mark className="highlight" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    );
  });
}
