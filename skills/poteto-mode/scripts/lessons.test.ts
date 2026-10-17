import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, expect, test } from "bun:test";

const script = join(import.meta.dir, "lessons.sh");
const home = realpathSync(mkdtempSync(join(tmpdir(), "lessons-home-")));
const outside = realpathSync(mkdtempSync(join(tmpdir(), "lessons-out-")));
afterAll(() => {
	chmodSync(join(home, "locked"), 0o755);
	rmSync(home, { recursive: true, force: true });
	rmSync(outside, { recursive: true, force: true });
});

function write(path: string, text: string) {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, text);
}

function git(cwd: string, ...args: string[]) {
	return spawnSync("git", args, { cwd, encoding: "utf8" }).stdout;
}

function run(cwd: string, args: string[] = [], agentDir = join(home, "agent")) {
	mkdirSync(cwd, { recursive: true });
	const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: agentDir };
	return spawnSync("sh", [script, ...args], { cwd, env, encoding: "utf8" });
}

write(join(home, "agent/pstack-lessons/poteto-mode/SKILL.md"), "user lesson");
write(join(home, ".agents/pstack-lessons/how/SKILL.md"), "home lesson");
write(join(home, "ws/.agents/pstack-lessons/how/SKILL.md"), "workspace lesson");
write(join(home, "ws/repo/.agents/pstack-lessons/how/SKILL.md"), "repo lesson");
mkdirSync(join(home, "ws/repo/sub"), { recursive: true });
mkdirSync(join(home, "solo/sub"), { recursive: true });
git(join(home, "ws/repo"), "init", "-q");
git(join(home, "solo"), "init", "-q");

test("every layer up to home is read, nearer layers last, and the nearest is the write target", () => {
	const out = run(join(home, "ws/repo/sub")).stdout;
	expect(out).toContain(`project write target: ${home}/ws/repo/.agents/pstack-lessons\n`);
	const user = out.indexOf("user lesson");
	const workspace = out.indexOf("workspace lesson");
	const repo = out.indexOf("repo lesson");
	expect(user).toBeGreaterThan(-1);
	expect(workspace).toBeGreaterThan(user);
	expect(repo).toBeGreaterThan(workspace);
	expect(out).not.toContain("home lesson");
});

test("with no layer above, a repo's write target is its main checkout", () => {
	expect(run(join(home, "solo/sub")).stdout).toContain(
		`project write target: ${home}/solo/.agents/pstack-lessons (not created yet)`,
	);
});

test("home, its ancestors, and a git repository at home are never project layers", () => {
	expect(run(home).stdout).toContain("project write target: none");
	expect(run("/").stdout).toContain("project write target: none");
	const dotfiles = realpathSync(mkdtempSync(join(tmpdir(), "lessons-dotfiles-")));
	git(dotfiles, "init", "-q");
	const env = { ...process.env, HOME: dotfiles };
	mkdirSync(join(dotfiles, "notes"));
	const out = spawnSync("sh", [script], { cwd: join(dotfiles, "notes"), env, encoding: "utf8" }).stdout;
	rmSync(dotfiles, { recursive: true, force: true });
	expect(out).toContain("project write target: none");
});

test("outside home, the starting directory is the write target", () => {
	expect(run(outside).stdout).toContain(`project write target: ${outside}/.agents/pstack-lessons (not created yet)`);
});

test("a symlinked .agents reaches the shared layer", () => {
	write(join(home, "shared/.agents/pstack-lessons/x/a.md"), "shared lesson");
	mkdirSync(join(home, "copy"));
	symlinkSync(join(home, "shared/.agents"), join(home, "copy/.agents"));
	expect(run(join(home, "copy")).stdout).toContain("shared lesson");
});

test("a tilde in PI_CODING_AGENT_DIR expands like Pi does", () => {
	expect(run(outside, [], "~/agent").stdout).toContain(`user layer: ${home}/agent/pstack-lessons\n`);
});

test("--create makes the layer and excludes it from git, once", () => {
	const repo = join(home, "fresh");
	mkdirSync(repo);
	git(repo, "init", "-q");
	for (let i = 0; i < 2; i++) expect(run(repo, ["--create"]).status).toBe(0);
	write(join(repo, ".agents/pstack-lessons/how/SKILL.md"), "fresh lesson");
	expect(git(repo, "status", "--porcelain")).toBe("");
	const lines = readFileSync(join(repo, ".git/info/exclude"), "utf8").split("\n");
	expect(lines.filter((l: string) => l === "/.agents/pstack-lessons/")).toHaveLength(1);
});

test("--create excludes a nested layer at its own path", () => {
	const repo = join(home, "nested");
	write(join(repo, "sub/.agents/pstack-lessons/how/SKILL.md"), "nested lesson");
	git(repo, "init", "-q");
	expect(run(join(repo, "sub"), ["--create"]).status).toBe(0);
	expect(git(repo, "status", "--porcelain")).toBe("");
});

test("--create fails loudly when it cannot create the layer", () => {
	const locked = join(home, "locked");
	mkdirSync(locked);
	chmodSync(locked, 0o555);
	expect(run(locked, ["--create"]).status).not.toBe(0);
});
