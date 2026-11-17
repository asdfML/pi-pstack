import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const checker = fileURLToPath(new URL("./denylist.mjs", import.meta.url));

test("denylist distinguishes loop commands from module and filesystem paths", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pstack-denylist-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "tools"));
  mkdirSync(join(root, "skills", "example"), { recursive: true });
  copyFileSync(checker, join(root, "tools", "denylist.mjs"));
  const cases = [
    { input: 'import { loopCheck } from "./passes/loop-check.ts";', status: 0 },
    { input: "Read /tmp/loop/report.md and ./loop/trace.out.", status: 0 },
    { input: "Run `/loop until done`.", status: 1 },
    { input: "/loop 10m check the PR", status: 1 },
    { input: "Use /loop.", status: 1 },
    { input: "Read /loop.ts and /loop/report.md.", status: 0 },
    { input: 'Use "/loop" here.', status: 1 },
  ];
  for (const { input, status } of cases) {
    const probe = join(root, "probe.md");
    writeFileSync(probe, input);
    const result = spawnSync(process.execPath, [join(root, "tools", "denylist.mjs"), "probe.md"], { encoding: "utf8" });
    assert.equal(result.status, status, `${input}\n${result.stdout}${result.stderr}`);
    if (status === 1) assert.match(result.stdout, /\/loop/);
  }
});
