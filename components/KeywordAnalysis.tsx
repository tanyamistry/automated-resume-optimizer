import type { LocalAnalysis } from "@/lib/types";

type KeywordAnalysisProps = {
  analysis: LocalAnalysis;
};

export function KeywordAnalysis({ analysis }: KeywordAnalysisProps) {
  const { keywords, gapAnalysis } = analysis;

  return (
    <section className="panel keyword-section">
      <div>
        <h2>Keyword analysis</h2>
        <p className="helper-text">Extracted from the job description and compared with your resume.</p>
      </div>

      <div className="keyword-groups">
        {Object.entries(keywords).map(([category, terms]) => (
          <div className="keyword-group" key={category}>
            <h3>{category}</h3>
            <div className="keyword-list">
              {terms.length > 0 ? (
                terms.map((term) => (
                  <span className="tag" key={term}>
                    {term}
                  </span>
                ))
              ) : (
                <p className="helper-text">No strong matches found.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="analysis-columns">
        <KeywordBlock
          title="Matched"
          emptyText="No matched keywords yet."
          terms={gapAnalysis.matchedKeywords}
          tone="success"
        />
        <KeywordBlock
          title="Missing"
          emptyText="No missing keywords detected."
          terms={gapAnalysis.missingKeywords}
          tone="danger"
        />
        <KeywordBlock
          title="Weak"
          emptyText="No weakly represented keywords detected."
          terms={gapAnalysis.weakKeywords}
          tone="warning"
        />
      </div>

      {gapAnalysis.lowValueSkills.length > 0 ? (
        <div className="analysis-block">
          <h3>Low-value skills to review</h3>
          <div className="inline-list">
            {gapAnalysis.lowValueSkills.map((term) => (
              <span className="tag warning" key={term}>
                {term}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function KeywordBlock({
  title,
  terms,
  emptyText,
  tone
}: {
  title: string;
  terms: string[];
  emptyText: string;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="analysis-block">
      <h3>{title}</h3>
      <div className="inline-list">
        {terms.length > 0 ? (
          terms.map((term) => (
            <span className={`tag ${tone}`} key={term}>
              {term}
            </span>
          ))
        ) : (
          <p className="helper-text">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
