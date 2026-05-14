import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { parseResumeText } from "@/lib/resumeTextParser";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const file = formData.get("resume");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a DOCX or PDF resume first." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Resume file must be 6MB or smaller." }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (lowerName.endsWith(".docx")) {
      const parsed = await mammoth.extractRawText({ buffer });
      const text = normalizeExtractedText(parsed.value);
      return parsedResponse(text, "docx", file.name);
    }

    if (lowerName.endsWith(".pdf")) {
      let parser: PDFParse | undefined;
      try {
        parser = new PDFParse({ data: new Uint8Array(buffer) });
        const parsed = await parser.getText();
        const text = normalizeExtractedText(parsed.text);
        return parsedResponse(text, "pdf", file.name);
      } finally {
        await parser?.destroy();
      }
    }

    return NextResponse.json(
      { error: "Only DOCX and PDF resumes are supported right now." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Could not parse resume: ${error.message}`
            : "Could not parse this resume file."
      },
      { status: 422 }
    );
  }
}

function parsedResponse(text: string, fileType: "docx" | "pdf", fileName: string) {
  if (text.length < 30) {
    return NextResponse.json(
      {
        error:
          "Could not extract readable text. If this is a scanned PDF, use a DOCX resume or export a text-based PDF."
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    fileName,
    fileType,
    rawText: text,
    document: parseResumeText(text)
  });
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/--\s+\d+\s+of\s+\d+\s+--/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
