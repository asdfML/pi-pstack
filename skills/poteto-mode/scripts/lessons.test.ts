import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, expect, test } from "bun:test";

const script = join(import.meta.dir, "lessons.sh");
const home = realpathSync(mkdtempSync(join(tmpdir(), "lessons-home-")));
const outside = realpathSync(mkdtempSync(join(tmpdir(), "lessons-out-")));
afterAll(() => {
	rmSync(home, { recursive: true, force: true });
	rmSync(outside, { recursive: true, force: true });
});

function write(path: string, text: string) {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, text);
}

function run(cwd: string) {
	mkdirSync(cwd, { recursive: true });
	const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: join(home, "agent") };
	return spawnSync("sh", [script], { cwd, env, encoding: "utf8" }).stdout;
}

write(join(home, "agent/pstack-lessons/poteto-mode/SKILL.md"), "user lesson");
write(join(home, ".agents/pstack-lessons/how/SKILL.md"), "home lesson");
write(join(home, "ws/.agents/pstack-lessons/how/SKILL.md"), "workspace lesson");
mkdirSync(join(home, "ws/repo/sub"), { recursive: true });
mkdirSync(join(home, "solo/sub"), { recursive: true });
spawnSync("git", ["init", "-q"], { cwd: join(home, "ws/repo") });
spawnSync("git", ["init", "-q"], { cwd: join(home, "solo") });

test("a repo inside a workspace uses the workspace layer above it", () => {
	const out = run(join(home, "ws/repo/sub"));
	expect(out).toContain(`project layer: ${home}/ws/.agents/pstack-lessons\n`);
	expect(out).toContain("== project lesson for how/SKILL.md\nworkspace lesson");
	expect(out).toContain("== user lesson for poteto-mode/SKILL.md\nuser lesson");
});

test("with no layer above, a repo gets one at its main checkout", () => {
	expect(run(join(home, "solo/sub"))).toContain(
		`project layer: ${home}/solo/.agents/pstack-lessons (not created yet)`,
	);
});

test("the home directory is never a project layer", () => {
	const out = run(home);
	expect(out).toContain("project layer: none");
	expect(out).not.toContain("home lesson");
});

test("outside home, the starting directory gets the layer", () => {
	expect(run(outside)).toContain(`project layer: ${outside}/.agents/pstack-lessons (not created yet)`);
});

test("a symlinked .agents reaches the shared layer", () => {
	write(join(home, "shared/.agents/pstack-lessons/x/a.md"), "shared lesson");
	mkdirSync(join(home, "copy"));
	symlinkSync(join(home, "shared/.agents"), join(home, "copy/.agents"));
	expect(run(join(home, "copy"))).toContain("== project lesson for x/a.md\nshared lesson");
});

test("--create makes the layer and excludes it from git", async () => {
	const repo = join(home, "fresh");
	mkdirSync(repo);
	spawnSync("git", ["init", "-q"], { cwd: repo });
	const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: join(home, "agent") };
	for (let i = 0; i < 2; i++) spawnSync("sh", [script, "--create"], { cwd: repo, env });
	write(join(repo, ".agents/pstack-lessons/how/SKILL.md"), "repo lesson");
	expect(run(repo)).toContain(`project layer: ${repo}/.agents/pstack-lessons\n`);
	const status = spawnSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" }).stdout;
	expect(status).toBe("");
	const exclude = Bun.file(join(repo, ".git/info/exclude"));
	expect((await exclude.text()).split("\n").filter((l) => l === ".agents/pstack-lessons/")).toHaveLength(1);
});
