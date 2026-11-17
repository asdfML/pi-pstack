import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const checker = fileURLToPath(new URL("./check-docs.mjs", import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pstack-docs-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const files = {
    "README.md": "# Minimal package README\n",
    "skills/setup-pstack/SKILL.md": "# Setup\n",
    "skills/poteto-help/SKILL.md": "# Help\n",
    "skills/poteto-help/references/recipes.md": "# Recipes\n",
    "skills/principle-example/SKILL.md": "# Example\n",
    "skills/poteto-mode/playbooks/example.md": "# Example\n",
    "skills/poteto-mode/SKILL.md": "# Mode\n",
    "agents/general-purpose-readonly.md": "# Reader\n",
    ".pi/ignored.md": "/not-a-command\n",
    "node_modules/ignored.md": "/not-a-command\n",
    "docs/guide/README.md": [
      "# Guide",
      "The package ships 4 skills, with 1 principles, 1 playbooks, and 1 agents.",
      "## Run `/skill:poteto-mode`",
      "Use /skill:poteto-mode, /skill:setup-pstack, and /goal.",
      'Use agent: "general-purpose-readonly".',
      "[Run](#run-skillpoteto-mode)",
      ...["setup-pstack", "poteto-help", "poteto-mode", "principle-example"].map(
        (name) => `[${name}](../../skills/${name}/SKILL.md)`,
      ),
      "[Example](../../skills/poteto-mode/playbooks/example.md)",
      "[Reader](../../agents/general-purpose-readonly.md)",
      "",
    ].join("\n"),
  };
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  mkdirSync(join(root, "tools"));
  copyFileSync(checker, join(root, "tools/check-docs.mjs"));
  return {
    append(body) {
      const path = join(root, "docs/guide/README.md");
      writeFileSync(path, readFileSync(path, "utf8") + body);
    },
    run() {
      return spawnSync(process.execPath, [join(root, "tools/check-docs.mjs")], { encoding: "utf8" });
    },
  };
}

test("checks a Pi root with a minimal README and guide-owned inventory", (t) => {
  const result = fixture(t).run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /4 skills \(3 commands, 1 principles\), 1 playbooks, 1 agents/);
  assert.match(result.stdout, /0 problems/);
});

test("rejects unknown skills, agents, links, and anchors", (t) => {
  const project = fixture(t);
  project.append('/skill:missing\nagent: "missing"\n[Missing](missing.md)\n[Anchor](#missing)\n');
  const result = project.run();
  assert.equal(result.status, 1);
  for (const text of ["names /missing", 'names agent "missing"', "links to missing.md", "has no heading with that anchor"]) {
    assert.ok(result.stdout.includes(text), result.stdout);
  }
});

test("rejects stale inventory counts and undeclared fixed models", (t) => {
  const project = fixture(t);
  project.append("The package ships 99 skills. Use gpt-99.\n");
  const result = project.run();
  assert.equal(result.status, 1);
  assert.match(result.stdout, /tree has 4 or 3/);
  assert.match(result.stdout, /names model gpt-99/);
});
