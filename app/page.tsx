"use client";

import { useMemo, useState } from "react";
import { ChangeReviewQueue } from "@/components/ChangeReviewQueue";
import { DocumentResumePreview } from "@/components/DocumentResumePreview";
import { KeywordAnalysis } from "@/components/KeywordAnalysis";
import { ScoreCard } from "@/components/ScoreCard";
import { createLocalAnalysis } from "@/lib/atsScoring";
import { extractKeywords } from "@/lib/keywordExtractor";
import { applyActiveChanges, resumeDocumentToPlainText } from "@/lib/resumeDocument";
import {
  generateStructuredChanges,
  validateProposedChanges
} from "@/lib/structuredOptimizer";
import type { LocalAnalysis, ProposedChange, ResumeDocument } from "@/lib/types";

type ParsedUpload = {
  document: ResumeDocument;
  fileName: string;
  fileType: "docx" | "pdf";
  rawText: string;
};

type Tab = "preview" | "changes" | "text";

export default function Home() {
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFileType, setUploadedFileType] = useState<"docx" | "pdf" | "">("");
  const [originalFileBase64, setOriginalFileBase64] = useState("");
  const [rawText, setRawText] = useState("");
  const [baseDoc, setBaseDoc] = useState<ResumeDocument | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [changes, setChanges] = useState<ProposedChange[]>([]);
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [error, setError] = useState<string | undefined>();
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const currentDoc = useMemo(
    () => (baseDoc ? applyActiveChanges(baseDoc, changes) : null),
    [baseDoc, changes]
  );
  const changedPaths = useMemo(
    () =>
      changes
        .filter((change) => change.status !== "rejected")
        .map((change) => change.targetPath),
    [changes]
  );
  const parserWarning =
    currentDoc && currentDoc.unassignedLines.length > 0
      ? "Some content could not be structured yet"
      : undefined;

  async function handleUpload(file: File) {
    setError(undefined);
    setIsParsing(true);
    setChanges([]);
    setAnalysis(null);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const [parsedResponse, base64] = await Promise.all([
        fetch("/api/parse-resume", {
          method: "POST",
          body: formData
        }),
        readFileAsBase64(file)
      ]);

      const payload = (await parsedResponse.json()) as ParsedUpload | { error: string };
      if (!parsedResponse.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Could not parse resume.");
      }

      setUploadedFileName(payload.fileName);
      setUploadedFileType(payload.fileType);
      setOriginalFileBase64(base64);
      setRawText(payload.rawText);
      setBaseDoc(payload.document);
      setActiveTab("preview");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Could not parse this resume."
      );
    } finally {
      setIsParsing(false);
    }
  }

  function handleGenerate() {
    setError(undefined);

    if (!baseDoc) {
      setError("Upload a DOCX or PDF resume first.");
      return;
    }

    if (jobDescription.trim().length < 80) {
      setError("Paste a meaningful job description before generating replacements.");
      return;
    }

    const resumeText = resumeDocumentToPlainText(baseDoc);
    const keywords = extractKeywords(jobDescription);
    const nextAnalysis = createLocalAnalysis(resumeText, jobDescription, keywords);
    const proposedChanges = validateProposedChanges(
      generateStructuredChanges(baseDoc, nextAnalysis)
    );

    if (!proposedChanges) {
      setError("Optimizer returned invalid structured changes. Try again.");
      return;
    }

    setAnalysis(nextAnalysis);
    setChanges(proposedChanges);
    setActiveTab("preview");

    if (proposedChanges.length === 0) {
      setError("No safe wording replacements were detected for this resume.");
    }
  }

  function updateChangeStatus(id: string, status: ProposedChange["status"]) {
    setChanges((current) =>
      current.map((change) => (change.id === id ? { ...change, status } : change))
    );
  }

  function handleAssignUnassignedLine(
    index: number,
    target: "summary" | "experience" | "projects" | "education" | "skills"
  ) {
    setBaseDoc((current) => {
      if (!current) {
        return current;
      }

      const line = current.unassignedLines[index];
      if (!line) {
        return current;
      }

      const next: ResumeDocument = {
        ...current,
        contact: { ...current.contact },
        experience: current.experience.map((item) => ({
          ...item,
          bullets: [...item.bullets]
        })),
        projects: current.projects.map((item) => ({
          ...item,
          bullets: [...item.bullets]
        })),
        education: current.education.map((item) => ({
          ...item,
          details: item.details ? [...item.details] : undefined
        })),
        skills: Object.fromEntries(
          Object.entries(current.skills).map(([category, values]) => [category, [...values]])
        ),
        unassignedLines: current.unassignedLines.filter((_, itemIndex) => itemIndex !== index),
        parserDebug: { ...current.parserDebug }
      };

      const cleanLine = line.replace(/^[•●\-*]\s+/, "").trim();

      if (target === "summary") {
        next.summary = [next.summary, cleanLine].filter(Boolean).join(" ");
      }

      if (target === "experience") {
        if (line.match(/^[•●\-*]\s+/)) {
          const item =
            next.experience[next.experience.length - 1] ??
            next.experience[
              next.experience.push({
                company: "Manually Assigned Experience",
                title: "",
                location: "",
                dates: "",
                bullets: []
              }) - 1
            ];
          item.bullets.push(cleanLine);
        } else {
          next.experience.push({
            company: cleanLine,
            title: "",
            location: "",
            dates: "",
            bullets: []
          });
        }
      }

      if (target === "projects") {
        if (line.match(/^[•●\-*]\s+/)) {
          const item =
            next.projects[next.projects.length - 1] ??
            next.projects[
              next.projects.push({
                name: "Manually Assigned Project",
                bullets: []
              }) - 1
            ];
          item.bullets.push(cleanLine);
        } else {
          next.projects.push({ name: cleanLine, bullets: [] });
        }
      }

      if (target === "education") {
        if (next.education.length === 0) {
          next.education.push({
            institution: cleanLine,
            degree: "",
            location: "",
            dates: "",
            details: []
          });
        } else {
          const item = next.education[next.education.length - 1];
          item.details = [...(item.details ?? []), cleanLine];
        }
      }

      if (target === "skills") {
        next.skills.Skills = [
          ...(next.skills.Skills ?? []),
          ...cleanLine.split(",").map((skill) => skill.trim()).filter(Boolean)
        ];
      }

      return next;
    });
  }

  function handleManualEdit(id: string, value: string) {
    setChanges((current) =>
      current.map((change) =>
        change.id === id ? { ...change, optimized: value, status: "manual" } : change
      )
    );
  }

  async function handleExportDocx() {
    if (!currentDoc) {
      return;
    }

    if (uploadedFileType !== "docx") {
      setError("DOCX export requires a DOCX upload. PDF support is parsing-only for now.");
      return;
    }

    setIsExporting(true);
    setError(undefined);

    try {
      const response = await fetch("/api/export-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          originalFileBase64,
          changes,
          finalDocument: currentDoc
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not export DOCX.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "optimized-resume.docx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "Could not export DOCX."
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="app-shell document-app-shell">
      <header className="app-header">
        <h1>DOCX Resume Optimizer</h1>
        <p>
          Upload a DOCX resume, parse its sections, generate targeted wording
          replacements, review the diffs, and export an updated DOCX while preserving
          the original document package as much as possible. PDF upload is supported
          for parsing and review only.
        </p>
      </header>

      <section className="workspace-grid">
        <aside className="panel source-panel">
          <div>
            <h2>Resume Upload</h2>
            <p className="helper-text">
              DOCX is editable/exportable. PDF is parse-only for this MVP.
            </p>
          </div>

          <label className="field" htmlFor="resumeFile">
            <span>Resume file</span>
            <input
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,.pdf"
              className="file-input"
              disabled={isParsing}
              id="resumeFile"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  handleUpload(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>

          {uploadedFileName ? (
            <div className="upload-summary">
              <strong>{uploadedFileName}</strong>
              <span>{uploadedFileType.toUpperCase()}</span>
            </div>
          ) : null}

          {currentDoc ? (
            <div className="debug-counters">
              <span>Total lines: {currentDoc.parserDebug.totalLinesExtracted}</span>
              <span>Bullets: {currentDoc.parserDebug.bulletsDetected}</span>
              <span>Sections: {currentDoc.parserDebug.sectionsDetected}</span>
              <span>Unassigned: {currentDoc.unassignedLines.length}</span>
              <span>Dropped: {currentDoc.parserDebug.droppedLinesCount}</span>
            </div>
          ) : null}

          {parserWarning ? <p className="warning-text">{parserWarning}</p> : null}

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

          <button
            className="primary-button"
            disabled={isParsing}
            type="button"
            onClick={handleGenerate}
          >
            {isParsing ? "Parsing Resume..." : "Generate Optimized Replacements"}
          </button>

          <button
            className="secondary-button"
            disabled={!currentDoc || isExporting}
            type="button"
            onClick={handleExportDocx}
          >
            {isExporting ? "Exporting..." : "Export Updated DOCX"}
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
              className={activeTab === "changes" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("changes")}
            >
              Change Review
            </button>
            <button
              className={activeTab === "text" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("text")}
            >
              Parsed Text
            </button>
          </div>

          {activeTab === "preview" ? (
            currentDoc ? (
              <DocumentResumePreview
                doc={currentDoc}
                changedPaths={changedPaths}
                onAssignUnassignedLine={handleAssignUnassignedLine}
              />
            ) : (
              <EmptyState />
            )
          ) : null}

          {activeTab === "changes" ? (
            <ChangeReviewQueue
              changes={changes}
              onApprove={(id) => updateChangeStatus(id, "approved")}
              onManualEdit={handleManualEdit}
              onReject={(id) => updateChangeStatus(id, "rejected")}
            />
          ) : null}

          {activeTab === "text" ? (
            <section className="parsed-text-panel">
              <h2>Parsed Resume Text</h2>
              <pre>{rawText || "Upload a resume to see extracted text."}</pre>
            </section>
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

function EmptyState() {
  return (
    <section className="empty-state">
      <h2>Upload a resume to begin</h2>
      <p className="helper-text">
        The parsed resume preview will appear here, then optimized wording will be
        inserted directly into the preview as reviewable changes.
      </p>
    </section>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Could not read uploaded file."));
    reader.readAsDataURL(file);
  });
}
