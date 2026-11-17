import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const playbook = () => read("skills/poteto-mode/playbooks/orchestrate.md");

test("Orchestrate uses a lightweight durable tracker instead of the removed CLI", () => {
  const body = playbook();
  assert.match(body, /notes\.md/);
  assert.match(body, /Store/);
  assert.doesNotMatch(body, /orch init|frontier\.json|units\.tsv|ledger\.tsv|inbox drain|preferences\.md/);
  assert.match(body, /no polling loops/);
});

test("Orchestrate keeps owner-through-merge and current-head independent verification", () => {
  const body = playbook();
  assert.match(body, /One owner per PR/);
  assert.match(body, /Only the owner pushes, rebases, or retargets it/);
  assert.match(body, /Each PR gets a verifier that isn't its author/);
  assert.match(body, /different model family/);
  assert.match(body, /current head/);
  assert.match(body, /Start with one unit/);
  assert.match(body, /After two retries/);
});

test("Orchestrate uses Pi tools, scoped isolation and configurable forge operations", () => {
  const body = playbook();
  assert.match(body, /`subagent`/);
  assert.match(body, /pi-isolation\.md/);
  assert.match(body, /integrations\.md/);
  assert.doesNotMatch(body, /`Task`|environment: "cloud"|`gh pr view`|`gh pr checks`/);
  assert.doesNotMatch(body, /context: "fork"/);
});

test("removed orch has no remaining executable target and watch-pr dependencies survive", () => {
  for (const name of ["orch.ts", "store.ts", "orch.test.ts"]) {
    assert.equal(existsSync(fileURLToPath(new URL(`skills/poteto-mode/scripts/orch/${name}`, root))), false, name);
  }
  const pkg = JSON.parse(read("skills/poteto-mode/scripts/package.json"));
  assert.doesNotMatch(pkg.scripts.test, /\borch\b/);
  assert.match(pkg.scripts.test, /watch-pr/);
  assert.ok(pkg.dependencies.commander);
  assert.match(read("skills/poteto-mode/scripts/watch-pr/cli.ts"), /from "commander"/);
});
