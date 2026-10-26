import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, expect, test } from "bun:test";
import { LESSON_HEADER, LESSONS_END, LESSONS_START } from "../../../extensions/lessons-compaction.ts";

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

write(join(home, "agent/pstack/lessons/poteto-mode/SKILL.md"), "user lesson");
write(join(home, ".pi/pstack/lessons/how/SKILL.md"), "home lesson");
write(join(home, "ws/.pi/pstack/lessons/how/SKILL.md"), "workspace lesson");
write(join(home, "ws/repo/.pi/pstack/lessons/how/SKILL.md"), "repo lesson");
mkdirSync(join(home, "ws/repo/sub"), { recursive: true });
mkdirSync(join(home, "solo/sub"), { recursive: true });
git(join(home, "ws/repo"), "init", "-q");
git(join(home, "solo"), "init", "-q");

test("every layer up to home is read, nearer layers last, and the nearest is the write target", () => {
	const out = run(join(home, "ws/repo/sub")).stdout;
	expect(out).toContain(`project write target: ${home}/ws/repo/.pi/pstack/lessons\n`);
	const user = out.indexOf("user lesson");
	const workspace = out.indexOf("workspace lesson");
	const repo = out.indexOf("repo lesson");
	expect(user).toBeGreaterThan(-1);
	expect(workspace).toBeGreaterThan(user);
	expect(repo).toBeGreaterThan(workspace);
	expect(out).not.toContain("home lesson");
});

test("the compaction extension finds a run by its first and last lines, a whole one by its header, and not in the script's own source", () => {
	const out = run(join(home, "ws/repo/sub")).stdout;
	expect(out.match(LESSONS_START)?.index).toBe(0);
	// The lesson files end without a newline, and the end line still stands on its own, last.
	expect(out.trimEnd().split("\n").at(-1)).toMatch(LESSONS_END);
	const source = readFileSync(script, "utf8");
	expect(source).not.toMatch(LESSONS_START);
	expect(source).not.toMatch(LESSONS_END);
});

test("a lesson line that would pass for one of the script's own is indented, so only the script's own lines start a line", () => {
	const lessons = join(home, "agent/pstack/lessons/how");
	mkdirSync(lessons, { recursive: true });
	const own = ["user layer: /x", "project write target: none", "Lessons follow in rising priority: x", "== lesson for x", "== end of lessons"];
	writeFileSync(join(lessons, "SKILL.md"), `QUOTING\n${own.join("\n")}\n`);
	try {
		const out = run(join(home, "ws/repo/sub")).stdout;
		for (const line of own) expect(out).toContain(`\n ${line}\n`);
		expect(out.match(/^== end of lessons$/gm)).toHaveLength(1);
		expect(out.match(new RegExp(LESSONS_START, "g"))).toHaveLength(1);
	} finally {
		rmSync(lessons, { recursive: true, force: true });
	}
});

test("the compaction extension tells a run that printed lessons from one that printed none", () => {
	expect(run(join(home, "ws/repo/sub")).stdout).toMatch(LESSON_HEADER);
	const none = run(outside, [], join(outside, "agent")).stdout;
	expect(none).toMatch(LESSONS_START);
	expect(none).toMatch(LESSONS_END);
	expect(none).not.toMatch(LESSON_HEADER);
});

test("with no layer above, a repo's write target is its main checkout", () => {
	expect(run(join(home, "solo/sub")).stdout).toContain(
		`project write target: ${home}/solo/.pi/pstack/lessons (not created yet)`,
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
	expect(run(outside).stdout).toContain(`project write target: ${outside}/.pi/pstack/lessons (not created yet)`);
});

test("a symlinked .pi reaches the shared layer", () => {
	write(join(home, "shared/.pi/pstack/lessons/x/a.md"), "shared lesson");
	mkdirSync(join(home, "copy"));
	symlinkSync(join(home, "shared/.pi"), join(home, "copy/.pi"));
	expect(run(join(home, "copy")).stdout).toContain("shared lesson");
});

test("a tilde in PI_CODING_AGENT_DIR expands like Pi does", () => {
	expect(run(outside, [], "~/agent").stdout).toContain(`user layer: ${home}/agent/pstack/lessons\n`);
});

test("--create makes the layer and excludes all of .pi/pstack from git, once", () => {
	const repo = join(home, "fresh");
	mkdirSync(repo);
	git(repo, "init", "-q");
	for (let i = 0; i < 2; i++) expect(run(repo, ["--create"]).status).toBe(0);
	write(join(repo, ".pi/pstack/lessons/how/SKILL.md"), "fresh lesson");
	write(join(repo, ".pi/pstack/store/trail.md"), "store file");
	expect(git(repo, "status", "--porcelain")).toBe("");
	const lines = readFileSync(join(repo, ".git/info/exclude"), "utf8").split("\n");
	expect(lines.filter((l: string) => l === "/.pi/pstack/")).toHaveLength(1);
});

test("--create excludes a nested layer at its own path", () => {
	const repo = join(home, "nested");
	write(join(repo, "sub/.pi/pstack/lessons/how/SKILL.md"), "nested lesson");
	git(repo, "init", "-q");
	expect(run(join(repo, "sub"), ["--create"]).status).toBe(0);
	expect(git(repo, "status", "--porcelain")).toBe("");
});

test("--create fails loudly when it cannot create the layer", () => {
	const locked = join(home, "locked");
	mkdirSync(locked);
	chmodSync(locked, 0o555);
	const failed = run(locked, ["--create"]);
	expect(failed.status).not.toBe(0);
	expect(failed.stdout).toMatch(LESSONS_START);
});

test("from a linked worktree, the write target is the main checkout, excluded there", () => {
	const main = join(home, "wt-main");
	mkdirSync(main);
	git(main, "init", "-q");
	git(main, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
	git(main, "worktree", "add", "-q", join(home, "wt-linked"));
	const out = run(join(home, "wt-linked"), ["--create"]).stdout;
	expect(out).toContain(`project write target: ${main}/.pi/pstack/lessons\n`);
	write(join(main, ".pi/pstack/lessons/how/SKILL.md"), "main lesson");
	expect(git(main, "status", "--porcelain")).toBe("");
	expect(run(join(home, "wt-linked")).stdout).toContain("main lesson");
});

test("a layer git tracks is never read, and the nearest layer left is the write target", () => {
	write(join(home, "work/.pi/pstack/lessons/x/a.md"), "parent lesson");
	const r = join(home, "work/tracked");
	write(join(r, ".pi/pstack/lessons/x/a.md"), "branch lesson");
	git(r, "init", "-q");
	git(r, "add", "-f", ".pi");
	for (const args of [[], ["--create"]]) {
		const out = run(r, args);
		expect(out.stdout).not.toContain("branch lesson");
		expect(out.stderr).toContain(`warning: ${r}/.pi/pstack/lessons skipped because git tracks it`);
		expect(out.stdout).toContain("parent lesson");
		expect(out.stdout).toContain(`project write target: ${home}/work/.pi/pstack/lessons\n`);
	}
	expect(run(r, ["--create"]).status).toBe(0);
});

test("with only a tracked layer in the repository, there is no write target and --create fails", () => {
	const r = join(home, "tracked-alone");
	write(join(r, ".pi/pstack/lessons/x/a.md"), "branch lesson");
	git(r, "init", "-q");
	git(r, "add", "-f", ".pi");
	const out = run(r, ["--create"]);
	expect(out.status).toBe(1);
	expect(out.stdout).not.toContain("branch lesson");
	expect(out.stdout).toContain(`project write target: none, because git tracks ${r}/.pi/pstack/lessons\n`);
});

test("an untracked layer nearer than a tracked root is read and is the write target", () => {
	const r = join(home, "tracked-root");
	write(join(r, ".pi/pstack/lessons/x/a.md"), "branch lesson");
	write(join(r, "pkg/.pi/pstack/lessons/x/a.md"), "package lesson");
	git(r, "init", "-q");
	git(r, "add", "-f", ".pi");
	const out = run(join(r, "pkg"), ["--create"]);
	expect(out.status).toBe(0);
	expect(out.stdout).toContain("package lesson");
	expect(out.stdout).not.toContain("branch lesson");
	expect(out.stdout).toContain(`project write target: ${r}/pkg/.pi/pstack/lessons\n`);
});
