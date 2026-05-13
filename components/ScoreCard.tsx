import type { AtsScore } from "@/lib/types";

const LABELS: Record<keyof AtsScore["breakdown"], string> = {
  keywordCoverage: "Keyword coverage",
  requiredSkillsCoverage: "Required skills",
  resumeStructure: "Resume structure",
  metricsActionVerbs: "Metrics and verbs",
  formattingReadability: "Readability"
};

type ScoreCardProps = {
  score: AtsScore;
  afterEstimate?: number;
};

export function ScoreCard({ score, afterEstimate }: ScoreCardProps) {
  return (
    <section className="panel score-card">
      <div>
        <h2>ATS match score</h2>
        <p className="helper-text">Rule-based estimate</p>
      </div>
      <div className="score-value">{score.total}</div>
      {typeof afterEstimate === "number" ? (
        <p className="helper-text">
          After optimization estimate: <strong>{afterEstimate}</strong>
        </p>
      ) : null}
      <div className="score-bars">
        {Object.entries(score.breakdown).map(([key, value]) => (
          <div className="score-row" key={key}>
            <span>
              {LABELS[key as keyof AtsScore["breakdown"]]}: {value}
            </span>
            <div className="bar-track" aria-hidden="true">
              <div className="bar-fill" style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
