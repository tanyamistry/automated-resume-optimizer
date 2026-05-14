"use client";

import { useEffect, useMemo, useState } from "react";
import { ChangeReviewQueue } from "@/components/ChangeReviewQueue";
import { DocumentFilePreview } from "@/components/DocumentFilePreview";
import { createLocalAnalysis } from "@/lib/atsScoring";
import { extractKeywords } from "@/lib/keywordExtractor";
import { applyActiveChanges, resumeDocumentToPlainText } from "@/lib/resumeDocument";
import {
  generateStructuredChanges,
  validateProposedChanges
} from "@/lib/structuredOptimizer";
import type { KeywordGroups, LocalAnalysis, ProposedChange, ResumeDocument } from "@/lib/types";

type ParsedUpload = {
  document: ResumeDocument;
  fileName: string;
  fileType: "docx" | "pdf";
  rawText: string;
};

type Theme = "light" | "dark";
type PreviewLayout = "continuous" | "pages";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function Home() {
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFileType, setUploadedFileType] = useState<"docx" | "pdf" | "">("");
  const [originalFileBase64, setOriginalFileBase64] = useState("");
  const [sourceDocxBuffer, setSourceDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [previewDocxBuffer, setPreviewDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | undefined>();
  const [baseDoc, setBaseDoc] = useState<ResumeDocument | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [changes, setChanges] = useState<ProposedChange[]>([]);
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [isParsing, setIsParsing] = useState(false);
  const [isPreviewUpdating, setIsPreviewUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>("continuous");

  const currentDoc = useMemo(
    () => (baseDoc ? applyActiveChanges(baseDoc, changes) : null),
    [baseDoc, changes]
  );

  const pendingCount = changes.filter((change) => change.status === "pending").length;
  const approvedCount = changes.filter(
    (change) => change.status === "approved" || change.status === "manual"
  ).length;

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("resumeOptimizerTheme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = savedTheme === "dark" || (!savedTheme && systemPrefersDark) ? "dark" : "light";

    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    if (uploadedFileType !== "docx") {
      return;
    }

    if (!sourceDocxBuffer) {
      setPreviewDocxBuffer(null);
      return;
    }

    if (!currentDoc || !originalFileBase64 || changes.length === 0) {
      setPreviewDocxBuffer(sourceDocxBuffer.slice(0));
      return;
    }

    let isCancelled = false;
    const previewTimer = window.setTimeout(async () => {
      setIsPreviewUpdating(true);

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
          throw new Error(payload.error ?? "Could not update the DOCX preview.");
        }

        const blob = await response.blob();
        const nextBuffer = await blob.arrayBuffer();

        if (!isCancelled) {
          setPreviewDocxBuffer(nextBuffer);
        }
      } catch (previewError) {
        if (!isCancelled) {
          setError(
            previewError instanceof Error
              ? previewError.message
              : "Could not update the DOCX preview."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsPreviewUpdating(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(previewTimer);
    };
  }, [changes, currentDoc, originalFileBase64, sourceDocxBuffer, uploadedFileType]);

  function handleToggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("resumeOptimizerTheme", nextTheme);
      return nextTheme;
    });
  }

  async function handleUpload(file: File) {
    setError(undefined);
    setIsParsing(true);
    setChanges([]);
    setAnalysis(null);
    setBaseDoc(null);
    setUploadedFileName("");
    setUploadedFileType("");
    setSourceDocxBuffer(null);
    setPreviewDocxBuffer(null);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const [parsedResponse, base64, fileBuffer] = await Promise.all([
        fetch("/api/parse-resume", {
          method: "POST",
          body: formData
        }),
        readFileAsBase64(file),
        file.arrayBuffer()
      ]);

      const payload = (await parsedResponse.json()) as ParsedUpload | { error: string };
      if (!parsedResponse.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Could not parse resume.");
      }

      setUploadedFileName(payload.fileName);
      setUploadedFileType(payload.fileType);
      setOriginalFileBase64(base64);
      setBaseDoc(payload.document);

      if (payload.fileType === "docx") {
        setSourceDocxBuffer(fileBuffer.slice(0));
        setPreviewDocxBuffer(fileBuffer.slice(0));
        setPdfPreviewUrl(undefined);
      } else {
        setSourceDocxBuffer(null);
        setPreviewDocxBuffer(null);
        setPdfPreviewUrl(URL.createObjectURL(file));
      }
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

    if (proposedChanges.length === 0) {
      setError("No safe wording replacements were detected for this resume.");
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

  async function handleExportDocx() {
    if (uploadedFileType !== "docx") {
      setError("DOCX export requires a DOCX upload. PDF support is visual and parsing-only for now.");
      return;
    }

    const exportBuffer = previewDocxBuffer ?? sourceDocxBuffer;

    if (!exportBuffer) {
      setError("Upload a DOCX resume before exporting.");
      return;
    }

    setIsExporting(true);
    setError(undefined);

    try {
      let blob: Blob;

      if (changes.length > 0 && currentDoc && originalFileBase64) {
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

        blob = await response.blob();
      } else {
        blob = new Blob([exportBuffer], { type: DOCX_MIME });
      }

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
    <main className="app-shell review-app-shell">
      <header className="app-header review-header">
        <div>
          <p className="eyebrow">Resume review workspace</p>
          <h1>Optimize wording without rebuilding the resume.</h1>
        </div>
        <button className="theme-toggle" type="button" onClick={handleToggleTheme}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>

      <section className="review-layout">
        <aside className="sidebar left-sidebar">
          <section className="sidebar-section">
            <div>
              <h2>Resume</h2>
              <p className="helper-text">DOCX keeps layout editable. PDF is preview and parsing only.</p>
            </div>

            <label className="field" htmlFor="resumeFile">
              <span>Upload file</span>
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
          </section>

          <section className="sidebar-section">
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
              className="primary-button full-width-button"
              disabled={isParsing}
              type="button"
              onClick={handleGenerate}
            >
              {isParsing ? "Parsing Resume..." : "Generate Review Changes"}
            </button>

            <button
              className="secondary-button full-width-button"
              disabled={!uploadedFileName || isExporting || isPreviewUpdating}
              type="button"
              onClick={handleExportDocx}
            >
              {isExporting ? "Exporting..." : "Export Updated DOCX"}
            </button>
          </section>

          <SidebarAnalysis analysis={analysis} keywordGroups={analysis?.keywords} />
        </aside>

        <section className="resume-stage">
          <div className="stage-toolbar">
            <div>
              <p className="eyebrow">Live document preview</p>
              <h2>{uploadedFileName || "No file uploaded"}</h2>
            </div>
            {changes.length > 0 ? (
              <div className="review-counts" aria-label="Change counts">
                <span>{pendingCount} pending</span>
                <span>{approvedCount} approved</span>
              </div>
            ) : null}
            <div className="segmented-control" aria-label="Preview layout">
              <button
                className={previewLayout === "continuous" ? "active" : ""}
                type="button"
                onClick={() => setPreviewLayout("continuous")}
              >
                Continuous
              </button>
              <button
                className={previewLayout === "pages" ? "active" : ""}
                type="button"
                onClick={() => setPreviewLayout("pages")}
              >
                Pages
              </button>
            </div>
          </div>

          <DocumentFilePreview
            docxBuffer={previewDocxBuffer}
            fileName={uploadedFileName}
            fileType={uploadedFileType}
            isUpdating={isPreviewUpdating}
            layout={previewLayout}
            pdfUrl={pdfPreviewUrl}
          />
        </section>

        <aside className="sidebar right-sidebar">
          <div className="sidebar-section review-intro">
            <div>
              <h2>Review changes</h2>
              <p className="helper-text">
                Pending edits are shown in the DOCX preview until rejected. Manual edits update
                the preview after a short refresh.
              </p>
            </div>
          </div>

          <ChangeReviewQueue
            changes={changes}
            onApprove={(id) => updateChangeStatus(id, "approved")}
            onManualEdit={handleManualEdit}
            onReject={(id) => updateChangeStatus(id, "rejected")}
          />
        </aside>
      </section>
    </main>
  );
}

function SidebarAnalysis({
  analysis,
  keywordGroups
}: {
  analysis: LocalAnalysis | null;
  keywordGroups?: KeywordGroups;
}) {
  if (!analysis || !keywordGroups) {
    return (
      <section className="sidebar-section muted-section">
        <h2>ATS signals</h2>
        <p className="helper-text">
          Add a job description and generate changes to see lightweight keyword coverage.
        </p>
      </section>
    );
  }

  return (
    <section className="sidebar-section ats-sidebar">
      <div className="mini-score">
        <div>
          <h2>ATS signals</h2>
          <p className="helper-text">Rule-based estimate</p>
        </div>
        <strong>{analysis.score.total}</strong>
      </div>

      <KeywordPills title="Matched" terms={analysis.gapAnalysis.matchedKeywords} tone="success" />
      <KeywordPills title="Missing" terms={analysis.gapAnalysis.missingKeywords} tone="danger" />

      <div className="keyword-compact-list">
        {Object.entries(keywordGroups).map(([category, terms]) => (
          <details key={category}>
            <summary>
              {category}
              <span>{terms.length}</span>
            </summary>
            <div className="inline-list">
              {terms.length > 0 ? (
                terms.map((term) => (
                  <span className="tag" key={term}>
                    {term}
                  </span>
                ))
              ) : (
                <p className="helper-text">No strong matches.</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function KeywordPills({
  title,
  terms,
  tone
}: {
  title: string;
  terms: string[];
  tone: "success" | "danger";
}) {
  return (
    <div className="keyword-mini-block">
      <h3>{title}</h3>
      <div className="inline-list">
        {terms.slice(0, 8).map((term) => (
          <span className={`tag ${tone}`} key={term}>
            {term}
          </span>
        ))}
        {terms.length === 0 ? <p className="helper-text">None yet.</p> : null}
        {terms.length > 8 ? <span className="tag">+{terms.length - 8}</span> : null}
      </div>
    </div>
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
