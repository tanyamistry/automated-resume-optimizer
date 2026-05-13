import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = parsed.text.replace(/\n{3,}/g, "\n\n").trim();

    if (text.length < 80) {
      return NextResponse.json(
        {
          error:
            "Could not extract enough text from this PDF. Try copying from Google Docs or uploading a text-based PDF."
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Could not read this PDF. Try exporting it again from Google Docs." },
      { status: 422 }
    );
  }
}
