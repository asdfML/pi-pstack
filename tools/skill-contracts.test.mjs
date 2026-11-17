import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const text = (path) => readFileSync(join(root, path), "utf8");
const skill = (name) => text(`skills/${name}/SKILL.md`);
const reference = (name) => `skills/poteto-mode/references/${name}.md`;

function markdownFiles(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.name === "node_modules") return [];
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  });
}

test("Reflect retains publication and installed-package boundaries alongside Lessons", () => {
  const body = skill("reflect");
  assert.ok(body.includes("Never open a PR or push."));
  assert.match(body, /copy the skill folder/i);
  assert.match(body, /before approval/i);
  assert.match(body, /lesson, not an edit|becomes a lesson/i);
});

test("No-comments preserves the caller's actual uncommitted checkout", () => {
  const body = skill("no-comments");
  assert.match(body, /caller's checkout/);
  assert.match(body, /uncommitted inputs/);
  assert.doesNotMatch(body, /in a separate checkout/);
});

test("Swarm preserves same-family fallback and isolated code checkouts", () => {
  const body = skill("swarm");
  assert.match(body, /same (?:model )?family/);
  assert.match(body, /closest valid/);
  assert.ok(body.includes("pi-isolation.md"));
  assert.ok(!body.includes("Give those workers separate output directories instead."));
});

test("Reflect preserves same-family fallback before parent inheritance", () => {
  const body = skill("reflect");
  assert.match(body, /closest valid model of the same family/);
  assert.match(body, /Never retry a rejected model/);
});

test("inherit-parent selects native inheritance explicitly", () => {
  for (const name of ["poteto-mode", "setup-pstack", "arena", "swarm", "reflect"]) {
    assert.ok(skill(name).includes('model: "inherit"'), name);
    assert.doesNotMatch(skill(name), /Omit `model` when[^.]*inherit-parent/);
  }
});

test("unconfigured panels retain upstream's three seats without fixed models", () => {
  assert.match(skill("arena"), /(?:run|use) three runners/);
  assert.match(skill("architect"), /(?:run|use) three runners/);
  const setup = skill("setup-pstack");
  for (const role of ["arena runners", "architect runners", "interrogate reviewers"]) {
    assert.ok(setup.includes(`${role}: inherit-parent, inherit-parent, inherit-parent`), role);
  }
});

test("model setup preserves role-relative effort independently of model identities", () => {
  const setup = skill("setup-pstack");
  const rows = new Map([...setup.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`(high|xhigh|max)`\s*\|/gm)].map((match) => [match[1], match[2]]));
  const expected = {
    "feature, refactoring": "xhigh",
    "bug-fix": "xhigh",
    "perf-issue": "xhigh",
    hillclimb: "xhigh",
    "judgment and prose": "xhigh",
    "hardest tasks": "max",
    "reflect tooling": "high",
    "reflect judgment, divergent, synthesizer": "xhigh",
    "arena runners": "high",
    "arena cross-judge pool": "high",
    "swarm workers": "high",
    "architect runners": "high",
    "interrogate reviewers": "high",
  };
  for (const [role, effort] of Object.entries(expected)) assert.equal(rows.get(role), effort, role);
  assert.match(setup, /at or below/);
  assert.match(setup, /supported/);
  assert.ok(setup.includes("feature, refactoring: inherit-parent"));
});

test("canonical setup configures models without introducing global task-routing policy", () => {
  const setup = skill("setup-pstack");
  assert.ok(setup.includes("pstack/models.md"));
  assert.ok(!setup.includes("pstack-routing:start"));
  assert.ok(!setup.includes("defaultReads"));
});

test("trivial edits retain their configured worker-role routing", () => {
  assert.match(skill("poteto-mode"), /Trivial mechanical edits go to (?:your|the).*`swarm workers`/);
});

test("shared Pi procedures have real reference targets", () => {
  for (const name of ["pi-isolation", "pi-waits", "pi-transcripts"]) {
    assert.ok(existsSync(join(root, reference(name))), name);
  }
  for (const [name, target] of [["arena", "pi-isolation"], ["swarm", "pi-isolation"], ["reflect", "pi-transcripts"], ["recall", "pi-transcripts"], ["show-me-your-work", "pi-transcripts"]]) {
    assert.ok(skill(name).includes(`${target}.md`), name);
  }
});

test("timer and transcript serialization details have one source of truth", () => {
  const files = markdownFiles("skills");
  const timer = files.filter((path) => text(path).includes("sessionOnly: true"));
  const transcript = files.filter((path) => text(path).includes("Every later line is an entry"));
  assert.deepEqual(timer, [reference("pi-waits")]);
  assert.deepEqual(transcript, [reference("pi-transcripts")]);
});

test("workflows do not add a ban on Pi workflows or a universal review prerequisite", () => {
  for (const name of ["arena", "swarm", "reflect"]) assert.doesNotMatch(skill(name), /not a workflow/);
  assert.doesNotMatch(skill("interrogate"), /run its prerequisite check/);
});

test("package agents explicitly inherit global Lessons instructions", () => {
  for (const name of ["poteto-agent", "comment-sicko", "general-purpose", "general-purpose-readonly"]) {
    assert.match(text(`agents/${name}.md`), /^inheritGlobalContext: true$/m, name);
  }
});

test("skill and reference Markdown links resolve", () => {
  for (const path of [...markdownFiles("skills"), ...markdownFiles("agents")]) {
    for (const [, href] of text(path).matchAll(/\]\(([^\s)]+)\)/g)) {
      if (/^[a-z][\w+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("/") || href.includes("<")) continue;
      const target = href.split("#")[0];
      assert.ok(existsSync(join(root, dirname(path), target)), `${path}: ${href}`);
    }
  }
});
