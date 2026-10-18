import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, expect, test } from "bun:test";

const script = join(import.meta.dir, "integrations.sh");
const pkg = realpathSync(join(import.meta.dir, "../integrations/recipes"));
const home = realpathSync(mkdtempSync(join(tmpdir(), "integrations-home-")));
const user = join(home, "agent/pstack/integrations");
afterAll(() => rmSync(home, { recursive: true, force: true }));

function write(path: string, text: string) {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, text);
}

function layer(dir: string) {
	return join(dir, ".pi/pstack/integrations");
}

function git(cwd: string, ...args: string[]) {
	return spawnSync("git", args, { cwd, encoding: "utf8" }).stdout;
}

function repo(dir: string, remote?: string) {
	mkdirSync(dir, { recursive: true });
	git(dir, "init", "-q");
	if (remote) git(dir, "remote", "add", "origin", remote);
	return dir;
}

// A stub `ssh -G <host>`: two aliases point at GitHub, every other host maps to itself.
const bin = join(home, "bin");
write(
	join(bin, "ssh"),
	'#!/bin/sh\ncase $2 in github-work) echo "hostname github.com" ;; gh443) echo "hostname ssh.github.com" ;; *) echo "hostname $2" ;; esac\n',
);
chmodSync(join(bin, "ssh"), 0o755);

function run(cwd: string, args: string[] = []) {
	mkdirSync(cwd, { recursive: true });
	const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: join(home, "agent"), PATH: `${bin}:${process.env.PATH}` };
	return spawnSync("sh", [script, ...args], { cwd, env, encoding: "utf8" });
}

// The block a key prints: from its `== <key>:` line up to the next blank line.
function block(out: string, key: string) {
	const start = out.indexOf(`\n== ${key}: `);
	expect(start).toBeGreaterThan(-1);
	const end = out.indexOf("\n\n", start + 1);
	return out.slice(start + 1, end === -1 ? undefined : end).trimEnd();
}

write(join(user, "bindings.md"), "## tracker\nrecipe: user-jira\nUser tracker.\n\n## chat\nnone\nNo team chat.\n");
write(join(user, "recipes/user-jira.md"), "## search\n");
write(join(user, "recipes/user-only.md"), "## create\n");

test("the nearest layer wins per key, and other keys fall through to farther layers and the user layer", () => {
	const ws = join(home, "near/ws");
	write(join(layer(ws), "bindings.md"), "## forge\nrecipe: far-forge\n\n## tracker\nrecipe: ws-jira\nProject PLAT.\n");
	write(join(layer(ws), "recipes/ws-jira.md"), "## search\n");
	const r = repo(join(ws, "repo"), "https://bitbucket.example.com/scm/plat/app.git");
	write(join(layer(r), "bindings.md"), "## forge\nrecipe: bitbucket\nMCP server `bitbucket`.\n");
	write(join(layer(r), "recipes/bitbucket.md"), "## create\n");
	const out = run(join(r, "sub")).stdout;
	expect(out).toContain(`project layers, nearest first:\n  ${layer(r)}\n  ${layer(ws)}\n`);
	expect(block(out, "forge")).toBe(
		`== forge: bound\nfrom: ${layer(r)}/bindings.md\nrecipe: bitbucket at ${layer(r)}/recipes/bitbucket.md\nMCP server \`bitbucket\`.`,
	);
	expect(block(out, "tracker")).toBe(
		`== tracker: bound\nfrom: ${layer(ws)}/bindings.md\nrecipe: ws-jira at ${layer(ws)}/recipes/ws-jira.md\nProject PLAT.`,
	);
	expect(block(out, "chat")).toBe(`== chat: none\nfrom: ${user}/bindings.md\nNo team chat.`);
	expect(block(out, "ci")).toBe(ciSameAsForge);
});

const ciSameAsForge =
	"== ci: same as forge\nNo layer binds ci, so the forge recipe's `checks`, `logs`, and `rerun` sections serve CI.";

test("ci with no binding falls back to the forge, and a ci binding still wins", () => {
	const r = repo(join(home, "ci-fallback"), "https://github.com/o/r.git");
	expect(block(run(r).stdout, "ci")).toBe(ciSameAsForge);
	write(join(layer(r), "bindings.md"), "## ci\nrecipe: user-only\nJenkins.\n");
	expect(block(run(r).stdout, "ci")).toBe(
		`== ci: bound\nfrom: ${layer(r)}/bindings.md\nrecipe: user-only at ${user}/recipes/user-only.md\nJenkins.`,
	);
});

test("a github.com remote, https or ssh, or an ssh alias for GitHub gives the package default forge", () => {
	for (const remote of [
		"https://github.com/o/r.git",
		"git@github.com:o/r.git",
		"ssh://git@github.com/o/r.git",
		"git@github-work:o/r.git",
		"ssh://git@gh443:443/o/r.git",
	]) {
		const r = repo(join(home, "gh", remote.replace(/\W/g, "")), remote);
		expect(block(run(r).stdout, "forge")).toBe(
			`== forge: package default\nrecipe: github-gh at ${pkg}/github-gh.md\n` +
				"The remote is on github.com and no layer binds forge. If `command -v origin` succeeds and " +
				`\`origin pr list --limit 1\` works in this repository, use the origin recipe at ${pkg}/origin.md instead.`,
		);
	}
});

test("a non-GitHub remote, a non-GitHub ssh alias, a lookalike host, or no remote leaves forge unbound", () => {
	for (const remote of [
		"git@bitbucket.org:o/r.git",
		"git@bitbucket-work:o/r.git",
		"https://github.com.evil.example/o/r.git",
		"https://github-work/o/r.git",
		undefined,
	]) {
		const r = repo(join(home, "nogh", (remote ?? "none").replace(/\W/g, "")), remote);
		expect(block(run(r).stdout, "forge")).toBe("== forge: unbound");
	}
	expect(block(run(join(home, "plain")).stdout, "forge")).toBe("== forge: unbound");
});

test("a forge binding beats the package default", () => {
	const r = repo(join(home, "bound-gh"), "https://github.com/o/r.git");
	write(join(layer(r), "bindings.md"), "## forge\nrecipe: origin\n");
	expect(block(run(r).stdout, "forge")).toBe(
		`== forge: bound\nfrom: ${layer(r)}/bindings.md\nrecipe: origin at ${pkg}/origin.md`,
	);
});

test("a recipe is found in the project before the user layer before the package", () => {
	const r = repo(join(home, "lookup"));
	write(join(layer(r), "bindings.md"), "## forge\nrecipe: github-gh\n\n## ci\nrecipe: user-only\n");
	write(join(layer(r), "recipes/github-gh.md"), "## create\n");
	const out = run(r).stdout;
	expect(block(out, "forge")).toContain(`recipe: github-gh at ${layer(r)}/recipes/github-gh.md`);
	expect(block(out, "ci")).toContain(`recipe: user-only at ${user}/recipes/user-only.md`);
});

test("a missing recipe, a bad first line, and a path-like name are reported, not resolved", () => {
	const r = repo(join(home, "broken"));
	write(join(layer(r), "bindings.md"), "## forge\nrecipe: nowhere\n\n## ci\nJenkins at ci.example\n\n## docs\nrecipe: ../x\n");
	const out = run(r).stdout;
	expect(block(out, "forge")).toBe(
		`== forge: recipe missing\nfrom: ${layer(r)}/bindings.md\nrecipe: nowhere, but no layer or the package has recipes/nowhere.md`,
	);
	expect(block(out, "ci")).toStartWith(`== ci: invalid\nfrom: ${layer(r)}/bindings.md\n`);
	expect(block(out, "ci")).toContain("Jenkins at ci.example");
	expect(block(out, "docs")).toStartWith(`== docs: invalid\nfrom: ${layer(r)}/bindings.md\n`);
	expect(block(out, "docs")).toContain('"../x"');
	for (const key of ["forge", "ci", "docs"]) expect(block(out, key)).not.toMatch(/^recipe: .* at /m);
});

test("an unknown heading warns with its file and is ignored", () => {
	const r = repo(join(home, "unknown"));
	write(join(layer(r), "bindings.md"), "## jira\nrecipe: jira\n\n## ci\nnone\n");
	const out = run(r).stdout;
	expect(out).toContain(`warning: ${layer(r)}/bindings.md: unknown heading "## jira" ignored`);
	expect(out).not.toContain("== jira");
	expect(block(out, "ci")).toStartWith("== ci: none");
});

test("key arguments filter the keys, and an unknown key exits 2 naming the valid keys", () => {
	const out = run(join(home, "plain"), ["chat", "forge"]).stdout;
	expect(out.match(/^== .*/gm)).toEqual(["== forge: unbound", `== chat: none`]);
	const bad = run(join(home, "plain"), ["forge", "pager"]);
	expect(bad.status).toBe(2);
	expect(bad.stdout).toBe("");
	expect(bad.stderr).toContain("forge ci review-bots tracker chat docs observability errors analytics");
});

test("from a linked worktree, the main checkout's layer is read and is the write target", () => {
	const main = repo(join(home, "wt-main"));
	git(main, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
	git(main, "worktree", "add", "-q", join(home, "wt-linked"));
	write(join(layer(main), "bindings.md"), "## ci\nnone\nNo CI.\n");
	const out = run(join(home, "wt-linked")).stdout;
	expect(out).toContain(`project write target: ${layer(main)}\n`);
	expect(block(out, "ci")).toBe(`== ci: none\nfrom: ${layer(main)}/bindings.md\nNo CI.`);
});

test("--create writes the target at the repository root even under a parent layer, excluded once", () => {
	const parent = join(home, "shared");
	write(join(layer(parent), "bindings.md"), "## chat\nnone\n");
	const r = repo(join(parent, "repo"));
	expect(run(join(r, "sub")).stdout).toContain(`project write target: ${layer(r)} (not created yet)\n`);
	for (let i = 0; i < 2; i++) expect(run(join(r, "sub"), ["--create"]).status).toBe(0);
	expect(run(join(r, "sub")).stdout).toContain(`project layers, nearest first:\n  ${layer(r)}\n  ${layer(parent)}\n`);
	write(join(layer(r), "bindings.md"), "## ci\nnone\n");
	expect(git(r, "status", "--porcelain")).toBe("");
	const lines = readFileSync(join(r, ".git/info/exclude"), "utf8").split("\n");
	expect(lines.filter((l: string) => l === "/.pi/pstack/")).toHaveLength(1);
});

const skills = realpathSync(join(import.meta.dir, "../.."));
const notYetMigrated = [
	"poteto-mode/playbooks/autopilot-full.md",
	"poteto-mode/playbooks/autopilot-stack.md",
	"poteto-mode/playbooks/babysit.md",
	"poteto-mode/playbooks/multi-phase-plan.md",
	"poteto-mode/playbooks/shipping.md",
	"why/SKILL.md",
];

test("forge commands live only in recipes, and the not-yet-migrated list only shrinks", () => {
	const forgeCommand = /\bgh (pr|api)\b|\borigin pr\b/;
	const matching = (readdirSync(skills, { recursive: true }) as string[])
		.filter((f) => f.endsWith(".md") && !f.startsWith("poteto-mode/integrations/recipes/") && !f.includes("node_modules"))
		.filter((f) => forgeCommand.test(readFileSync(join(skills, f), "utf8")))
		.sort();
	expect(matching.filter((f) => !notYetMigrated.includes(f))).toEqual([]);
	expect(notYetMigrated.filter((f) => !matching.includes(f))).toEqual([]);
});
