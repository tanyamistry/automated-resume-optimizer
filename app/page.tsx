"use client";

import { useMemo, useState } from "react";
import { DiffView } from "@/components/DiffView";
import { KeywordAnalysis } from "@/components/KeywordAnalysis";
import { ResumeInput } from "@/components/ResumeInput";
import { ScoreCard } from "@/components/ScoreCard";
import { createLocalAnalysis } from "@/lib/atsScoring";
import { extractKeywords } from "@/lib/keywordExtractor";
import {
  applyApprovedEdits,
  createApprovedSectionsText
} from "@/lib/resumeAssembler";
import type { LocalAnalysis, OptimizationResult } from "@/lib/types";

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [approvedBulletIndexes, setApprovedBulletIndexes] = useState<number[]>([]);
  const [copyStatus, setCopyStatus] = useState("");

  const canOptimize = useMemo(
    () => resumeText.trim().length >= 80 && jobDescription.trim().length >= 80,
    [resumeText, jobDescription]
  );

  async function handleAnalyze() {
    setError(undefined);
    setOptimization(null);
    setApprovedBulletIndexes([]);
    setCopyStatus("");

    if (!canOptimize) {
      setError("Paste at least a few resume bullets and a meaningful job description first.");
      return;
    }

    setIsAnalyzing(true);
    const keywords = extractKeywords(jobDescription);
    const nextAnalysis = createLocalAnalysis(resumeText, jobDescription, keywords);
    setAnalysis(nextAnalysis);
    setIsAnalyzing(false);

    await requestOptimization(nextAnalysis);
  }

  async function requestOptimization(nextAnalysis: LocalAnalysis) {
    setIsOptimizing(true);
    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          analysis: nextAnalysis
        })
      });

      const payload = (await response.json()) as
        | { result: OptimizationResult }
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Optimization failed.");
      }

      setOptimization(payload.result);
      setApprovedBulletIndexes(payload.result.bulletEdits.map((_, index) => index));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to optimize right now."
      );
    } finally {
      setIsOptimizing(false);
    }
  }

  async function handleCopy() {
    if (!optimization) {
      return;
    }

    await navigator.clipboard.writeText(
      createApprovedSectionsText(optimization, approvedBulletIndexes)
    );
    setCopyStatus("Copied");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  async function handleResumeUpload(file: File) {
    setError(undefined);
    setIsExtracting(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch("/api/extract-resume", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || !payload.text) {
        throw new Error(payload.error ?? "Could not extract text from this PDF.");
      }

      setResumeText(payload.text);
      setAnalysis(null);
      setOptimization(null);
      setApprovedBulletIndexes([]);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not extract text from this PDF."
      );
    } finally {
      setIsExtracting(false);
    }
  }

  function handleToggleBullet(index: number) {
    setApprovedBulletIndexes((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((a, b) => a - b)
    );
  }

  function handleToggleAllBullets() {
    if (!optimization) {
      return;
    }

    setApprovedBulletIndexes((current) =>
      current.length === optimization.bulletEdits.length
        ? []
        : optimization.bulletEdits.map((_, index) => index)
    );
  }

  function handleDownload() {
    if (!optimization) {
      return;
    }

    const optimizedResume = applyApprovedEdits(
      resumeText,
      optimization,
      approvedBulletIndexes,
      true,
      true
    );
    const blob = new Blob([optimizedResume], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "optimized-resume.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Resume ATS Optimizer</h1>
        <p>
          Paste your Google Docs resume text and a target job description. The app
          can read a PDF resume, score keyword coverage locally, then create
          conservative suggestions that you approve before downloading.
        </p>
      </header>

      <ResumeInput
        error={error}
        isAnalyzing={isAnalyzing}
        isExtracting={isExtracting}
        isOptimizing={isOptimizing}
        jobDescription={jobDescription}
        resumeText={resumeText}
        onAnalyze={handleAnalyze}
        onJobDescriptionChange={setJobDescription}
        onResumeUpload={handleResumeUpload}
        onResumeChange={setResumeText}
      />

      {analysis ? (
        <div className="results-grid">
          <div className="summary-grid">
            <ScoreCard
              afterEstimate={optimization?.atsScoreAfterEstimate}
              score={analysis.score}
            />
            <KeywordAnalysis analysis={analysis} />
          </div>

          {optimization ? (
            <DiffView
              approvedBulletIndexes={approvedBulletIndexes}
              copyStatus={copyStatus}
              result={optimization}
              onCopy={handleCopy}
              onDownload={handleDownload}
              onToggleAllBullets={handleToggleAllBullets}
              onToggleBullet={handleToggleBullet}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
