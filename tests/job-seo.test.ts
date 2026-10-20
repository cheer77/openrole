import { test } from "node:test";
import assert from "node:assert/strict";
import { jobPosting } from "../lib/job-seo.ts";
import type { Job } from "../features/jobs/types.ts";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    slug: "engineer-job-1",
    status: "ACTIVE",
    title: "Software Engineer",
    company: {
      slug: "example",
      name: "Example Inc",
      logoUrl: null,
      initials: "EI",
      color: "#000",
      background: "#fff",
      description: "",
      website: "https://example.com/careers",
    },
    category: "Software Engineering",
    location: "Madrid, Spain",
    city: "Madrid",
    country: "ES",
    region: null,
    structuredLocations: [{ city: "Madrid", region: null, country: "ES" }],
    remoteType: "ON_SITE",
    employmentType: "Full-time",
    workType: "On-site",
    experience: "Senior",
    technologies: ["TypeScript"],
    publishedAt: "2026-10-01T09:00:00.000Z",
    firstSeenAt: "2026-10-02T09:00:00.000Z",
    sourceUrl: "https://example.com/jobs/1",
    shortDescription: "Build production software.",
    description: ["Build production software.", "Work with the platform team."],
    eligibility: "Madrid, Spain",
    applyUrl: "https://example.com/jobs/1/apply",
    ...overrides,
  };
}

test("JobPosting contains required fields and all reliable physical locations", () => {
  const posting = jobPosting(job({
    structuredLocations: [
      { city: "Madrid", region: null, country: "ES" },
      { city: "Berlin", region: "BE", country: "DE" },
    ],
  }), "https://vmiyou.me/jobs/engineer-job-1");
  assert.ok(posting);
  assert.equal(posting.title, "Software Engineer");
  assert.equal(posting.datePosted, "2026-10-01T09:00:00.000Z");
  assert.equal(posting.description.includes("platform team"), true);
  assert.equal(posting.hiringOrganization.name, "Example Inc");
  assert.ok(posting.jobLocation);
  assert.equal(posting.jobLocation.length, 2);
  assert.deepEqual(posting.jobLocation.map((place) => place.address.addressCountry), ["ES", "DE"]);
});

test("remote JobPosting uses explicit eligible countries and no physical location", () => {
  const posting = jobPosting(job({
    remoteType: "REMOTE",
    workType: "Remote",
    structuredLocations: [
      { city: null, region: null, country: "ES" },
      { city: null, region: null, country: "DE" },
    ],
  }), "https://vmiyou.me/jobs/engineer-job-1");
  assert.ok(posting);
  assert.equal(posting.jobLocationType, "TELECOMMUTE");
  assert.equal("jobLocation" in posting, false);
  assert.ok(posting.applicantLocationRequirements);
  assert.deepEqual(posting.applicantLocationRequirements.map((place) => place.name), ["ES", "DE"]);
});

test("JobPosting is omitted without a real publication date or reliable location", () => {
  assert.equal(jobPosting(job({ publishedAt: null }), "https://vmiyou.me/jobs/engineer-job-1"), null);
  assert.equal(jobPosting(job({ structuredLocations: [] }), "https://vmiyou.me/jobs/engineer-job-1"), null);
  assert.equal(jobPosting(job({ status: "CLOSED" }), "https://vmiyou.me/jobs/engineer-job-1"), null);
});
