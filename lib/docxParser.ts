import mammoth from "mammoth";

export async function parseDocxToRawText(buffer: Buffer): Promise<string> {
  const parsed = await mammoth.extractRawText({ buffer });
  return preserveExtractedText(parsed.value);
}

export function preserveExtractedText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
