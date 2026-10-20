import { test } from "node:test";
import assert from "node:assert/strict";
import { sitemapUrls } from "../lib/sitemap-xml.ts";

test("sitemap keeps active URLs while omitting unknown lastmod", () => {
  const xml = sitemapUrls([
    { url: "https://vmiyou.me/jobs/known", lastModified: "2026-10-20T09:00:00.000Z" },
    { url: "https://vmiyou.me/jobs/legacy" },
  ]);
  assert.match(xml, /<loc>https:\/\/vmiyou\.me\/jobs\/known<\/loc><lastmod>2026-10-20T09:00:00\.000Z<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/vmiyou\.me\/jobs\/legacy<\/loc><\/url>/);
  assert.equal((xml.match(/<lastmod>/g) ?? []).length, 1);
});
