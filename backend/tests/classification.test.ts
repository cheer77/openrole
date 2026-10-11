import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyEmploymentType, classifyExperienceLevel, classifyJob } from "../src/jobs/classification.js";

test("broad categories distinguish occupations from technology roles", () => {
  const examples = [
    ["Senior Software Engineer", [], "Software Engineering"],
    ["Head of Security Engineering", [], "Cybersecurity"],
    ["Frontend Developer", [], "Frontend"],
    ["Account Executive", [], "Sales"],
    ["Production Planner", [], "Manufacturing & Production"],
    ["Projektingenieurin für Versorgungstechnik", [], "Construction & Trades"],
    ["Grocery Associate", [], "Retail & Hospitality"],
    ["Medical Assistant", [], "Healthcare"],
    ["Warehouse Manager", [], "Logistics & Supply Chain"],
    ["Customer Engineer", ["Customer Service"], "Customer Service"],
    ["Research Associate", [], "Science & Research"],
    ["Unknown role", [], "Other"],
  ] as const;
  for (const [title, tags, expected] of examples)
    assert.equal(classifyJob(title, tags), expected, title);
});

test("experience labels come from explicit title words", () => {
  assert.equal(classifyExperienceLevel("Intermediate Accountant"), "Middle");
  assert.equal(classifyExperienceLevel("Senior Production Planner"), "Senior");
  assert.equal(classifyExperienceLevel("Head of Retail"), "Lead");
  assert.equal(classifyExperienceLevel("Accountant"), null);
});

test("employment type only uses explicit source evidence", () => {
  assert.equal(classifyEmploymentType("Permanent, Full time"), "Full-time");
  assert.equal(classifyEmploymentType("Teilzeit"), "Part-time");
  assert.equal(classifyEmploymentType("Werkstudent"), "Working student");
  assert.equal(classifyEmploymentType("Ausbildung"), "Apprenticeship");
  assert.equal(classifyEmploymentType("Permanent"), null);
  assert.equal(classifyEmploymentType("Unbefristeter arbeitsvertrag"), null);
  assert.equal(classifyEmploymentType("Vollzeit oder Teilzeit"), null);
});
