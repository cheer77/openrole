import { test } from "node:test";
import assert from "node:assert/strict";
import { jobCategories, employmentKinds as backendKinds } from "../backend/src/jobs/classification.ts";
import { categories, employmentKinds } from "../features/jobs/types.ts";

test("public category and employment filters cover backend taxonomy", () => {
  assert.deepEqual([...categories].sort(), [...jobCategories].sort());
  assert.deepEqual(employmentKinds, backendKinds);
});
