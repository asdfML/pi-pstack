import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { ExtensionRunner, SessionManager } from "@earendil-works/pi-coding-agent";
import register, { LESSONS_TYPE, SKILLS_DIR } from "./lessons-compaction.ts";

const lessonsOutput = (body: string) => "user layer: /agent/pstack/lessons\nproject write target: none\n" +
	"Lessons follow in rising priority: a later lesson wins over an earlier one for the same file.\n\n" +
	`== lesson for arena/SKILL.md from /agent/pstack/lessons\n## Probe lesson\n\n${body}\n`;

function fixture() {
	const manager = SessionManager.inMemory("/project");
	const userId = manager.appendMessage({ role: "user", content: "Start", timestamp: 1 });
	const handlers = new Map<string, Function[]>();
	register({ on(name: string, fn: Function) {
		handlers.set(name, [...(handlers.get(name) ?? []), fn]);
		return () => {};
	} } as never);
	const runner = new ExtensionRunner([{ path: "lessons-compaction", handlers }] as never, {} as never, "/project", manager, {} as never);
	runner.createContext = () => ({ cwd: "/project", sessionManager: manager }) as never;
	runner.emitError = (event: unknown) => { throw new Error(JSON.stringify(event)); };
	const project = () => runner.emitContext(manager.buildSessionContext().messages);
	let calls = 0;
	const tool = (name: string, text: string, isError = false) => {
		const id = `call-${++calls}`;
		const call = manager.appendMessage({ role: "assistant", timestamp: 10 + calls,
			content: [{ type: "toolCall", id, name, arguments: {} }] } as never);
		const result = manager.appendMessage({ role: "toolResult", toolName: name, toolCallId: id, isError,
			content: [{ type: "text", text }], timestamp: 10 + calls } as never);
		return { call, result };
	};
	const runLessons = (body = "PROBE-BODY", isError = false) => tool("bash", lessonsOutput(body), isError);
	const user = (content: string) => manager.appendMessage({ role: "user", content, timestamp: 100 });
	return { manager, userId, project, tool, runLessons, user };
}
const isNotice = (m: any) => m.role === "custom" && m.customType === LESSONS_TYPE;
const notices = (messages: any[]) => messages.filter(isNotice);
const roles = (messages: any[]) => messages.map((m) => (isNotice(m) ? "notice" : m.role));

test("plain session without lessons.sh gets nothing, before or after compaction", async () => {
	const h = fixture();
	expect(notices(await h.project())).toHaveLength(0);
	h.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await h.project())).toHaveLength(0);
});

test("lessons run without compaction is left alone", async () => {
	const h = fixture();
	h.runLessons();
	expect(notices(await h.project())).toHaveLength(0);
});

test("after compaction, the last run's output comes back between the summary and new work, never persisted", async () => {
	const h = fixture();
	h.runLessons("OLD-BODY");
	h.runLessons();
	h.manager.appendCompaction("Compacted history", null, 1000);
	h.user("Continue");
	const projected = await h.project();
	expect(roles(projected)).toEqual(["compactionSummary", "notice", "user"]);
	const [notice] = notices(projected);
	expect(notice.content).toContain("== lesson for arena/SKILL.md");
	expect(notice.content).toContain("PROBE-BODY");
	expect(notice.content).not.toContain("OLD-BODY");
	expect(notice.content).toContain("only amends the pstack file");
	expect(notice.content).toContain(`${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`);
	expect(existsSync(join(SKILLS_DIR, "poteto-mode/scripts/lessons.sh"))).toBe(true);
	expect(JSON.stringify(h.manager.getEntries())).not.toContain(LESSONS_TYPE);
});

test("with nothing after the checkpoint yet, the notice goes last", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendCompaction("Compacted", null, 1000);
	expect(roles(await h.project())).toEqual(["compactionSummary", "notice"]);
});

test("a rerun after the checkpoint is already live, so nothing is added", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendCompaction("Compacted", null, 1000);
	h.runLessons();
	expect(notices(await h.project())).toHaveLength(0);
});

test("a run kept in the retained tail still gets the notice, placed after that tail", async () => {
	const h = fixture();
	const { call } = h.runLessons();
	h.manager.appendCompaction("Compacted", call, 1000);
	h.user("Continue");
	expect(roles(await h.project())).toEqual(["compactionSummary", "assistant", "toolResult", "notice", "user"]);
});

test("reading files that quote the header is not a run, before or after the checkpoint", async () => {
	const sources = [`${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`,
		new URL("./lessons-compaction.ts", import.meta.url), new URL("./lessons-compaction.test.ts", import.meta.url)]
		.map((path) => readFileSync(path, "utf8"));
	for (const source of sources) {
		expect(source).toContain("Lessons follow in rising priority");
		const before = fixture();
		before.tool("read", source);
		before.manager.appendCompaction("Compacted", null, 1000);
		expect(notices(await before.project())).toHaveLength(0);

		const after = fixture();
		after.runLessons();
		after.manager.appendCompaction("Compacted", null, 1000);
		after.tool("read", source);
		expect(notices(await after.project())).toHaveLength(1);
	}
});

test("a run that exits non-zero after printing the lessons counts; output without the header does not", async () => {
	const failed = fixture();
	failed.runLessons("CREATE-FAILED", true);
	failed.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await failed.project())[0].content).toContain("CREATE-FAILED");

	const unrecognized = fixture();
	unrecognized.tool("bash", "sh: lessons.sh: not found", true);
	unrecognized.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await unrecognized.project())).toHaveLength(0);
});

test("a rerun that context_edit omitted is not live; an omitted run never comes back", async () => {
	const omittedRerun = fixture();
	omittedRerun.runLessons();
	omittedRerun.manager.appendCompaction("Compacted", null, 1000);
	const { result } = omittedRerun.runLessons("RERUN-BODY");
	omittedRerun.manager.appendContextEdit(result, null);
	const [notice] = notices(await omittedRerun.project());
	expect(notice.content).toContain("PROBE-BODY");
	expect(notice.content).not.toContain("RERUN-BODY");

	const omittedOnly = fixture();
	omittedOnly.manager.appendContextEdit(omittedOnly.runLessons().result, null);
	omittedOnly.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await omittedOnly.project())).toHaveLength(0);
});

test("a new checkpoint gets one notice after its own summary; branch rollback removes it", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendCompaction("First", null, 1000);
	h.user("Continue");
	h.manager.appendCompaction("Second", null, 1000);
	const projected: any[] = await h.project();
	expect(roles(projected)).toEqual(["compactionSummary", "notice"]);
	expect(projected[0].summary).toBe("Second");
	h.manager.branch(h.userId);
	expect(notices(await h.project())).toHaveLength(0);
});
