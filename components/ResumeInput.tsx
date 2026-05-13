"use client";

type ResumeInputProps = {
  resumeText: string;
  jobDescription: string;
  isAnalyzing: boolean;
  isOptimizing: boolean;
  error?: string;
  onResumeChange: (value: string) => void;
  onJobDescriptionChange: (value: string) => void;
  onAnalyze: () => void;
};

export function ResumeInput({
  resumeText,
  jobDescription,
  isAnalyzing,
  isOptimizing,
  error,
  onResumeChange,
  onJobDescriptionChange,
  onAnalyze
}: ResumeInputProps) {
  return (
    <section className="panel">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="resumeText">Resume text</label>
          <textarea
            id="resumeText"
            placeholder="Paste your resume text from Google Docs..."
            value={resumeText}
            onChange={(event) => onResumeChange(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="jobDescription">Job description</label>
          <textarea
            id="jobDescription"
            placeholder="Paste the target job description..."
            value={jobDescription}
            onChange={(event) => onJobDescriptionChange(event.target.value)}
          />
        </div>
      </div>

      <div className="actions">
        <p className={error ? "error-text" : "helper-text"}>
          {error ??
            "Your resume and job description are only sent to the server when you request AI optimization."}
        </p>
        <button
          className="primary-button"
          disabled={isAnalyzing || isOptimizing}
          type="button"
          onClick={onAnalyze}
        >
          {isOptimizing ? "Optimizing..." : isAnalyzing ? "Analyzing..." : "Analyze Resume"}
        </button>
      </div>
    </section>
  );
}
