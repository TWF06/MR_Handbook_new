import DOMPurify from "dompurify";
import { Marked, marked } from "marked";


export interface Heading {
  id: string;
  text: string;
  depth: number;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section"
  );
}

function plainText(tokens: unknown): string {
  const list = Array.isArray(tokens) ? tokens : [];
  return list
    .map((token) => {
      const t = token as { text?: string; tokens?: unknown };
      if (t.tokens) return plainText(t.tokens);
      return t.text ?? "";
    })
    .join("");
}

/** Extract h1-h3 headings for the table of contents. */
export function extractHeadings(markdown: string): Heading[] {
  const tokens = marked.lexer(markdown ?? "");
  const seen = new Map<string, number>();
  const headings: Heading[] = [];

  for (const token of tokens) {
    if (token.type !== "heading") continue;
    const depth = (token as { depth: number }).depth;
    if (depth > 3) continue;
    const text = plainText((token as { tokens?: unknown }).tokens) || (token as { text: string }).text;
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({ id: count === 0 ? base : `${base}-${count}`, text, depth });
  }

  return headings;
}

/** Render markdown to sanitized HTML, adding anchor ids to h1-h3. */
export function renderMarkdown(markdown: string): string {
  const seen = new Map<string, number>();
  const instance = new Marked({ async: false, gfm: true, breaks: false });

  instance.use({
    renderer: {
      heading(token) {
        const { tokens, depth } = token as { tokens: unknown[]; depth: number };
        const text = this.parser.parseInline(tokens as never);
        if (depth > 3) return `<h${depth}>${text}</h${depth}>`;
        const base = slugify(plainText(tokens));
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });

  const raw = instance.parse(markdown ?? "") as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true }, ADD_ATTR: ["id", "target"] });
}


/** Plain-text version of a document body, used for search snippets. */
export function markdownToText(markdown: string): string {
  return (markdown ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|-]+/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
