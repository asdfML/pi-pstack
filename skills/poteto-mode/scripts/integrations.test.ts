import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

// A stub `ssh -G [user@]<host>`: two aliases point at GitHub, forge-ctx too except for the user git,
// as a `Match originalhost forge-ctx user git` block would, and every other host maps to itself.
const bin = join(home, "bin");
write(
	join(bin, "ssh"),
	'#!/bin/sh\n[ "$2" = git@forge-ctx ] && { echo "hostname bitbucket.example"; exit; }\n' +
		'case ${2##*@} in github-work | forge-ctx) echo "hostname github.com" ;; gh443) echo "hostname ssh.github.com" ;; *) echo "hostname ${2##*@}" ;; esac\n',
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
		"https://user:token@github.com:443/o/r.git",
		"https://GitHub.com/o/r.git",
		"git@github.com:o/r.git",
		"ssh://git@github.com/o/r.git",
		"git@github-work:o/r.git",
		"ssh://git@gh443:443/o/r.git",
		"me@forge-ctx:o/r.git",
		"git@GitHub.com:o/r.git",
		"git+ssh://git@github.com/o/r.git",
		"ssh+git://git@github.com/o/r.git",
		"ssh://git@evil.example?@github.com/o/r",
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
		"https://github.com:token@bitbucket.example/o/r.git",
		"ssh://github.com@bitbucket.example/o/r.git",
		"https://evil.example?@github.com/o/r",
		"https://evil.example#@github.com/o/r",
		"ssh://git@github.com?@evil.example/o/r",
		"git@forge-ctx:o/r.git",
		"ssh://git@forge-ctx:22/o/r.git",
		undefined,
	]) {
		const r = repo(join(home, "nogh", (remote ?? "none").replace(/\W/g, "")), remote);
		expect(block(run(r).stdout, "forge")).toBe("== forge: unbound");
	}
	expect(block(run(join(home, "plain")).stdout, "forge")).toBe("== forge: unbound");
	const dash = repo(join(home, "nogh", "dashuser"));
	writeFileSync(join(dash, ".git/config"), readFileSync(join(dash, ".git/config"), "utf8") + '[remote "origin"]\n\turl = -F/x@github-work:o/r\n');
	expect(git(dash, "remote", "get-url", "origin")).toBe("-F/x@github-work:o/r\n");
	expect(block(run(dash).stdout, "forge")).toBe("== forge: unbound");
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

test("why's source playbooks resolve by name after the package, and a layer's recipe of that name wins", () => {
	const why = realpathSync(join(import.meta.dir, "../../why/references/sources"));
	const r = repo(join(home, "why-sources"));
	write(join(layer(r), "bindings.md"), "## chat\nrecipe: slack\nWorkspace acme.\n\n## tracker\nrecipe: linear\n\n## docs\nrecipe: notion\n");
	write(join(layer(r), "recipes/linear.md"), "## search\n");
	write(join(user, "recipes/notion.md"), "## search\n");
	const out = run(r).stdout;
	expect(block(out, "chat")).toBe(
		`== chat: bound\nfrom: ${layer(r)}/bindings.md\nrecipe: slack at ${why}/slack.md\nWorkspace acme.`,
	);
	expect(block(out, "tracker")).toContain(`recipe: linear at ${layer(r)}/recipes/linear.md`);
	expect(block(out, "docs")).toContain(`recipe: notion at ${user}/recipes/notion.md`);
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
	const odd = repo(join(home, "unknown\\n\\c"));
	write(join(layer(odd), "bindings.md"), "## jira\n");
	expect(run(odd).stdout).toContain(`warning: ${layer(odd)}/bindings.md: unknown heading "## jira" ignored`);
});

test("--create keeps the user's last exclude line when the file has no final newline", () => {
	const r = repo(join(home, "no-newline"));
	writeFileSync(join(r, ".git/info/exclude"), "*.log");
	expect(run(r, ["--create"]).status).toBe(0);
	write(join(layer(r), "bindings.md"), "## forge\nnone\n");
	write(join(r, "a.log"), "");
	expect(git(r, "status", "--porcelain", "--untracked-files=all")).toBe("");
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

const evil = "## forge\nrecipe: evil\n";

// A repository whose own branch supplies .pi/pstack/integrations in one of the ways a checkout can.
const branchShapes: Record<string, (r: string) => void> = {
	"tracked files": (r) => {
		write(join(layer(r), "bindings.md"), evil);
		git(r, "add", "-f", ".pi");
	},
	"a tracked .pi symlink to an untracked folder": (r) => {
		write(join(r, "payload/pstack/integrations/bindings.md"), evil);
		symlinkSync("payload", join(r, ".pi"));
		git(r, "add", "-f", ".pi");
	},
	"a tracked .pi symlink to a folder outside the repository": (r) => {
		write(join(r + "-outside/pstack/integrations/bindings.md"), evil);
		symlinkSync(r + "-outside", join(r, ".pi"));
		git(r, "add", "-f", ".pi");
	},
	"a case variant of .pi": (r) => {
		write(join(r, ".PI/pstack/integrations/bindings.md"), evil);
		git(r, "add", "-f", ".PI");
	},
	"a submodule at .pi": (r) => {
		write(join(layer(r), "bindings.md"), evil);
		git(join(r, ".pi"), "init", "-q");
		git(join(r, ".pi"), "add", "-A");
		git(join(r, ".pi"), "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "x");
		git(r, "add", ".pi");
	},
	"tracked files deleted from the disk": (r) => {
		write(join(layer(r), "bindings.md"), evil);
		git(r, "add", "-f", ".pi");
		rmSync(join(r, ".pi"), { recursive: true });
	},
	"a local .pi symlink to tracked files deleted from the disk": (r) => {
		write(join(r, "config/pstack/integrations/bindings.md"), evil);
		git(r, "add", "-f", "config");
		symlinkSync("config", join(r, ".pi"));
		rmSync(join(r, "config/pstack"), { recursive: true });
	},
};

for (const [shape, make] of Object.entries(branchShapes)) {
	test(`a layer the project's git supplies through ${shape} is not read, written, or created`, () => {
		const r = repo(join(home, "branch", shape.replace(/\W+/g, "-")));
		make(r);
		const out = run(r);
		expect(block(out.stdout, "forge")).toBe("== forge: unbound");
		expect(out.stdout).toContain(`project write target: none, because git tracks ${layer(r)}\n`);
		const created = run(r, ["--create"]);
		expect(created.status).toBe(1);
		expect(created.stdout).toContain(`project write target: none, because git tracks ${layer(r)}\n`);
		if (shape.includes("deleted")) expect(existsSync(layer(r))).toBe(false);
	});
}

test("a skipped layer warns, and the project's layer is read again once git stops tracking it", () => {
	const r = repo(join(home, "untrack"));
	branchShapes["tracked files"](r);
	expect(run(r).stderr).toContain(`warning: ${layer(r)} skipped because git tracks it\n`);
	git(r, "rm", "-rq", "--cached", ".pi");
	write(join(layer(r), "recipes/evil.md"), "## merge\n");
	expect(block(run(r).stdout, "forge")).toBe(`== forge: bound\nfrom: ${layer(r)}/bindings.md\nrecipe: evil at ${layer(r)}/recipes/evil.md`);
});

test("a symlink the user made to files this project tracks is skipped like the files themselves", () => {
	const r = repo(join(home, "local-link-tracked"));
	write(join(r, "config/pstack/integrations/bindings.md"), evil);
	git(r, "add", "-f", "config");
	symlinkSync("config", join(r, ".pi"));
	expect(block(run(r).stdout, "forge")).toBe("== forge: unbound");
	expect(run(r, ["--create"]).status).toBe(1);
});

test("--create through a local .pi symlink into this repository keeps the real folder out of git", () => {
	const r = repo(join(home, "local-link-new"));
	write(join(r, "config/settings.json"), "{}");
	git(r, "add", "config");
	symlinkSync("config", join(r, ".pi"));
	expect(run(r, ["--create"]).status).toBe(0);
	write(join(layer(r), "bindings.md"), "## forge\nnone\n");
	expect(git(r, "status", "--porcelain")).not.toContain("pstack");
});

test("worktree-audit.sh resolves the forge from the starting directory, or from the repository it names, relative or not", () => {
	const r = repo(join(home, "audit"));
	git(r, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
	write(join(layer(r), "bindings.md"), "## forge\nrecipe: origin\n");
	write(join(r, "sub/.pi/pstack/integrations/bindings.md"), "## forge\nnone\n");
	const marker = join(home, "origin-ran");
	write(join(bin, "origin"), `#!/bin/sh\ntouch ${marker}\n`);
	chmodSync(join(bin, "origin"), 0o755);
	const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: join(home, "agent"), PATH: `${bin}:${process.env.PATH}` };
	const audit = join(import.meta.dir, "worktree-audit.sh");
	spawnSync("bash", [audit, "-b", "HEAD"], { cwd: join(r, "sub"), env, encoding: "utf8" });
	expect(existsSync(marker)).toBe(false);
	spawnSync("bash", [audit, "-b", "HEAD", "audit"], { cwd: home, env, encoding: "utf8" });
	rmSync(join(bin, "origin"));
	expect(existsSync(marker)).toBe(true);
});

test("--create through a layer symlink into this repository keeps the layer's real folder out of git", () => {
	const r = repo(join(home, "layer-link"));
	mkdirSync(join(r, "local-integrations"));
	mkdirSync(join(r, ".pi/pstack"), { recursive: true });
	symlinkSync("../../local-integrations", layer(r));
	expect(run(r, ["--create"]).status).toBe(0);
	write(join(layer(r), "bindings.md"), "## forge\nnone\n");
	expect(git(r, "status", "--porcelain", "--untracked-files=all")).toBe("");
});

test("--create fails when it cannot keep the layer out of git", () => {
	const r = repo(join(home, "ro-exclude"));
	chmodSync(join(r, ".git/info/exclude"), 0o444);
	const out = run(r, ["--create"]);
	expect(out.status).toBe(1);
	expect(out.stdout).toContain(`project write target: none, because ${layer(r)} could not be created and kept out of git\n`);
});

test("--create refuses a layer whose real folder is the work tree's root", () => {
	const r = repo(join(home, "layer-root-link"));
	mkdirSync(join(r, ".pi/pstack"), { recursive: true });
	symlinkSync("../..", layer(r));
	const out = run(r, ["--create"]);
	expect(out.status).toBe(1);
	expect(out.stdout).toContain("project write target: none, because");
	expect(readFileSync(join(r, ".git/info/exclude"), "utf8").split("\n")).not.toContain("/");
});

test("--create keeps a real folder whose name holds pattern characters out of git", () => {
	const r = repo(join(home, "glob-link"));
	mkdirSync(join(r, "config[1]*?\\n\\c\\"));
	symlinkSync("config[1]*?\\n\\c\\", join(r, ".pi"));
	const out = run(r, ["--create"]);
	expect(out.status).toBe(0);
	expect(out.stdout).toContain(`project write target: ${layer(r)}\n`);
	write(join(layer(r), "bindings.md"), "## forge\nnone\n");
	expect(git(r, "status", "--porcelain", "--untracked-files=all")).not.toContain("pstack");
});

test("--create through a .pi/pstack symlink to the repository root keeps the layer out of git", () => {
	const r = repo(join(home, "root-link"));
	mkdirSync(join(r, ".pi"));
	symlinkSync("..", join(r, ".pi/pstack"));
	expect(run(r, ["--create"]).status).toBe(0);
	write(join(layer(r), "bindings.md"), "## forge\nnone\n");
	expect(git(r, "status", "--porcelain", "--untracked-files=all")).not.toContain("integrations");
});

test("a .pi symlink into .git is read, since nothing in .git is in a work tree", () => {
	const r = repo(join(home, "git-link"));
	write(join(r, ".git/pi-local/pstack/integrations/bindings.md"), "## forge\nnone\n");
	symlinkSync(".git/pi-local", join(r, ".pi"));
	expect(block(run(r).stdout, "forge")).toBe(`== forge: none\nfrom: ${layer(r)}/bindings.md`);
});

test("from inside a submodule, the superproject's committed layer is skipped and the write target sits under the superproject's .git/modules", () => {
	const src = repo(join(home, "lib-src"));
	git(src, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
	const sup = repo(join(home, "super"));
	write(join(layer(sup), "bindings.md"), evil);
	git(sup, "add", "-f", ".pi");
	git(sup, "-c", "protocol.file.allow=always", "submodule", "add", "-q", src, "lib");
	const lib = join(sup, "lib");
	const out = run(lib, ["--create"]);
	expect(block(out.stdout, "forge")).toBe("== forge: unbound");
	expect(out.stderr).toContain(`warning: ${layer(sup)} skipped because git tracks it\n`);
	const target = join(sup, ".git/modules/.pi/pstack/integrations");
	expect(out.stdout).toContain(`project write target: ${target}\n`);
	write(join(target, "bindings.md"), "## forge\nnone\n");
	expect(block(run(lib).stdout, "forge")).toBe(`== forge: none\nfrom: ${target}/bindings.md`);
});

test("layers another repository tracks stay the user's: a dotfiles symlink, a nested repo, a versioned parent folder", () => {
	const mine = "## forge\nrecipe: mine\n";
	const dotfiles = repo(join(home, "dotfiles"));
	write(join(dotfiles, "proj/pstack/integrations/bindings.md"), mine);
	write(join(dotfiles, "proj/pstack/integrations/recipes/mine.md"), "## view\n");
	git(dotfiles, "add", "-A");
	const linked = repo(join(home, "uses-dotfiles"));
	symlinkSync(join(dotfiles, "proj"), join(linked, ".pi"));
	const out = run(linked);
	expect(block(out.stdout, "forge")).toContain("== forge: bound\n");
	expect(out.stdout).toContain(`project write target: ${layer(linked)}\n`);
	expect(out.stderr).not.toContain("warning");
	expect(run(linked, ["--create"]).status).toBe(0);
	write(join(dotfiles, "proj/pstack/integrations/new.md"), "x");
	expect(git(dotfiles, "status", "--porcelain")).toContain("proj/pstack/integrations/new.md");

	const nested = repo(join(home, "nested-config"));
	write(join(layer(nested), "bindings.md"), "## forge\nnone\n");
	git(join(nested, ".pi/pstack"), "init", "-q");
	git(join(nested, ".pi/pstack"), "add", "-A");
	expect(block(run(nested).stdout, "forge")).toBe(`== forge: none\nfrom: ${layer(nested)}/bindings.md`);
	expect(run(nested, ["--create"]).status).toBe(0);
	expect(git(nested, "status", "--porcelain")).toBe("");

	const parent = repo(join(home, "versioned-parent"));
	write(join(layer(parent), "bindings.md"), "## forge\nnone\n");
	git(parent, "add", "-f", ".pi");
	const child = repo(join(parent, "child"));
	expect(block(run(child).stdout, "forge")).toBe(`== forge: none\nfrom: ${layer(parent)}/bindings.md`);
});

test("from a linked worktree, a PR branch's committed layer is skipped and the main checkout's still wins", () => {
	const main = repo(join(home, "pr-main"));
	git(main, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
	git(main, "checkout", "-q", "-b", "pr");
	write(join(layer(main), "bindings.md"), evil);
	git(main, "add", "-f", ".pi");
	git(main, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "plant");
	git(main, "checkout", "-q", "-");
	write(join(layer(main), "bindings.md"), "## forge\nnone\n");
	const pr = join(home, "pr-head");
	git(main, "worktree", "add", "-q", pr, "pr");
	const out = run(pr);
	expect(block(out.stdout, "forge")).toBe(`== forge: none\nfrom: ${layer(main)}/bindings.md`);
	expect(out.stderr).toContain(`warning: ${layer(pr)} skipped because git tracks it\n`);
});

const skills = realpathSync(join(import.meta.dir, "../.."));

test("forge commands live only in recipes", () => {
	const forgeCommand = /\bgh (pr|api|run)\b|\borigin pr\b/;
	const matching = (readdirSync(skills, { recursive: true }) as string[])
		.filter((f) => f.endsWith(".md") && !f.startsWith("poteto-mode/integrations/recipes/") && !f.includes("node_modules"))
		.filter((f) => forgeCommand.test(readFileSync(join(skills, f), "utf8")));
	expect(matching).toEqual([]);
});
