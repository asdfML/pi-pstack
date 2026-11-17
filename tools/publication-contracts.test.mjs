import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const text = (path) => readFileSync(new URL(path, root), "utf8");

test("Automate-me preserves upstream's four-option minimum within Pi's limit", () => {
  const body = text("skills/automate-me/SKILL.md");
  assert.ok(body.includes("one or two questions with 4 options each"));
  assert.ok(body.includes("multi-select for category questions"));
});

test("Sharpen keeps its preliminary answers and is not restricted to a prompt-only reply", () => {
  assert.ok(text("skills/sharpen/SKILL.md").includes("Before rewriting it, do four things"));
  assert.ok(text("skills/poteto-help/SKILL.md").includes("It returns the prompt and doesn't do the task"));
  assert.ok(text("docs/guide/02-poteto-mode.md").includes("Then it rewrites your prompt"));
  assert.doesNotMatch(text("docs/guide/02-poteto-mode.md"), /returns only the rewritten prompt/);
});

test("Pi adapters preserve prose-only guidance, urgency, Lessons and selected model identities", () => {
  const mode = text("skills/poteto-mode/SKILL.md");
  assert.ok(mode.includes("Agent-facing prose also follows the prose guidance in"));
  assert.ok(mode.includes("meaning CI or trunk is red or a person is blocked on the result right now"));
  const babysit = text("skills/poteto-mode/playbooks/babysit.md");
  assert.ok(babysit.includes("candidate in the project lessons file"));
  assert.ok(text("skills/architect/references/runner-prompt.md").includes("each on its selected model"));
});
