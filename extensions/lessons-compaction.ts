import { fileURLToPath } from "node:url";
import type { ExtensionAPI, SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent";

export const LESSONS_TYPE = "pstack_lessons";
// The header line lessons.sh prints. Anchored to a line start, so source code that quotes it is not a run.
export const LESSONS_RUN = /^Lessons follow in rising priority/m;
// The line lessons.sh prints last. The bash tool keeps only the tail of long output, which drops the header.
export const LESSONS_END = /^== end of lessons$/m;
// The line lessons.sh prints before each lesson.
export const LESSON_HEADER = /^== lesson for /m;
export const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
const SCRIPT = `${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`;

type ToolResultEntry = SessionMessageEntry & { message: Extract<SessionMessageEntry["message"], { role: "toolResult" }> };

// Session files are parsed without validation, so raw content can be null or missing.
function textOf(content: ToolResultEntry["message"]["content"] | null | undefined): string {
	return (content ?? []).flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");
}

export default function lessonsCompaction(pi: ExtensionAPI) {
	// Not `context`: a change there makes Pi fold every system message into the head, so a prompt or tool change
	// after the compaction would cost the whole cached prefix.
	pi.on("context_with_system", (event, ctx) => {
		const branch = ctx.sessionManager.getBranch();
		const checkpointAt = branch.findLastIndex((entry) => entry.type === "compaction");
		const checkpoint = branch[checkpointAt];
		if (checkpoint?.type !== "compaction") return;
		// Output a context_edit omitted or rewrote is not live and must not come back through this notice.
		const edited = new Set(branch.flatMap((entry) => (entry.type === "context_edit" ? [entry.targetId] : [])));
		const isRun = (entry: SessionEntry): entry is ToolResultEntry => {
			if (entry.type !== "message" || entry.message.role !== "toolResult" || edited.has(entry.id)) return false;
			const text = textOf(entry.message.content);
			// Without the last line, output was cut from the bottom (`| head`), and a missing lesson proves nothing.
			return LESSONS_END.test(text) || (LESSONS_RUN.test(text) && LESSON_HEADER.test(text));
		};
		if (branch.slice(checkpointAt + 1).some(isRun)) return;
		// A run kept in the retained tail still counts as gone: Codex native replay replaces that tail.
		const run = branch.slice(0, checkpointAt).findLast(isRun);
		if (!run) return;
		const lessons = textOf(run.message.content);
		// A whole run without a lesson printed none, and a rerun like that is still live, so the check is not in isRun.
		// Output cut from the top lost its header to the length of its lessons, even if no lesson header is left.
		if (LESSONS_RUN.test(lessons) && !LESSON_HEADER.test(lessons)) return;

		// Every `context` handler and earlier `context_with_system` handlers may rewrite the projection this starts from.
		// pi-subagents wraps its own custom messages, and pruning extensions trim old tool output.
		// So anchor on the last summary or retained-tail message that still matches its projection copy.
		// System messages are not anchors: the head always matches, and it comes before the summary.
		const postIds = new Set(branch.slice(checkpointAt + 1).map((entry) => entry.id));
		const kept = new Set(ctx.sessionManager.buildSessionProjection().entries
			.filter((entry) => !postIds.has(entry.sourceEntry.id))
			.flatMap((entry) => entry.messages)
			.filter((message) => message.role !== "system")
			.map((message) => JSON.stringify(message)));
		const lastKept = event.messages.findLastIndex((message) => kept.has(JSON.stringify(message)));
		// After the retained tail, so this copy follows any copy the tail still holds. If an earlier handler rewrote
		// the tail's last messages, the notice lands before them. With no kept message found, it goes last.
		let insertAt = lastKept < 0 ? event.messages.length : lastKept + 1;
		// Never between a tool call and its results. A rewritten result no longer matches, so the anchor
		// can be the assistant message that made the call.
		while (event.messages[insertAt]?.role === "toolResult") insertAt++;

		event.messages.splice(insertAt, 0, {
			role: "custom",
			customType: LESSONS_TYPE,
			display: false,
			timestamp: Date.parse(checkpoint.timestamp),
			content: "Context-maintenance notice, not a new user request: the conversation was compacted, so the " +
				`output of your \`sh ${SCRIPT}\` run from before the compaction may be gone from context. It is repeated below. ` +
				"Apply these lessons as if you had just run it. They come in rising priority: a later lesson wins over an " +
				"earlier one for the same file, and every lesson wins over the file it amends. " +
				"Each lesson only amends the pstack file named in its `== lesson for <file>` header; it is not that file's " +
				`text and does not replace it. Those paths are relative to ${SKILLS_DIR}/. ` +
				"If you are following one of those files and its own text is not in your context, read it from there. " +
				"If the bash tool cut the start of the output, the lines before the first `== lesson for` header end a " +
				"lesson whose header was cut.\n\n" +
				lessons +
				// When nothing follows the checkpoint this notice is the prompt, and it replaces Claude Bridge's own
				// "continue the task" prompt for a turn that ends at a tool result.
				"\n\nThat is the end of the repeated output. Continue where the conversation left off. " +
				"Tool calls that already have results are done.",
		});
		return { messages: event.messages };
	});
}
