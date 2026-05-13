import type { BulletEdit, OptimizationResult } from "@/lib/types";

type DiffViewProps = {
  result: OptimizationResult;
  approvedBulletIndexes: number[];
  onCopy: () => void;
  onDownload: () => void;
  onToggleBullet: (index: number) => void;
  onToggleAllBullets: () => void;
  copyStatus: string;
};

export function DiffView({
  result,
  approvedBulletIndexes,
  onCopy,
  onDownload,
  onToggleBullet,
  onToggleAllBullets,
  copyStatus
}: DiffViewProps) {
  const allApproved =
    result.bulletEdits.length > 0 &&
    approvedBulletIndexes.length === result.bulletEdits.length;

  return (
    <section className="panel">
      <div className="optimization-header">
        <div>
          <h2>Optimization suggestions</h2>
          <p className="helper-text">Approve the edits you want before downloading.</p>
        </div>
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={onToggleAllBullets}>
            {allApproved ? "Clear Bullet Approvals" : "Approve All Bullets"}
          </button>
          <button className="secondary-button" type="button" onClick={onCopy}>
            {copyStatus || "Copy Approved Sections"}
          </button>
          <button className="primary-button" type="button" onClick={onDownload}>
            Download Optimized Resume
          </button>
        </div>
      </div>

      <div className="summary-box">
        <h3>Updated professional summary</h3>
        <p>{result.summaryRewrite}</p>
      </div>

      <div className="diff-list">
        {result.bulletEdits.map((edit, index) => (
          <DiffItem
            approved={approvedBulletIndexes.includes(index)}
            edit={edit}
            index={index}
            key={`${edit.section}-${index}`}
            onToggle={onToggleBullet}
          />
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

function DiffItem({
  edit,
  index,
  approved,
  onToggle
}: {
  edit: BulletEdit;
  index: number;
  approved: boolean;
  onToggle: (index: number) => void;
}) {
  return (
    <article className="diff-item">
      <div className="diff-meta">
        <strong>{edit.section || "Resume bullet"}</strong>
        <div className="diff-controls">
          <label className="approval-toggle">
            <input
              checked={approved}
              type="checkbox"
              onChange={() => onToggle(index)}
            />
            Approve
          </label>
          <div className="inline-list">
            {edit.keywordsAdded.map((keyword) => (
              <span className="tag success" key={keyword}>
                {keyword}
              </span>
            ))}
          </div>
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
