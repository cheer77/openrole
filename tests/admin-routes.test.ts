import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedAdminMutationPath, allowedAdminReadPath } from "../lib/admin/routes.ts";

test("owner proxy exposes discovery listing and review actions", () => {
  assert.equal(allowedAdminReadPath("discovery"), true);
  for (const action of ["approve", "reject", "retry", "create-source", "ignore"])
    assert.equal(allowedAdminMutationPath(`discovery/cmid123/${action}`), true);
  assert.equal(allowedAdminMutationPath("login"), true);
  assert.equal(allowedAdminMutationPath("jobs/bulk-delete"), true);
  assert.equal(allowedAdminMutationPath("jobs/bulk-delete/extra"), false);
  assert.equal(allowedAdminReadPath("discovery/cmid123/approve"), false);
  assert.equal(allowedAdminMutationPath("discovery/cmid123/delete"), false);
  assert.equal(allowedAdminMutationPath("discovery/../approve"), false);
});
