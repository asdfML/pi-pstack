import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import {
	createAgentSession, DefaultResourceLoader, discoverAndLoadExtensions, ExtensionRunner, ModelRuntime, SessionManager, SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { LESSONS_TYPE, SKILLS_DIR } from "./lessons-compaction.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "lessons-compaction-")));
const loaded = await discoverAndLoadExtensions([root], scratch, scratch);

const emptyOutput = "user layer: /agent/pstack/lessons\nproject write target: none\n" +
	"Lessons follow in rising priority: a later lesson wins over an earlier one for the same file.\n";
const lessonsOutput = (body: string) =>
	`${emptyOutput}\n== lesson for arena/SKILL.md from /agent/pstack/lessons\n## Probe lesson\n\n${body}\n`;

function fixture() {
	const manager = SessionManager.inMemory(scratch);
	const userId = manager.appendMessage({ role: "user", content: "Start", timestamp: 1 });
	const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, scratch, manager, undefined as never);
	const errors: unknown[] = [];
	runner.onError((error) => errors.push(error));
	const project = async (messages: any[] = manager.buildSessionContext().messages) => {
		const projected: any[] = await runner.emitContext(messages);
		expect(errors).toEqual([]);
		return projected;
	};
	let calls = 0;
	const tool = (name: string, text: string, isError = false) => {
		const id = `call-${++calls}`;
		const call = manager.appendMessage({ role: "assistant", timestamp: 10 + calls,
			content: [{ type: "toolCall", id, name, arguments: {} }] } as never);
		const result = manager.appendMessage({ role: "toolResult", toolName: name, toolCallId: id, isError,
			content: [{ type: "text", text }], timestamp: 10 + calls } as never);
		return { call, result };
	};
	const runLessons = (body: string | null = "PROBE-BODY", isError = false) =>
		tool("bash", body === null ? emptyOutput : lessonsOutput(body), isError);
	const user = (content: string) => manager.appendMessage({ role: "user", content, timestamp: 100 });
	return { manager, userId, project, tool, runLessons, user };
}
const isNotice = (m: any) => m.role === "custom" && m.customType === LESSONS_TYPE;
const notices = (messages: any[]) => messages.filter(isNotice);
const roles = (messages: any[]) => messages.map((m) => (isNotice(m) ? "notice" : m.role));

test("the package manifest loads this extension through Pi's loader", () => {
	expect(loaded.errors).toEqual([]);
	expect(loaded.extensions.map((extension) => extension.path)).toEqual([join(root, "extensions/lessons-compaction.ts")]);
	expect(loaded.extensions[0].handlers.has("context")).toBe(true);
});

const installed = join(process.env.PI_MANAGED_INSTALL_ROOT
	?? join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent"), "install"), "current-version");
const pins: Record<string, string> = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).devDependencies;
test.skipIf(!existsSync(installed))("the Pi these tests pin is the Pi installed here", () => {
	const pinned = pins["@earendil-works/pi-coding-agent"];
	const current = readFileSync(installed, "utf8").trim();
	if (current !== pinned) {
		throw new Error(`Pi ${current} is installed but the tests pin ${pinned}: bump it in package.json devDependencies and run bun install`);
	}
});

test("the tests import the pinned Pi", () => {
	for (const [name, pinned] of Object.entries(pins)) {
		const imported = JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")).version;
		if (imported !== pinned) throw new Error(`node_modules has ${name} ${imported} but package.json pins ${pinned}: run bun install`);
	}
});

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
	expect(notice.content).toContain("run from before the compaction may be gone");
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

test("a run that printed no lessons gives no notice, and an empty rerun keeps the old lessons from coming back", async () => {
	const empty = fixture();
	empty.runLessons(null);
	empty.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await empty.project())).toHaveLength(0);

	const emptiedBefore = fixture();
	emptiedBefore.runLessons();
	emptiedBefore.runLessons(null);
	emptiedBefore.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await emptiedBefore.project())).toHaveLength(0);

	const emptiedAfter = fixture();
	emptiedAfter.runLessons();
	emptiedAfter.manager.appendCompaction("Compacted", null, 1000);
	emptiedAfter.runLessons(null);
	expect(notices(await emptiedAfter.project())).toHaveLength(0);
});

// A real session, so the hook sees what Pi passes it: the session projection, after earlier extensions' handlers.
async function providerContext(manager: SessionManager, earlierHandler: string, customType: string) {
	const handlerPath = join(scratch, `${customType}-handler.ts`);
	writeFileSync(handlerPath, earlierHandler);
	const faux = fauxProvider();
	const seen: any[][] = [];
	faux.setResponses([(context) => {
		seen.push(context.messages);
		return fauxAssistantMessage("ok");
	}]);
	const modelRuntime = await ModelRuntime.create({ authPath: join(scratch, "auth.json"), modelsPath: null });
	modelRuntime.registerNativeProvider(faux.provider);
	const settingsManager = SettingsManager.inMemory();
	const resourceLoader = new DefaultResourceLoader({ cwd: scratch, agentDir: scratch, settingsManager,
		additionalExtensionPaths: [handlerPath, root], noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
	await resourceLoader.reload();
	const { session } = await createAgentSession({ cwd: scratch, agentDir: scratch, sessionManager: manager, modelRuntime,
		settingsManager, model: faux.getModel(), resourceLoader, tools: [] });
	await session.sendCustomMessage({ customType, content: "Continue", display: false }, { triggerTurn: true });
	await session.waitForIdle();
	session.dispose();
	expect(seen).toHaveLength(1);
	return seen[0].map((m) => {
		const text = typeof m.content === "string" ? m.content : m.content.map((c: any) => c.text ?? "").join("");
		return [text.startsWith("Context-maintenance notice") ? "notice" : m.role, text];
	});
}

test("in a session, a custom message an earlier handler wraps still comes after the notice", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendCompaction("Compacted", null, 1000);
	// The rewrite pi-subagents applies to its own custom messages; it loads before this package.
	const wrap = `export default (pi) => pi.on("context", (event) => ({ messages: event.messages.map((m) =>
		m.role === "custom" ? { ...m, content: "<pi_subagents_notice>" + m.content + "</pi_subagents_notice>" } : m) }));`;
	const context = await providerContext(h.manager, wrap, "subagent-compaction-resume");
	expect(context.map(([role]) => role)).toEqual(["system", "user", "notice", "user"]);
	expect(context[3][1]).toBe("<pi_subagents_notice>Continue</pi_subagents_notice>");
});

test("in a session, a tool result an earlier handler trims is not split from its call by the notice", async () => {
	const h = fixture();
	h.manager.appendCompaction("Compacted", h.runLessons().call, 1000);
	const trim = `export default (pi) => pi.on("context", (event) => ({ messages: event.messages.map((m) =>
		m.role === "toolResult" ? { ...m, content: [{ type: "text", text: "[trimmed]" }] } : m) }));`;
	const context = await providerContext(h.manager, trim, "goal_continuation");
	expect(context.map(([role]) => role)).toEqual(["system", "user", "assistant", "toolResult", "notice", "user"]);
	expect(context[3][1]).toBe("[trimmed]");
	expect(context[4][1]).toContain("PROBE-BODY");
});

test("new work another hook rewrote does not move the notice; with nothing kept recognizable it goes last", async () => {
	const h = fixture();
	const { call } = h.runLessons();
	h.manager.appendCompaction("Compacted", call, 1000);
	h.user("Continue");
	const rewritten = h.manager.buildSessionContext().messages.map((m: any) => (m.role === "user" ? { ...m, content: "Rewritten" } : m));
	expect(roles(await h.project(rewritten))).toEqual(["compactionSummary", "assistant", "toolResult", "notice", "user"]);
	const unrecognizable = h.manager.buildSessionContext().messages.map((m: any) => ({ ...m, timestamp: 0 }));
	expect(roles(await h.project(unrecognizable))).toEqual(["compactionSummary", "assistant", "toolResult", "user", "notice"]);
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

test("a run context_edit rewrote is skipped for an earlier intact one; with every run rewritten nothing comes back", async () => {
	const h = fixture();
	h.runLessons("FIRST-BODY");
	const { result } = h.runLessons("SECOND-BODY");
	h.manager.appendContextEdit(result, { content: "trimmed" });
	h.manager.appendCompaction("Compacted", null, 1000);
	const [notice] = notices(await h.project());
	expect(notice.content).toContain("FIRST-BODY");
	expect(notice.content).not.toContain("SECOND-BODY");

	const all = fixture();
	all.manager.appendContextEdit(all.runLessons("FIRST-BODY").result, { content: "trimmed" });
	all.manager.appendContextEdit(all.runLessons("SECOND-BODY").result, { content: "trimmed" });
	all.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await all.project())).toHaveLength(0);
});

test("a new checkpoint gets one notice after its own summary, from a run between the checkpoints; branch rollback removes it", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendCompaction("First", null, 1000);
	h.user("Continue");
	h.runLessons("BETWEEN-BODY");
	h.manager.appendCompaction("Second", null, 1000);
	const projected = await h.project();
	expect(roles(projected)).toEqual(["compactionSummary", "notice"]);
	expect(projected[0].summary).toBe("Second");
	expect(projected[1].content).toContain("BETWEEN-BODY");
	h.manager.branch(h.userId);
	expect(notices(await h.project())).toHaveLength(0);
});
