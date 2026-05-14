import { Document, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import type { ProposedChange, ResumeDocument } from "./types";

export async function patchDocxWithChanges(
  originalDocx: Buffer,
  changes: ProposedChange[],
  finalDoc: ResumeDocument
): Promise<Buffer> {
  const activeChanges = changes.filter((change) => change.status !== "rejected");

  try {
    const zip = await JSZip.loadAsync(originalDocx);
    const documentXmlFile = zip.file("word/document.xml");

    if (!documentXmlFile) {
      throw new Error("DOCX document.xml missing.");
    }

    let documentXml = await documentXmlFile.async("string");

    for (const change of activeChanges) {
      documentXml = replaceTextInDocumentXml(documentXml, change.original, change.optimized);
    }

    zip.file("word/document.xml", documentXml);
    return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
  } catch {
    return createFallbackDocx(finalDoc);
  }
}

function replaceTextInDocumentXml(documentXml: string, original: string, optimized: string): string {
  if (!original.trim() || original === optimized) {
    return documentXml;
  }

  const paragraphRegex = /<w:p[\s\S]*?<\/w:p>/g;

  return documentXml.replace(paragraphRegex, (paragraph) => {
    const textNodes = [...paragraph.matchAll(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g)];
    if (textNodes.length === 0) {
      return paragraph;
    }

    const paragraphText = textNodes.map((node) => decodeXml(node[2])).join("");
    if (!normalizeForMatch(paragraphText).includes(normalizeForMatch(original))) {
      return paragraph;
    }

    const nextText = replaceNormalized(paragraphText, original, optimized);
    let replacedFirst = false;

    return paragraph.replace(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g, (node, attrs) => {
      if (!replacedFirst) {
        replacedFirst = true;
        return `<w:t${ensurePreserveSpace(attrs)}>${encodeXml(nextText)}</w:t>`;
      }

      return `<w:t${attrs}></w:t>`;
    });
  });
}

function replaceNormalized(source: string, original: string, optimized: string): string {
  const sourceNormalized = normalizeForMatch(source);
  const originalNormalized = normalizeForMatch(original);
  const start = sourceNormalized.indexOf(originalNormalized);

  if (start === -1) {
    return optimized;
  }

  return `${source.slice(0, start)}${optimized}${source.slice(start + original.length)}`;
}

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function ensurePreserveSpace(attrs: string): string {
  return attrs.includes("xml:space") ? attrs : `${attrs} xml:space="preserve"`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function createFallbackDocx(doc: ResumeDocument): Promise<Buffer> {
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: doc.contact.name || "Optimized Resume", bold: true })]
          }),
          new Paragraph(doc.summary),
          new Paragraph({ text: "Experience", heading: "Heading2" }),
          ...doc.experience.flatMap((item) => [
            new Paragraph({ children: [new TextRun({ text: item.company, bold: true })] }),
            ...item.bullets.map((bullet) => new Paragraph({ text: bullet, bullet: { level: 0 } }))
          ]),
          new Paragraph({ text: "Projects", heading: "Heading2" }),
          ...doc.projects.flatMap((item) => [
            new Paragraph({ children: [new TextRun({ text: item.name, bold: true })] }),
            ...item.bullets.map((bullet) => new Paragraph({ text: bullet, bullet: { level: 0 } }))
          ]),
          new Paragraph({ text: "Skills", heading: "Heading2" }),
          ...Object.entries(doc.skills).map(
            ([category, values]) => new Paragraph(`${category}: ${values.join(", ")}`)
          )
        ]
      }
    ]
  });

  return Buffer.from(await Packer.toBuffer(document));
}
