"use client";

import { useMemo, useState } from "react";
import { DiffView } from "@/components/DiffView";
import { KeywordAnalysis } from "@/components/KeywordAnalysis";
import { ResumeInput } from "@/components/ResumeInput";
import { ScoreCard } from "@/components/ScoreCard";
import { createLocalAnalysis } from "@/lib/atsScoring";
import { extractKeywords } from "@/lib/keywordExtractor";
import type { LocalAnalysis, OptimizationResult } from "@/lib/types";

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const canOptimize = useMemo(
    () => resumeText.trim().length >= 80 && jobDescription.trim().length >= 80,
    [resumeText, jobDescription]
  );

  async function handleAnalyze() {
    setError(undefined);
    setOptimization(null);
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

    const text = [
      "Professional Summary",
      optimization.summaryRewrite,
      "",
      "Suggested Bullet Edits",
      ...optimization.bulletEdits.flatMap((edit) => [
        `[${edit.section}]`,
        edit.optimized,
        ""
      ]),
      "Skills To Add",
      optimization.skillsEdits.add.join(", ") || "None",
      "",
      "Skills To Keep",
      optimization.skillsEdits.keep.join(", ") || "None",
      "",
      "Skills To Review",
      optimization.skillsEdits.remove.join(", ") || "None"
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopyStatus("Copied");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Resume ATS Optimizer</h1>
        <p>
          Paste your Google Docs resume text and a target job description. The app
          scores keyword coverage locally, then creates conservative rule-based
          suggestions that preserve your real experience.
        </p>
      </header>

      <ResumeInput
        error={error}
        isAnalyzing={isAnalyzing}
        isOptimizing={isOptimizing}
        jobDescription={jobDescription}
        resumeText={resumeText}
        onAnalyze={handleAnalyze}
        onJobDescriptionChange={setJobDescription}
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
              copyStatus={copyStatus}
              result={optimization}
              onCopy={handleCopy}
            />
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
