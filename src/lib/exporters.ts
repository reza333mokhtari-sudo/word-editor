import { saveAs } from "file-saver";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, LevelFormat,
} from "docx";

function safeName(title: string) {
  return (title || "سند").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
}

function escapeHtml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/* ---------- TXT ---------- */
export function exportAsText(title: string, plain: string) {
  const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
  saveAs(blob, `${safeName(title)}.txt`);
}

/* ---------- HTML ---------- */
export function exportAsHtml(title: string, html: string) {
  const t = escapeHtml(title || "سند");
  const doc = `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${t}</title>
<link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
<style>
  body { font-family: Vazirmatn, Tahoma, sans-serif; direction: rtl; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.9; color: #111; }
  h1,h2,h3 { line-height: 1.4; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 6px 8px; }
  blockquote { border-inline-start: 3px solid #999; padding-inline-start: 12px; color: #444; }
  pre, code { font-family: ui-monospace, Menlo, monospace; background: #f4f4f5; padding: 2px 4px; border-radius: 4px; direction: ltr; }
  img { max-width: 100%; height: auto; }
  .doc-title { font-size: 24px; font-weight: 700; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 24px; }
</style></head><body><div class="doc-title">${t}</div>${html}</body></html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  saveAs(blob, `${safeName(title)}.html`);
}

/* ---------- PDF (print dialog) ---------- */
export function exportAsPdf(title: string, html: string): boolean {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  const t = escapeHtml(title || "سند");
  win.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${t}</title>
<link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
<style>
  @page { size: A4; margin: 20mm; }
  html, body { font-family: Vazirmatn, Tahoma, sans-serif; color: #111; direction: rtl; }
  body { margin: 0; line-height: 1.9; font-size: 12pt; }
  h1 { font-size: 22pt; margin: 0 0 12px; }
  h2 { font-size: 18pt; margin: 18px 0 8px; }
  h3 { font-size: 14pt; margin: 14px 0 6px; }
  p, ul, ol, blockquote, table { margin: 0 0 10px; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 6px 8px; }
  blockquote { border-inline-start: 3px solid #999; padding-inline-start: 12px; color: #444; }
  pre, code { font-family: ui-monospace, Menlo, monospace; background: #f4f4f5; padding: 2px 4px; border-radius: 4px; direction: ltr; }
  pre { padding: 10px; overflow: auto; }
  a { color: #2563eb; text-decoration: underline; }
  .doc-title { font-size: 20pt; font-weight: 700; margin-bottom: 16px; border-bottom: 2px solid #111; padding-bottom: 6px; }
</style></head><body>
<div class="doc-title">${t}</div>${html}
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 400); });<\/script>
</body></html>`);
  win.document.close();
  return true;
}

/* ---------- DOCX ---------- */
type Mark = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean };

function runsFromInline(node: Node, mark: Mark = {}): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text) return [];
    return [new TextRun({
      text,
      bold: mark.bold, italics: mark.italic, strike: mark.strike,
      underline: mark.underline ? {} : undefined,
      rightToLeft: true,
    })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const next: Mark = { ...mark };
  if (tag === "strong" || tag === "b") next.bold = true;
  if (tag === "em" || tag === "i") next.italic = true;
  if (tag === "u") next.underline = true;
  if (tag === "s" || tag === "strike" || tag === "del") next.strike = true;
  if (tag === "br") return [new TextRun({ text: "", break: 1 })];
  const out: TextRun[] = [];
  el.childNodes.forEach((c) => out.push(...runsFromInline(c, next)));
  return out;
}

function paragraphFromBlock(el: HTMLElement, opts: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bullet?: number; numbered?: number; quote?: boolean } = {}): Paragraph {
  const runs = runsFromInline(el);
  return new Paragraph({
    children: runs.length ? runs : [new TextRun({ text: "", rightToLeft: true })],
    heading: opts.heading,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    bullet: opts.bullet !== undefined ? { level: opts.bullet } : undefined,
    numbering: opts.numbered !== undefined ? { reference: "num-list", level: opts.numbered } : undefined,
    style: opts.quote ? "Quote" : undefined,
  });
}

function walkBlocks(node: Node, out: (Paragraph | Table)[], listCtx?: { kind: "ul" | "ol"; level: number }) {
  if (node.nodeType === Node.TEXT_NODE) {
    const txt = (node.textContent ?? "").trim();
    if (txt) out.push(new Paragraph({ children: [new TextRun({ text: txt, rightToLeft: true })], bidirectional: true, alignment: AlignmentType.RIGHT }));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "h1": out.push(paragraphFromBlock(el, { heading: HeadingLevel.HEADING_1 })); return;
    case "h2": out.push(paragraphFromBlock(el, { heading: HeadingLevel.HEADING_2 })); return;
    case "h3": out.push(paragraphFromBlock(el, { heading: HeadingLevel.HEADING_3 })); return;
    case "h4": out.push(paragraphFromBlock(el, { heading: HeadingLevel.HEADING_4 })); return;
    case "p": out.push(paragraphFromBlock(el)); return;
    case "blockquote":
      el.childNodes.forEach((c) => {
        if (c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName.toLowerCase() === "p") {
          out.push(paragraphFromBlock(c as HTMLElement, { quote: true }));
        }
      });
      if (!el.querySelector("p")) out.push(paragraphFromBlock(el, { quote: true }));
      return;
    case "ul":
    case "ol": {
      const level = listCtx ? listCtx.level + 1 : 0;
      el.querySelectorAll(":scope > li").forEach((li) => {
        const opts = tag === "ul" ? { bullet: level } : { numbered: level };
        out.push(paragraphFromBlock(li as HTMLElement, opts));
        li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => walkBlocks(sub, out, { kind: tag as "ul" | "ol", level }));
      });
      return;
    }
    case "pre": {
      const text = el.textContent ?? "";
      text.split("\n").forEach((line) => {
        out.push(new Paragraph({
          children: [new TextRun({ text: line || " ", font: "Consolas" })],
          style: "Quote",
        }));
      });
      return;
    }
    case "hr":
      out.push(new Paragraph({ children: [new TextRun("―――――――――――")], alignment: AlignmentType.CENTER }));
      return;
    case "table": {
      const rows: TableRow[] = [];
      el.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr").forEach((tr) => {
        const cells: TableCell[] = [];
        tr.querySelectorAll("th, td").forEach((cell) => {
          const cellChildren: Paragraph[] = [];
          const inner: (Paragraph | Table)[] = [];
          cell.childNodes.forEach((c) => walkBlocks(c, inner));
          const paras = inner.filter((x): x is Paragraph => x instanceof Paragraph);
          if (paras.length) cellChildren.push(...paras);
          else cellChildren.push(new Paragraph({ children: [new TextRun({ text: cell.textContent ?? "", rightToLeft: true })], bidirectional: true, alignment: AlignmentType.RIGHT }));
          cells.push(new TableCell({
            children: cellChildren,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          }));
        });
        if (cells.length) rows.push(new TableRow({ children: cells }));
      });
      if (rows.length) {
        out.push(new Table({
          rows,
          width: { size: 9360, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
          },
        }));
      }
      return;
    }
    case "div":
    case "section":
    case "article":
      el.childNodes.forEach((c) => walkBlocks(c, out, listCtx));
      return;
    default:
      // Inline content wrapped as a paragraph
      out.push(paragraphFromBlock(el));
  }
}

export async function exportAsDocx(title: string, html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const children: (Paragraph | Table)[] = [];
  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: title || "سند", bold: true, size: 40, rightToLeft: true })],
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: 240 },
  }));
  container.childNodes.forEach((n) => walkBlocks(n, children));
  if (children.length === 1) {
    children.push(new Paragraph({ children: [new TextRun({ text: "", rightToLeft: true })] }));
  }

  const doc = new Document({
    creator: "نگارش",
    title: title || "سند",
    styles: {
      default: { document: { run: { font: "Vazirmatn", size: 24 } } },
    },
    numbering: {
      config: [{
        reference: "num-list",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.RIGHT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.DECIMAL, text: "%2.", alignment: AlignmentType.RIGHT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safeName(title)}.docx`);
}

/* Convenience: from tiptap editor JSON to plain text */
export function tiptapJsonToText(json: unknown): string {
  const parts: string[] = [];
  function walk(n: any) {
    if (!n) return;
    if (typeof n.text === "string") parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
    if (["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(n.type)) parts.push("\n");
  }
  walk(json);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}