import sanitizeHtml from "sanitize-html";

type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

const sectionTitle = /^(?:about(?: the (?:role|job|position|company|team))?|your (?:role|responsibilities|mission)|(?:what|who) (?:you(?:'|’)ll|we(?:'|’)re) (?:do|looking for|need|offer)|responsibilities|requirements|qualifications|preferred qualifications|nice to have|benefits|perks|compensation|the opportunity|the role|the team|how to apply|skills|experience|tasks|duties|you will|we offer|what you(?:'|’)ll (?:do|bring)|what we offer|about us|our company|overview|job description)$/i;
const bulletLine = /^\s*(?:[-*•–]\s+|\d{1,3}[.)]\s+)(.+)$/;

function heading(line: string) {
  const text = line.trim().replace(/^#{1,4}\s+/, "").replace(/^\*\*(.+)\*\*$/, "$1").replace(/:\s*$/, "").trim();
  return text.length <= 80 && sectionTitle.test(text) ? text : null;
}

function splitLongParagraph(value: string) {
  const sentences = value.split(/(?<=[.!?。！？])\s+(?=\S)/u);
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    let remaining = sentence.trim();
    while (remaining.length > 850) {
      const cut = remaining.lastIndexOf(" ", 850);
      if (cut < 500) break;
      if (current) paragraphs.push(current);
      paragraphs.push(remaining.slice(0, cut));
      current = "";
      remaining = remaining.slice(cut + 1);
    }
    if (!remaining) continue;
    if (current.length >= 500 && current.length + remaining.length > 850) {
      paragraphs.push(current);
      current = "";
    }
    current += `${current ? " " : ""}${remaining}`;
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

export function parsePlainDescription(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Extract<Block, { kind: "list" }> | null = null;
  const flushParagraph = () => {
    if (paragraph.length) {
      for (const text of splitLongParagraph(paragraph.join(" ").replace(/\s+/g, " ").trim())) {
        blocks.push({ kind: "paragraph", text });
      }
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const title = heading(line);
    if (title) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: title });
      continue;
    }
    const bullet = line.match(bulletLine);
    if (bullet) {
      flushParagraph();
      const ordered = /^\d/.test(line);
      if (list && list.ordered !== ordered) flushList();
      list ??= { kind: "list", ordered, items: [] };
      list.items.push(bullet[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function sanitizeJobDescription(source: string) {
  return sanitizeHtml(source, {
    allowedTags: ["h2", "h3", "p", "ul", "ol", "li", "strong", "b", "em", "i", "br", "a", "div", "span", "blockquote"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      h1: "h2",
      h4: "h3",
      h5: "h3",
      h6: "h3",
      a: (_tag, attributes) => {
        try {
          const url = new URL(attributes.href);
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Unsafe link");
          return { tagName: "a", attribs: { href: url.href, target: "_blank", rel: "noopener noreferrer" } };
        } catch {
          return { tagName: "span", attribs: {} as Record<string, string> };
        }
      },
    },
  });
}
