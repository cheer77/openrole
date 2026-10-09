import { parsePlainDescription, sanitizeJobDescription } from "@/lib/job-description-content";

const urlPattern = /https?:\/\/[^\s<>"']+/g;

function linkedText(value: string) {
  const parts: React.ReactNode[] = [];
  let start = 0;
  for (const match of value.matchAll(urlPattern)) {
    const index = match.index;
    if (index > start) parts.push(value.slice(start, index));
    const url = match[0].replace(/[.,;:!?)}\]]+$/, "");
    try {
      const parsed = new URL(url);
      parts.push(
        <a key={index} href={url} target="_blank" rel="noopener noreferrer" title={url}>
          {parsed.hostname}{parsed.pathname === "/" ? "" : `${parsed.pathname.slice(0, 28)}${parsed.pathname.length > 28 ? "…" : ""}`}
        </a>,
      );
    } catch {
      parts.push(url);
    }
    start = index + url.length;
  }
  if (start < value.length) parts.push(value.slice(start));
  return parts;
}

export function JobDescription({ description, descriptionHtml }: { description: string; descriptionHtml?: string | null }) {
  const cleanHtml = descriptionHtml ? sanitizeJobDescription(descriptionHtml) : "";
  const structuredHtml = /<(?:h[23]|p|ul|ol|li|blockquote|br|strong|b|em|i|a)\b/i.test(cleanHtml);
  if (structuredHtml) {
    return (
      <section className="job-description" aria-label="Job description">
        {!/<h2\b/i.test(cleanHtml) && <h2>About the role</h2>}
        <div className="job-description-content" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
      </section>
    );
  }
  const blocks = parsePlainDescription(description);
  return (
    <section className="job-description" aria-label="Job description">
      {blocks.length === 0 && <><h2>About the role</h2><p>Read the full description on the company website.</p></>}
      {blocks.length > 0 && blocks[0].kind !== "heading" && <h2>About the role</h2>}
      {blocks.map((block, index) => {
        if (block.kind === "heading") return <h2 key={index}>{block.text}</h2>;
        if (block.kind === "paragraph") return <p key={index}>{linkedText(block.text)}</p>;
        const List = block.ordered ? "ol" : "ul";
        return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{linkedText(item)}</li>)}</List>;
      })}
    </section>
  );
}
