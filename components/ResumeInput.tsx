"use client";

type ResumeInputProps = {
  resumeText: string;
  jobDescription: string;
  isAnalyzing: boolean;
  isOptimizing: boolean;
  isExtracting: boolean;
  error?: string;
  onResumeChange: (value: string) => void;
  onJobDescriptionChange: (value: string) => void;
  onResumeUpload: (file: File) => void;
  onAnalyze: () => void;
};

export function ResumeInput({
  resumeText,
  jobDescription,
  isAnalyzing,
  isOptimizing,
  isExtracting,
  error,
  onResumeChange,
  onJobDescriptionChange,
  onResumeUpload,
  onAnalyze
}: ResumeInputProps) {
  return (
    <section className="panel">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="resumeText">Resume text</label>
          <input
            accept="application/pdf,.pdf"
            aria-label="Upload resume PDF"
            className="file-input"
            disabled={isExtracting || isAnalyzing || isOptimizing}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onResumeUpload(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <textarea
            id="resumeText"
            placeholder="Upload a resume PDF or paste your resume text from Google Docs..."
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
            "Upload a text-based PDF or paste from Google Docs. Review and approve edits before downloading."}
        </p>
        <button
          className="primary-button"
          disabled={isExtracting || isAnalyzing || isOptimizing}
          type="button"
          onClick={onAnalyze}
        >
          {isExtracting
            ? "Reading PDF..."
            : isOptimizing
              ? "Optimizing..."
              : isAnalyzing
                ? "Analyzing..."
                : "Analyze Resume"}
        </button>
      </div>
    </section>
  );
}
