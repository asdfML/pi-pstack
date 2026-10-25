import { fileURLToPath } from "node:url";
import type { ExtensionAPI, SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent";

export const LESSONS_TYPE = "pstack_lessons";
// The header line lessons.sh prints. Anchored to a line start, so source code that quotes it is not a run.
export const LESSONS_RUN = /^Lessons follow in rising priority/m;
// The line lessons.sh prints before each lesson. A run without one printed no lessons.
export const LESSON_HEADER = /^== lesson for /m;
export const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
const SCRIPT = `${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`;

type ToolResultEntry = SessionMessageEntry & { message: Extract<SessionMessageEntry["message"], { role: "toolResult" }> };

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	return Array.isArray(content) ? content.filter((c) => c?.type === "text").map((c) => c.text).join("\n") : "";
}

export default function lessonsCompaction(pi: ExtensionAPI) {
	pi.on("context", (event, ctx) => {
		const branch = ctx.sessionManager.getBranch();
		const checkpointAt = branch.findLastIndex((entry) => entry.type === "compaction");
		const checkpoint = branch[checkpointAt];
		if (checkpoint?.type !== "compaction") return;
		// Output a context_edit omitted or rewrote is not live and must not come back through this notice.
		const edited = new Set(branch.flatMap((entry) => (entry.type === "context_edit" ? [entry.targetId] : [])));
		const isRun = (entry: SessionEntry): entry is ToolResultEntry =>
			entry.type === "message" && entry.message.role === "toolResult" && !edited.has(entry.id)
			&& LESSONS_RUN.test(textOf(entry.message.content));
		if (branch.slice(checkpointAt + 1).some(isRun)) return;
		// A run kept in the retained tail still counts as gone: Codex native replay replaces that tail.
		const run = branch.slice(0, checkpointAt).findLast(isRun);
		// Checked here, not in isRun, because a rerun that printed no lessons is still live and means they are gone.
		if (!run || !LESSON_HEADER.test(textOf(run.message.content))) return;

		// This hook sees the session projection, but earlier context handlers may rewrite any of it.
		// pi-subagents wraps its own custom messages, and pruning extensions trim old tool output.
		// So anchor on the last summary or retained-tail message that still matches its projection copy.
		const postIds = new Set(branch.slice(checkpointAt + 1).map((entry) => entry.id));
		const kept = new Set(ctx.sessionManager.buildSessionProjection().entries
			.filter((entry) => !postIds.has(entry.sourceEntry.id))
			.flatMap((entry) => entry.messages)
			.map((message) => JSON.stringify(message)));
		const lastKept = event.messages.findLastIndex((message) => kept.has(JSON.stringify(message)));
		// After the retained tail, so on every strategy this copy is the latest one the model reads.
		// With no kept message found, the end is still after the tail.
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
				"Apply these lessons exactly as the script's header says, as if you had just run it. " +
				"Each lesson only amends the pstack file named in its `== lesson for <file>` header; it is not that file's " +
				`text and does not replace it. Those paths are relative to ${SKILLS_DIR}/. ` +
				"If you are following one of those files and its own text is not in your context, read it from there.\n\n" +
				textOf(run.message.content),
		});
		return { messages: event.messages };
	});
}
