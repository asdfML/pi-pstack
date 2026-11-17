import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const names = ["create-formal-verification-skill", "maintain-formal-verification-skill", "statechart", "ketchup-video"];
const text = (path) => readFileSync(new URL(path, root), "utf8");
const skill = (name) => text(`skills/${name}/SKILL.md`);

test("all four upstream features are explicitly invocable Pi skills", () => {
  for (const name of names) {
    const body = skill(name);
    assert.match(body, new RegExp(`^name: ${name}$`, "m"));
    assert.match(body, /^disable-model-invocation: true$/m);
    assert.ok(body.includes(`/skill:${name}`), name);
  }
});

test("formal verification retains mutation, sync and product-code boundaries", () => {
  const create = skill("create-formal-verification-skill");
  const maintain = skill("maintain-formal-verification-skill");
  assert.ok(create.includes(".agents/skills/"));
  assert.ok(create.includes("A verify skill that was never run is a draft."));
  assert.ok(create.includes("Refer to `/skill:statechart` by name."));
  assert.ok(maintain.includes("Never edit product code during a run, unless the user asks you to."));
  assert.ok(maintain.includes("Do not move the sync commit for a blocked check"));
  for (const outcome of ["in sync", "updated", "bug", "blocked"]) assert.ok(maintain.includes(`**${outcome}**`));
});

test("video retains its window, calls-only failure and rendered-frame verification", () => {
  const body = skill("ketchup-video");
  assert.ok(body.includes("last message the user wrote before `/skill:ketchup-video`"));
  assert.ok(body.includes("outside the repo"));
  assert.ok(body.includes("embedded when the client supports it or linked as a file otherwise"));
  assert.ok(body.includes("Before you embed or link the video, check the rendered file."));
  assert.ok(body.includes("If the render fails, say so in one line and give only the calls."));
  assert.ok(body.includes("at least one second for each three words"));
  assert.ok(body.includes("not with a still-frame detector"));
});

test("statechart ships its actual executable and corpus without mandatory renderer selection", () => {
  for (const path of ["scripts/statechart", "scripts/statechart.ts", "scripts/test/corpus/Counter/Counter.tla", "scripts/test/corpus/Counter/chart.mmd", "references/render.md"]) {
    assert.ok(existsSync(new URL(`skills/statechart/${path}`, root)), path);
  }
  assert.ok(statSync(new URL("skills/statechart/scripts/statechart", root)).mode & 0o111);
  assert.doesNotMatch(skill("statechart"), /Do not use a different renderer unless the user asks/);
  assert.ok(text("skills/statechart/references/render.md").includes("pele@1.9.0"));
});

test("setup, help and guide expose imported features", () => {
  assert.ok(skill("setup-pstack").includes("/skill:create-formal-verification-skill"));
  for (const name of names) {
    assert.ok(skill("poteto-help").includes(`/skill:${name}`), name);
    assert.ok(text("docs/guide/inventory.md").includes(`../../skills/${name}/SKILL.md`), name);
  }
});
