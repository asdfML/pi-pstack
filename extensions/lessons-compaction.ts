import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const LESSONS_TYPE = "pstack_lessons";
// The header line lessons.sh prints. Anchored to a line start, so source code that quotes it is not a run.
export const LESSONS_RUN = /^Lessons follow in rising priority/m;
export const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
const SCRIPT = `${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`;

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
		const lessonsAt = branch.findLastIndex((entry) =>
			entry.type === "message" && entry.message.role === "toolResult" && !edited.has(entry.id)
			&& LESSONS_RUN.test(textOf(entry.message.content)));
		// A rerun after the checkpoint is already live. One in the retained tail is not: Codex native
		// replay replaces that tail with its opaque window.
		if (lessonsAt < 0 || lessonsAt > checkpointAt) return;
		const run = branch[lessonsAt];
		if (run.type !== "message" || run.message.role !== "toolResult") return;

		const postIds = new Set(branch.slice(checkpointAt + 1).map((entry) => entry.id));
		const post = new Set(ctx.sessionManager.buildSessionProjection().entries
			.filter((entry) => postIds.has(entry.sourceEntry.id))
			.flatMap((entry) => entry.messages)
			.filter((message) => message.role !== "system")
			.map((message) => JSON.stringify(message)));
		// After the retained tail, so on every strategy this copy is the latest one the model reads.
		const insertAt = post.size === 0 ? event.messages.length
			: event.messages.findIndex((message) => post.has(JSON.stringify(message)));
		if (insertAt < 0) return;

		event.messages.splice(insertAt, 0, {
			role: "custom",
			customType: LESSONS_TYPE,
			display: false,
			timestamp: Date.parse(checkpoint.timestamp),
			content: "Context-maintenance notice, not a new user request: the conversation was compacted, so the " +
				`output of your last \`sh ${SCRIPT}\` run may be gone from context. It is repeated below. ` +
				"Apply these lessons exactly as the script's header says, as if you had just run it. " +
				"Each lesson only amends the pstack file named in its `== lesson for <file>` header; it is not that file's " +
				`text and does not replace it. Those paths are relative to ${SKILLS_DIR}/. ` +
				"If you are following one of those files and its own text is not in your context, read it from there.\n\n" +
				textOf(run.message.content),
		});
		return { messages: event.messages };
	});
}
