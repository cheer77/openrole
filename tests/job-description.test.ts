import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlainDescription, sanitizeJobDescription } from "../lib/job-description-content.ts";

test("HTML retains semantic sections, lists and emphasis without unsafe markup", () => {
  const html = sanitizeJobDescription('<h1>Role</h1><p>Build <strong>products</strong>.</p><h3>Requirements</h3><ul><li>React</li></ul><script>alert(1)</script><img src=x onerror=alert(2)>');
  assert.match(html, /<h2>Role<\/h2>/);
  assert.match(html, /<strong>products<\/strong>/);
  assert.match(html, /<h3>Requirements<\/h3>/);
  assert.match(html, /<ul><li>React<\/li><\/ul>/);
  assert.doesNotMatch(html, /script|onerror|<img/);
});

test("long plain text becomes readable paragraphs without losing words", () => {
  const source = Array.from({ length: 35 }, (_, i) => `Sentence ${i} explains the work clearly.`).join(" ");
  const blocks = parsePlainDescription(source);
  assert.ok(blocks.length > 1);
  assert.equal(blocks.map((block) => block.kind === "paragraph" ? block.text : "").join(" "), source);
});

test("explicit bullets and numbered points become separate lists", () => {
  const blocks = parsePlainDescription("Responsibilities:\n- Build APIs\n• Review code\n\nRequirements:\n1. TypeScript\n2. Testing");
  assert.deepEqual(blocks.map((block) => block.kind), ["heading", "list", "heading", "list"]);
  assert.deepEqual(blocks[1], { kind: "list", ordered: false, items: ["Build APIs", "Review code"] });
  assert.deepEqual(blocks[3], { kind: "list", ordered: true, items: ["TypeScript", "Testing"] });
});

test("unmarked prose does not gain invented section headings", () => {
  const blocks = parsePlainDescription("We build tools for teams.\nYou will work with designers.");
  assert.deepEqual(blocks, [{ kind: "paragraph", text: "We build tools for teams. You will work with designers." }]);
});

test("only absolute safe links remain clickable", () => {
  const html = sanitizeJobDescription('<p><a href="https://example.com/apply">Apply</a> <a href="javascript:alert(1)">Bad</a> <a href="/internal">Relative</a></p>');
  assert.match(html, /href="https:\/\/example.com\/apply" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /javascript:|href="\/internal"/);
  assert.match(html, /Bad/);
});

test("very long job text is retained and split into manageable blocks", () => {
  const source = `Visit https://example.com/careers for details. ${Array.from({ length: 180 }, (_, i) => `The role includes task ${i} and clear collaboration.`).join(" ")}`;
  const blocks = parsePlainDescription(source);
  assert.ok(blocks.length >= 5);
  assert.equal(blocks.map((block) => block.kind === "paragraph" ? block.text : "").join(" "), source);
});
