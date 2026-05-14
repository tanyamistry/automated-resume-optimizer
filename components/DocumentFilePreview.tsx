"use client";

import { useEffect, useRef, useState } from "react";

type DocumentFilePreviewProps = {
  docxBuffer: ArrayBuffer | null;
  fileName: string;
  fileType: "docx" | "pdf" | "";
  isUpdating?: boolean;
  layout?: "continuous" | "pages";
  pdfUrl?: string;
};

export function DocumentFilePreview({
  docxBuffer,
  fileName,
  fileType,
  isUpdating = false,
  layout = "continuous",
  pdfUrl
}: DocumentFilePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | undefined>();
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || fileType !== "docx") {
      return;
    }

    container.innerHTML = "";

    if (!docxBuffer) {
      return;
    }

    const buffer = docxBuffer.slice(0);
    const targetContainer = container;
    let isCancelled = false;
    setRenderError(undefined);
    setIsRendering(true);

    async function renderDocx() {
      try {
        const { renderAsync } = await import("docx-preview");
        await renderAsync(buffer, targetContainer, undefined, {
          breakPages: layout === "pages",
          className: "docx-rendered",
          experimental: true,
          ignoreFonts: false,
          ignoreHeight: layout === "continuous",
          ignoreLastRenderedPageBreak: true,
          ignoreWidth: false,
          inWrapper: true,
          renderComments: false,
          renderEndnotes: true,
          renderFooters: true,
          renderFootnotes: true,
          renderHeaders: true,
          trimXmlDeclaration: true,
          useBase64URL: true
        });
      } catch {
        if (!isCancelled) {
          setRenderError("Could not render this DOCX preview. The original file is still preserved.");
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    }

    renderDocx();

    return () => {
      isCancelled = true;
      container.innerHTML = "";
    };
  }, [docxBuffer, fileType, layout]);

  if (!fileName) {
    return (
      <section className="file-preview-empty">
        <h2>Upload a resume to begin</h2>
        <p className="helper-text">
          DOCX files render here with their original layout, spacing, bullets, and typography.
        </p>
      </section>
    );
  }

  if (fileType === "pdf") {
    return (
      <section className="pdf-preview-shell">
        {pdfUrl ? (
          <iframe className="pdf-preview-frame" src={pdfUrl} title={`${fileName} preview`} />
        ) : (
          <section className="file-preview-empty">
            <h2>PDF preview unavailable</h2>
            <p className="helper-text">Upload the PDF again to regenerate the visual preview.</p>
          </section>
        )}
        <p className="preview-note">
          PDF preview is visual only in this MVP. Upload DOCX to apply and export wording changes.
        </p>
      </section>
    );
  }

  return (
    <section className={`docx-preview-shell ${layout === "continuous" ? "continuous-preview" : "paged-preview"}`}>
      {(isRendering || isUpdating) && (
        <div className="preview-status" role="status">
          {isUpdating ? "Applying edits to DOCX preview..." : "Rendering DOCX preview..."}
        </div>
      )}
      {renderError ? <p className="error-text">{renderError}</p> : null}
      <div className="docx-preview-container" ref={containerRef} />
    </section>
  );
}
