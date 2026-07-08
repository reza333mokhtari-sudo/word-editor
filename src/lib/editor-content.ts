type RichNode = {
  type?: string;
  text?: string;
  content?: RichNode[];
};

export function escapeEditorHtml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]!));
}

function inlineMarkdownToHtml(value: string) {
  return escapeEditorHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/==([^=]+)==/g, "<mark>$1</mark>");
}

export function textToEditorHtml(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let inFence = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map(inlineMarkdownToHtml).join("<br>")}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  };

  const openList = (kind: "ul" | "ol") => {
    if (list === kind) return;
    closeList();
    list = kind;
    html.push(`<${kind}>`);
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      closeList();
      if (inFence) {
        html.push(`<pre><code>${escapeEditorHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
      }
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      html.push(`<h${heading[1].length}>${inlineMarkdownToHtml(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      openList("ul");
      html.push(`<li><p>${inlineMarkdownToHtml(bullet[1])}</p></li>`);
      continue;
    }

    const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      openList("ol");
      html.push(`<li><p>${inlineMarkdownToHtml(ordered[1])}</p></li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  if (inFence) html.push(`<pre><code>${escapeEditorHtml(codeLines.join("\n"))}</code></pre>`);
  flushParagraph();
  closeList();

  return html.length ? html.join("") : "<p></p>";
}

function extractText(node: RichNode | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  const children = node.content?.map(extractText).join("") ?? "";
  return node.type && ["paragraph", "heading", "listItem", "codeBlock", "blockquote"].includes(node.type)
    ? `${children}\n`
    : children;
}

export function normalizeEditorContent(content: unknown): unknown {
  if (!content || typeof content !== "object") return content;
  const root = content as RichNode;
  if (root.type !== "doc" || !Array.isArray(root.content) || root.content.length === 0) return content;

  const hasCodeBlock = root.content.some((node) => node.type === "codeBlock");
  const hasTextBlocks = root.content.some((node) => ["paragraph", "heading", "bulletList", "orderedList"].includes(node.type ?? ""));

  if (hasCodeBlock && !hasTextBlocks) {
    return textToEditorHtml(extractText(root).trim());
  }

  return content;
}