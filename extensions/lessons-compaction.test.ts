import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "bun:test";
import register, { LESSONS_TYPE, SKILLS_DIR } from "./lessons-compaction.ts";

const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
const version = readFileSync(join(agentDir, "install", "current-version"), "utf8").trim();
const host = join(agentDir, "install", "releases", version, "node_modules", "@earendil-works");
const { SessionManager } = await import(`${host}/pi-coding-agent/dist/core/session-manager.js`);
const { ExtensionRunner } = await import(`${host}/pi-coding-agent/dist/core/extensions/runner.js`);

const home = realpathSync(mkdtempSync(join(tmpdir(), "lessons-compaction-")));
const cwd = join(home, "project");
mkdirSync(join(home, "agent/pstack/lessons/arena"), { recursive: true });
mkdirSync(cwd);
writeFileSync(join(home, "agent/pstack/lessons/arena/SKILL.md"), "## Probe lesson\n\nPROBE-BODY\n");
process.env.HOME = home;
process.env.PI_CODING_AGENT_DIR = join(home, "agent");
afterAll(() => rmSync(home, { recursive: true, force: true }));

const LESSONS_OUTPUT = "user layer: x\nLessons follow in rising priority: a later lesson wins.\n";

function fixture() {
	const manager = SessionManager.inMemory(cwd);
	const userId = manager.appendMessage({ role: "user", content: "Start", timestamp: 1 });
	const handlers = new Map<string, Function[]>();
	register({ on(name: string, fn: Function) {
		handlers.set(name, [...(handlers.get(name) ?? []), fn]);
		return () => {};
	} } as never);
	const runner = new ExtensionRunner([{ path: "lessons-compaction", handlers }], {}, cwd, manager, {});
	runner.createContext = () => ({ cwd, model: { provider: "claude-bridge" }, sessionManager: manager });
	runner.emitError = (event: unknown) => { throw new Error(JSON.stringify(event)); };
	const project = (messages = manager.buildSessionProjection().messages) => runner.emitContext(messages);
	let calls = 0;
	const runLessons = ({ isError = false, text = LESSONS_OUTPUT } = {}) => {
		const id = `call-${++calls}`;
		const entry = manager.appendMessage({ role: "assistant", timestamp: 10 + calls,
			content: [{ type: "toolCall", id, name: "bash", arguments: { command: "sh lessons.sh" } }] });
		manager.appendMessage({ role: "toolResult", toolName: "bash", toolCallId: id, isError,
			content: [{ type: "text", text }], timestamp: 10 + calls });
		return entry;
	};
	return { manager, userId, project, runLessons };
}
const notices = (messages: any[]) => messages.filter((m) => m.role === "custom" && m.customType === LESSONS_TYPE);

test("plain session without lessons.sh gets nothing, before or after compaction", async () => {
	const h = fixture();
	expect(notices(await h.project())).toHaveLength(0);
	h.manager.appendCompaction("Compacted", undefined, 1000);
	expect(notices(await h.project())).toHaveLength(0);
});

test("lessons run without compaction is left alone", async () => {
	const h = fixture();
	h.runLessons();
	expect(notices(await h.project())).toHaveLength(0);
});

test("after compaction, the package's lessons.sh output lands right after the summary, once and request-local", async () => {
	const h = fixture();
	h.runLessons();
	const checkpoint = h.manager.appendCompaction("Compacted history", undefined, 1000);
	h.manager.appendMessage({ role: "user", content: "Continue", timestamp: 50 });
	const projected = await h.project();
	const [notice] = notices(projected);
	expect(projected[projected.findIndex((m: any) => m.role === "compactionSummary") + 1]).toBe(notice);
	expect(notice.content).toContain(checkpoint);
	expect(notice.content).toContain("== lesson for arena/SKILL.md");
	expect(notice.content).toContain("PROBE-BODY");
	expect(notice.content).toContain("only amends the pstack file");
	expect(notice.content).toContain(`${SKILLS_DIR}/`);
	expect(existsSync(join(SKILLS_DIR, "poteto-mode/SKILL.md"))).toBe(true);
	expect(notices(await h.project(projected))).toEqual([notice]);
	expect(JSON.stringify(h.manager.getEntries())).not.toContain(LESSONS_TYPE);
});

test("a rerun after the checkpoint is already live, so nothing is added", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendCompaction("Compacted", undefined, 1000);
	h.runLessons();
	expect(notices(await h.project())).toHaveLength(0);
});

test("a run kept in the retained tail still gets the notice, since Codex replay drops that tail", async () => {
	const h = fixture();
	const kept = h.runLessons();
	h.manager.appendCompaction("Compacted", kept, 1000);
	expect(notices(await h.project())).toHaveLength(1);
});

test("failed or unrecognized runs do not count", async () => {
	for (const options of [{ isError: true }, { text: "sh: lessons.sh: not found" }]) {
		const h = fixture();
		h.runLessons(options);
		h.manager.appendCompaction("Compacted", undefined, 1000);
		expect(notices(await h.project())).toHaveLength(0);
	}
});

test("a new checkpoint replaces the old notice; branch rollback removes it", async () => {
	const h = fixture();
	h.runLessons();
	const first = h.manager.appendCompaction("First", undefined, 1000);
	expect(notices(await h.project())[0].content).toContain(first);
	const second = h.manager.appendCompaction("Second", undefined, 1000);
	const next = notices(await h.project());
	expect(next).toHaveLength(1);
	expect(next[0].content).toContain(second);
	expect(next[0].content).not.toContain(first);
	h.manager.branch(h.userId);
	expect(notices(await h.project())).toHaveLength(0);
});
