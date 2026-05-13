import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MIN_EXTRACTED_CHARS = 30;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const file = formData.get("resume");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a resume PDF first." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "PDF must be 4MB or smaller for this MVP." },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
  }

  let parser: PDFParse | undefined;

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    parser = new PDFParse({ data });
    const parsed = await parser.getText();
    const text = normalizeExtractedText(parsed.text);

    if (text.length < MIN_EXTRACTED_CHARS) {
      return NextResponse.json(
        {
          error:
            "Could not extract readable text from this PDF. If it is scanned or image-based, export a text-based PDF from Google Docs or paste the resume text."
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Could not read this PDF: ${error.message}`
            : "Could not read this PDF. Try exporting it again from Google Docs."
      },
      { status: 422 }
    );
  } finally {
    await parser?.destroy();
  }
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/--\s+\d+\s+of\s+\d+\s+--/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
