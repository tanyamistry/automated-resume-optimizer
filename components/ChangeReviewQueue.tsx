import type { ProposedChange } from "@/lib/types";

type ChangeReviewQueueProps = {
  changes: ProposedChange[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onManualEdit: (id: string, value: string) => void;
};

export function ChangeReviewQueue({
  changes,
  onApprove,
  onReject,
  onManualEdit
}: ChangeReviewQueueProps) {
  if (changes.length === 0) {
    return (
      <section className="empty-review-state">
        <h2>Change Review</h2>
        <p className="helper-text">No review cards yet. Generate changes after uploading a resume and job description.</p>
      </section>
    );
  }

  return (
    <section className="change-queue">
      {changes.map((change) => (
        <article className={`change-card ${change.status}`} key={change.id}>
          <div className="change-card-header">
            <div>
              <strong>{labelForChange(change)}</strong>
              <p className="helper-text">{change.targetPath}</p>
            </div>
            <span className={`status-pill ${change.status}`}>{change.status}</span>
          </div>

          <div className="change-copy-grid">
            <div>
              <h3>Original</h3>
              <p>{change.original || "No existing content"}</p>
            </div>
            <div>
              <h3>Optimized</h3>
              <textarea
                aria-label={`Manual edit for ${change.targetPath}`}
                value={change.optimized}
                onChange={(event) => onManualEdit(change.id, event.target.value)}
              />
            </div>
          </div>

          <div className="inline-list">
            {change.keywordsAdded.map((keyword) => (
              <span className="tag success" key={keyword}>
                {keyword}
              </span>
            ))}
          </div>

          <p className="helper-text">{change.reason}</p>

          <div className="button-row">
            <button
              className="secondary-button"
              type="button"
              onClick={() => onReject(change.id)}
            >
              Reject
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onManualEdit(change.id, change.optimized)}
            >
              Edit Manually
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => onApprove(change.id)}
            >
              Approve
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function labelForChange(change: ProposedChange): string {
  if (change.section === "summary") {
    return "Summary";
  }

  if (change.section === "skills") {
    return "Skills";
  }

  return change.section === "experience" ? "Experience bullet" : "Project bullet";
}
