import { test } from "node:test";
import assert from "node:assert/strict";
import { atsFromUrl, boardUrl, careerCandidate, detectAts, detectAtsFromJobs, normalizedCompanyName, websiteDomain } from "../src/discovery/detect.js";
import { publicAddress, validatePublicUrl } from "../src/discovery/safe-http.js";

test("recognizes supported ATS hosts and keeps their canonical identifiers", () => {
  assert.deepEqual(atsFromUrl("https://boards.greenhouse.io/acme/jobs/123")?.identifier, "acme");
  assert.deepEqual(atsFromUrl("https://jobs.eu.lever.co/acme/123")?.identifier, "eu:acme");
  assert.deepEqual(atsFromUrl("https://jobs.ashbyhq.com/acme")?.identifier, "acme");
  assert.deepEqual(atsFromUrl("https://acme.jobs.personio.de")?.identifier, "de:acme");
  assert.deepEqual(atsFromUrl("https://acme.recruitee.com")?.identifier, "acme");
  assert.equal(atsFromUrl("https://evil.example/greenhouse/acme"), null);
});

test("selects career links and keeps ambiguous or weak evidence in review", () => {
  const html = '<a href="/about">About</a><a href="/careers">Join us</a>';
  assert.equal(careerCandidate(html, "https://acme.example"), "https://acme.example/careers");
  const one = detectAts(null, '<a href="https://jobs.ashbyhq.com/acme">Jobs</a>', "https://acme.example");
  assert.equal(one.ats, "ASHBY");
  assert.equal(one.confidence, "HIGH");
  const many = detectAts(null, '<a href="https://jobs.ashbyhq.com/acme">A</a><a href="https://jobs.lever.co/other">B</a>', "https://acme.example");
  assert.equal(many.confidence, "MEDIUM");
  const hint = detectAts(null, "Powered by Greenhouse", "https://acme.example");
  assert.equal(hint.confidence, "LOW");
  assert.equal(hint.identifier, null);
});

test("finds a board from imported apply links without guessing a company website", () => {
  const one = detectAtsFromJobs([
    "https://jobs.ashbyhq.com/acme/job-one",
    "https://jobs.ashbyhq.com/acme/job-two",
    "https://aggregator.example/other",
  ]);
  assert.equal(one?.confidence, "HIGH");
  assert.equal(one?.identifier, "acme");
  assert.equal(boardUrl(one!), "https://jobs.ashbyhq.com/acme");
  const conflict = detectAtsFromJobs([
    "https://jobs.ashbyhq.com/acme/one", "https://jobs.lever.co/other/two",
  ]);
  assert.equal(conflict?.confidence, "MEDIUM");
  assert.equal(detectAtsFromJobs(["https://aggregator.example/job"]), null);
});

test("normalizes company signals without inventing domains", () => {
  assert.equal(normalizedCompanyName("Ácme, Inc."), "acme inc");
  assert.equal(websiteDomain("https://www.acme.example/careers"), "acme.example");
  assert.equal(websiteDomain("Acme Inc"), null);
});

test("blocks private, local and prohibited discovery targets", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.10", "::1", "fc00::1", "::ffff:127.0.0.1"])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true);
  for (const url of ["http://localhost", "http://127.0.0.1", "http://169.254.169.254", "http://example.com:3000", "file:///etc/passwd", "https://linkedin.com/company/acme", "https://jobs.indeed.com"])
    assert.throws(() => validatePublicUrl(url), { name: "Error" }, url);
  assert.equal(validatePublicUrl("https://acme.example/careers").hostname, "acme.example");
});
