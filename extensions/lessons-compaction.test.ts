import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "bun:test";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import {
	createAgentSession, createBashTool, DEFAULT_MAX_LINES, DefaultResourceLoader, discoverAndLoadExtensions, ExtensionRunner, ModelRuntime,
	SessionManager, SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { removeNativeCompactionRetainedMessages, rewriteResponsesPayloadWithNativeReplay } from "pi-openai-toolkit/src/payload-rewrite.ts";
import { serializeMessagesToResponsesInput } from "pi-openai-toolkit/src/serializer.ts";
import { LESSON_HEADER, LESSONS_RUN, LESSONS_TYPE, SKILLS_DIR } from "./lessons-compaction.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const scratch = realpathSync(mkdtempSync(join(tmpdir(), "lessons-compaction-")));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const loaded = await discoverAndLoadExtensions([root], scratch, scratch);

const head = "user layer: /agent/pstack/lessons\nproject write target: none\n" +
	"Lessons follow in rising priority: a later lesson wins over an earlier one for the same file.\n";
const end = "\n== end of lessons\n";
const emptyOutput = head + end;
const lessonsOutput = (body: string) =>
	`${head}\n== lesson for arena/SKILL.md from /agent/pstack/lessons\n## Probe lesson\n\n${body}\n${end}`;

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
	expect(loaded.extensions[0].handlers.has("context_with_system")).toBe(true);
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

test("the tests import the pinned versions", () => {
	for (const [name, pinned] of Object.entries(pins).filter(([, spec]) => /^\d+\.\d+\.\d+$/.test(spec))) {
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

test("with nothing after the checkpoint yet, the notice goes last and says to carry on", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendCompaction("Compacted", null, 1000);
	expect(roles(await h.project())).toEqual(["compactionSummary", "notice"]);

	// A compaction inside a run keeps a tail that ends at a tool result, and the notice becomes the prompt.
	const midRun = fixture();
	midRun.runLessons();
	midRun.manager.appendCompaction("Compacted", midRun.tool("read", "file").call, 1000);
	const projected = await midRun.project();
	expect(roles(projected)).toEqual(["compactionSummary", "assistant", "toolResult", "notice"]);
	expect(projected.at(-1).content).toEndWith("Continue where the conversation left off. Tool calls that already have results are done.");
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
// Pi caches an extension by path, so each call writes its own file.
let handlers = 0;
async function providerContext(manager: SessionManager, earlierHandler: string, customType: string) {
	const handlerPath = join(scratch, `handler-${++handlers}.ts`);
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

test("in a session, tool results an earlier handler trims are not split from their calls by the notice", async () => {
	const h = fixture();
	const calls = [["c1", "bash", lessonsOutput("PROBE-BODY")], ["c2", "read", "file one"], ["c3", "read", "file two"]];
	const batch = h.manager.appendMessage({ role: "assistant", timestamp: 20,
		content: calls.map(([id, name]) => ({ type: "toolCall", id, name, arguments: {} })) } as never);
	for (const [id, name, text] of calls) {
		h.manager.appendMessage({ role: "toolResult", toolName: name, toolCallId: id, isError: false,
			content: [{ type: "text", text }], timestamp: 21 } as never);
	}
	h.manager.appendCompaction("Compacted", batch, 1000);
	// Pruners clear output that can be read again and keep the rest.
	const trim = `export default (pi) => pi.on("context", (event) => ({ messages: event.messages.map((m) =>
		m.role === "toolResult" && m.toolName === "read" ? { ...m, content: [{ type: "text", text: "[trimmed]" }] } : m) }));`;
	const context = await providerContext(h.manager, trim, "goal_continuation");
	expect(context.map(([role]) => role))
		.toEqual(["system", "user", "assistant", "toolResult", "toolResult", "toolResult", "notice", "user"]);
	expect(context.slice(4, 6).map(([, text]) => text)).toEqual(["[trimmed]", "[trimmed]"]);
	expect(context[6][1]).toContain("PROBE-BODY");
});

test("in a session, a system message after the checkpoint stays in place, so the cached prefix holds", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendCompaction("Compacted", null, 1000);
	// What a prompt-section or tool-loadout change persists.
	h.manager.appendMessage({ role: "system", content: "", sections: { probe_delta: "DELTA-SECTION" }, timestamp: 50 } as never);
	const context = await providerContext(h.manager, "export default () => {};", "goal_continuation");
	// Pi's own request is `user, system, system, user`. Folded into one head, the delta would change the prefix.
	expect(context.map(([role]) => role)).toEqual(["user", "notice", "system", "system", "user"]);
});

test("Codex native replay drops the retained tail but keeps one copy of the lessons, after the checkpoint", async () => {
	const h = fixture();
	const details = { strategy: "openai-remote-compaction-v2", inputProvenance: "legacy-raw-context-v1", provider: "openai-codex",
		api: "openai-codex-responses", model: "gpt-6.1-sol", baseUrl: "https://chatgpt.com/backend-api", createdAt: new Date(0).toISOString(),
		compactedWindow: [{ type: "compaction", encrypted_content: "OPAQUE-CHECKPOINT" }] };
	h.manager.appendCompaction("Native checkpoint summary", h.runLessons("RETAINED-BODY").call, 1000, details);
	h.user("CONTINUE-MARK");
	const branchEntries = h.manager.getBranch();
	const compactionEntry = branchEntries.find((entry) => entry.type === "compaction")!;
	const replayed = { branchEntries, compactionEntry, expectedInputProvenance: "legacy-raw-context-v1" } as const;
	const trimmed = removeNativeCompactionRetainedMessages({ messages: await h.project(), ...replayed } as never);
	if (!trimmed.ok) throw new Error(trimmed.reason);
	expect(roles(trimmed.messages)).toEqual(["compactionSummary", "notice", "user"]);
	const model = getBuiltinModel("openai-codex", "gpt-6.1-sol") as never;
	const rewritten = rewriteResponsesPayloadWithNativeReplay({ model,
		payload: { input: serializeMessagesToResponsesInput(model, trimmed.messages as never) }, ...replayed } as never);
	if (!rewritten.ok) throw new Error(rewritten.reason);
	const payload = JSON.stringify(rewritten.rewrittenPayload.input);
	const at = (text: string) => payload.indexOf(text);
	expect(at("OPAQUE-CHECKPOINT")).toBeGreaterThan(-1);
	expect(at("OPAQUE-CHECKPOINT")).toBeLessThan(at("Context-maintenance notice"));
	expect(at("Context-maintenance notice")).toBeLessThan(at("CONTINUE-MARK"));
	expect(payload.split("RETAINED-BODY")).toHaveLength(2);
	expect(at("Native checkpoint summary")).toBe(-1);
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

	// System messages still match their copies, but they are not anchors.
	const withSystem = fixture();
	withSystem.manager.appendMessage({ role: "system", content: "", sections: { probe_head: "HEAD" }, timestamp: 2 } as never);
	withSystem.runLessons();
	withSystem.manager.appendCompaction("Compacted", null, 1000);
	withSystem.user("Continue");
	const othersRewritten = withSystem.manager.buildSessionContext().messages
		.map((m: any) => (m.role === "system" ? m : { ...m, timestamp: 0 }));
	const projected = await withSystem.project(othersRewritten);
	expect(roles(projected)).toContain("system");
	expect(roles(projected).at(-1)).toBe("notice");
});

test("reading files that quote the first or last line is not a run, before or after the checkpoint", async () => {
	const sources = [`${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`,
		new URL("./lessons-compaction.ts", import.meta.url), new URL("./lessons-compaction.test.ts", import.meta.url)]
		.map((path) => readFileSync(path, "utf8"));
	// A note that describes the output, with a lesson header in its example.
	sources.push("The script prints `Lessons follow in rising priority`, then each lesson, and ends with `== end of lessons`:\n\n" +
		"== lesson for how/SKILL.md from ~/.pi/agent/pstack/lessons\n");
	for (const source of sources) {
		expect(source).toContain("Lessons follow in rising priority");
		expect(source).toContain("== end of lessons");
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

// Runs the real lessons.sh through the real bash tool, with these user-layer lessons.
async function bashLessons(lessons: Record<string, string>, pipe = "") {
	const agent = mkdtempSync(join(scratch, "agent-"));
	for (const [file, text] of Object.entries(lessons)) {
		mkdirSync(join(agent, "pstack/lessons", file, ".."), { recursive: true });
		writeFileSync(join(agent, "pstack/lessons", file), text);
	}
	const { content, details } = await createBashTool(scratch).execute("lessons",
		{ command: `PI_CODING_AGENT_DIR=${agent} sh ${SKILLS_DIR}/poteto-mode/scripts/lessons.sh${pipe}` });
	if (details?.fullOutputPath) rmSync(details.fullOutputPath, { force: true });
	return content.map((c: any) => c.text).join("\n");
}
const longLesson = Array.from({ length: DEFAULT_MAX_LINES }, (_, i) => `line ${i}`).join("\n");

test("a run the bash tool cut to its tail still counts", async () => {
	const cut = await bashLessons({ "arena/SKILL.md": longLesson, "how/SKILL.md": "TAIL-LESSON\n" });
	expect(cut).not.toMatch(LESSONS_RUN);
	expect(cut).toContain("[Showing lines ");

	const before = fixture();
	before.tool("bash", cut);
	before.manager.appendCompaction("Compacted", null, 1000);
	const notice = notices(await before.project())[0].content;
	expect(notice).toContain("TAIL-LESSON");
	expect(notice).toContain("a later lesson wins over an earlier one for the same file");
	expect(notice).toContain("The bash tool cut the start of this output");

	const after = fixture();
	after.runLessons();
	after.manager.appendCompaction("Compacted", null, 1000);
	after.tool("bash", cut);
	expect(notices(await after.project())).toHaveLength(0);

	// One lesson longer than the limit leaves no lesson header in the output.
	const single = await bashLessons({ "how/SKILL.md": `${longLesson}\nSINGLE-LESSON\n` });
	expect(single).not.toMatch(LESSON_HEADER);
	const alone = fixture();
	alone.tool("bash", single);
	alone.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await alone.project())[0].content).toContain("SINGLE-LESSON");
});

test("output cut from the bottom is not a run, so it neither hides nor replaces the whole run", async () => {
	const lessons = { "arena/SKILL.md": "ARENA-1\nARENA-2\nARENA-3\nARENA-4\nARENA-5\nARENA-6\n", "how/SKILL.md": "HOW-LESSON\n" };
	const whole = await bashLessons(lessons);
	// `| head -3` ends before the first lesson, `| head` inside it, as a `read` of the full-output log would.
	for (const pipe of [" | head -3", " | head"]) {
		const top = await bashLessons(lessons, pipe);
		expect(top).toMatch(LESSONS_RUN);
		expect(top).not.toContain("HOW-LESSON");

		const before = fixture();
		before.tool("bash", whole);
		before.tool("bash", top);
		before.manager.appendCompaction("Compacted", null, 1000);
		expect(notices(await before.project())[0].content).toContain("HOW-LESSON");

		const after = fixture();
		after.tool("bash", whole);
		after.manager.appendCompaction("Compacted", null, 1000);
		after.tool("bash", top);
		expect(notices(await after.project())[0].content).toContain("HOW-LESSON");
	}
});

test("output of commands chained before or after the run does not come back", async () => {
	const h = fixture();
	h.tool("bash", `STALE-BEFORE\n${await bashLessons({ "how/SKILL.md": "CHAINED-LESSON\n" }, "; echo STALE-STATUS")}`);
	h.manager.appendCompaction("Compacted", null, 1000);
	const notice = notices(await h.project())[0].content;
	expect(notice).toContain("CHAINED-LESSON");
	expect(notice).toContain("user layer: ");
	expect(notice).not.toContain("STALE-BEFORE");
	expect(notice).not.toContain("STALE-STATUS");
	expect(notice).not.toContain("cut the start");
});

test("with two runs in one tool result, as when a lesson is written between them, the second one counts", async () => {
	const run = (lessons: Record<string, string>) => bashLessons(lessons);
	const once = async (first: string, second: string) => {
		const h = fixture();
		h.tool("bash", `${first}\n${second}`);
		h.manager.appendCompaction("Compacted", null, 1000);
		return notices(await h.project()).map((n) => n.content);
	};
	const written = await once(await run({}), await run({ "how/SKILL.md": "FIRST-WRITTEN\n" }));
	expect(written[0]).toContain("FIRST-WRITTEN");
	const updated = await once(await run({ "arena/SKILL.md": "REMOVED-LESSON\n" }), await run({ "how/SKILL.md": "NEW-LESSON\n" }));
	expect(updated[0]).toContain("NEW-LESSON");
	expect(updated[0]).not.toContain("REMOVED-LESSON");
	expect(await once(await run({ "arena/SKILL.md": "REMOVED-LESSON\n" }), await run({}))).toHaveLength(0);
});

test("a lesson that quotes the first and last lines does not cut the lessons after it", async () => {
	const quoting = "QUOTING-LESSON\n```\nuser layer: /example\n== end of lessons\n```\nQUOTED-TAIL\n";
	const h = fixture();
	h.tool("bash", await bashLessons({ "arena/SKILL.md": quoting, "how/SKILL.md": "HOW-LESSON\n" }));
	h.manager.appendCompaction("Compacted", null, 1000);
	const notice = notices(await h.project())[0].content;
	for (const token of ["QUOTING-LESSON", "QUOTED-TAIL", "HOW-LESSON"]) expect(notice).toContain(token);
});

test("tool results with null or missing content, which old session files can hold, do not stop the notice", async () => {
	const h = fixture();
	h.runLessons();
	h.manager.appendMessage({ role: "assistant", timestamp: 30, content: [
		{ type: "toolCall", id: "n1", name: "read", arguments: {} }, { type: "toolCall", id: "n2", name: "read", arguments: {} }] } as never);
	h.manager.appendMessage({ role: "toolResult", toolName: "read", toolCallId: "n1", isError: false, content: null, timestamp: 31 } as never);
	h.manager.appendMessage({ role: "toolResult", toolName: "read", toolCallId: "n2", isError: false, timestamp: 32 } as never);
	h.manager.appendCompaction("Compacted", null, 1000);
	expect(notices(await h.project())).toHaveLength(1);
});

test("a run that exits non-zero after printing the lessons counts; output without the end line does not", async () => {
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
