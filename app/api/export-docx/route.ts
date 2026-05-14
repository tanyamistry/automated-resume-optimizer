import { NextResponse } from "next/server";
import { patchDocxWithChanges } from "@/lib/docxPatcher";
import type { ProposedChange, ResumeDocument } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const validation = validateExportRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(validation.value.originalFileBase64, "base64");
    const updated = await patchDocxWithChanges(
      buffer,
      validation.value.changes,
      validation.value.finalDocument
    );

    return new NextResponse(new Uint8Array(updated), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="optimized-resume.docx"'
      }
    });
  } catch {
    return NextResponse.json({ error: "Could not export updated DOCX." }, { status: 500 });
  }
}

type ExportRequest = {
  originalFileBase64: string;
  changes: ProposedChange[];
  finalDocument: ResumeDocument;
};

type ValidationResult =
  | { ok: true; value: ExportRequest }
  | { ok: false; error: string };

function validateExportRequest(body: unknown): ValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be an object." };
  }

  if (typeof body.originalFileBase64 !== "string" || body.originalFileBase64.length < 100) {
    return { ok: false, error: "Original DOCX file data is missing." };
  }

  if (!Array.isArray(body.changes)) {
    return { ok: false, error: "Changes payload is invalid." };
  }

  if (!isRecord(body.finalDocument)) {
    return { ok: false, error: "Final resume document is invalid." };
  }

  return {
    ok: true,
    value: {
      originalFileBase64: body.originalFileBase64,
      changes: body.changes as ProposedChange[],
      finalDocument: body.finalDocument as ResumeDocument
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
