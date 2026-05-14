"use client";

import { useMemo, useState } from "react";
import { ChangeReviewQueue } from "@/components/ChangeReviewQueue";
import { KeywordAnalysis } from "@/components/KeywordAnalysis";
import { LatexResumePreview } from "@/components/LatexResumePreview";
import { ScoreCard } from "@/components/ScoreCard";
import { createLocalAnalysis } from "@/lib/atsScoring";
import { extractKeywords } from "@/lib/keywordExtractor";
import {
  applyActiveChanges,
  getDefaultLatexResume,
  parseLatexResume,
  resumeDocumentToLatex,
  resumeDocumentToPlainText
} from "@/lib/latexResume";
import {
  generateStructuredChanges,
  validateProposedChanges
} from "@/lib/structuredOptimizer";
import type { LocalAnalysis, ProposedChange, ResumeDocument } from "@/lib/types";

type Tab = "preview" | "source" | "changes";

export default function Home() {
  const [latexSource, setLatexSource] = useState(getDefaultLatexResume());
  const [jobDescription, setJobDescription] = useState("");
  const [baseDoc, setBaseDoc] = useState<ResumeDocument>(() =>
    parseLatexResume(getDefaultLatexResume())
  );
  const [changes, setChanges] = useState<ProposedChange[]>([]);
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [error, setError] = useState<string | undefined>();
  const [copyStatus, setCopyStatus] = useState("");

  const currentDoc = useMemo(() => applyActiveChanges(baseDoc, changes), [baseDoc, changes]);
  const changedPaths = useMemo(
    () =>
      changes
        .filter((change) => change.status !== "rejected")
        .map((change) => change.targetPath),
    [changes]
  );
  const finalLatex = useMemo(
    () => resumeDocumentToLatex(currentDoc, latexSource),
    [currentDoc, latexSource]
  );

  function handleGenerate() {
    setError(undefined);
    setCopyStatus("");

    if (latexSource.trim().length < 80) {
      setError("Paste a LaTeX resume source before generating changes.");
      return;
    }

    if (jobDescription.trim().length < 80) {
      setError("Paste a meaningful job description before generating changes.");
      return;
    }

    try {
      const parsedDoc = parseLatexResume(latexSource);
      const plainText = resumeDocumentToPlainText(parsedDoc);
      const keywords = extractKeywords(jobDescription);
      const nextAnalysis = createLocalAnalysis(plainText, jobDescription, keywords);
      const rawProposedChanges = generateStructuredChanges(parsedDoc, nextAnalysis);
      const proposedChanges = validateProposedChanges(rawProposedChanges);
      if (!proposedChanges) {
        throw new Error("Invalid structured optimization response.");
      }

      setBaseDoc(parsedDoc);
      setAnalysis(nextAnalysis);
      setChanges(proposedChanges);
      setActiveTab("preview");

      if (proposedChanges.length === 0) {
        setError("Parsed the resume, but no safe structured changes were found.");
      }
    } catch {
      setError("Could not parse this LaTeX source. Check that it uses the supported resume commands.");
    }
  }

  function updateChangeStatus(id: string, status: ProposedChange["status"]) {
    setChanges((current) =>
      current.map((change) => (change.id === id ? { ...change, status } : change))
    );
  }

  function handleManualEdit(id: string, value: string) {
    setChanges((current) =>
      current.map((change) =>
        change.id === id ? { ...change, optimized: value, status: "manual" } : change
      )
    );
  }

  async function handleCopyLatex() {
    await navigator.clipboard.writeText(finalLatex);
    setCopyStatus("Copied");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  return (
    <main className="app-shell latex-app-shell">
      <header className="app-header">
        <h1>LaTeX Resume Optimizer</h1>
        <p>
          Paste your LaTeX resume source and a job description. The app parses the
          resume into structured sections, applies optimized wording directly into
          the preview, and lets you approve, reject, or manually edit each change.
        </p>
      </header>

      <section className="workspace-grid">
        <aside className="panel source-panel">
          <div>
            <h2>Inputs</h2>
            <p className="helper-text">
              Supports the common resume template commands for this MVP.
            </p>
          </div>

          <label className="field" htmlFor="latexSource">
            <span>LaTeX resume source</span>
            <textarea
              id="latexSource"
              className="code-textarea"
              value={latexSource}
              onChange={(event) => setLatexSource(event.target.value)}
            />
          </label>

          <label className="field" htmlFor="jobDescription">
            <span>Job description</span>
            <textarea
              id="jobDescription"
              placeholder="Paste the target job description..."
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-button" type="button" onClick={handleGenerate}>
            Generate Optimized Resume
          </button>
        </aside>

        <section className="panel preview-workspace">
          <div className="tab-bar" role="tablist" aria-label="Resume workspace tabs">
            <button
              className={activeTab === "preview" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("preview")}
            >
              Preview
            </button>
            <button
              className={activeTab === "source" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("source")}
            >
              LaTeX Source
            </button>
            <button
              className={activeTab === "changes" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("changes")}
            >
              Change Review
            </button>
          </div>

          {activeTab === "preview" ? (
            <LatexResumePreview doc={currentDoc} changedPaths={changedPaths} />
          ) : null}

          {activeTab === "source" ? (
            <section className="latex-source-panel">
              <div className="optimization-header">
                <div>
                  <h2>Final LaTeX</h2>
                  <p className="helper-text">
                    This source reflects pending, approved, and manual changes. Rejected
                    changes are excluded.
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={handleCopyLatex}>
                  {copyStatus || "Copy Final LaTeX"}
                </button>
              </div>
              <pre>{finalLatex}</pre>
            </section>
          ) : null}

          {activeTab === "changes" ? (
            <ChangeReviewQueue
              changes={changes}
              onApprove={(id) => updateChangeStatus(id, "approved")}
              onManualEdit={handleManualEdit}
              onReject={(id) => updateChangeStatus(id, "rejected")}
            />
          ) : null}
        </section>
      </section>

      {analysis ? (
        <section className="results-grid">
          <div className="summary-grid">
            <ScoreCard score={analysis.score} />
            <KeywordAnalysis analysis={analysis} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
