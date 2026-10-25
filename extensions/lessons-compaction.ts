import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";

export const LESSONS_TYPE = "pstack_lessons";
// The header lessons.sh prints before any lesson. The test runs the real script, so a changed header fails it.
export const OUTPUT_MARKER = "Lessons follow in rising priority";
export const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
export const SCRIPT = `${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`;

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	return Array.isArray(content) ? content.filter((c) => c?.type === "text").map((c) => c.text).join("\n") : "";
}

export function lastLessonsRun(branch: SessionEntry[]): number {
	return branch.findLastIndex((entry) =>
		entry.type === "message" && entry.message.role === "toolResult" && !entry.message.isError
		&& textOf(entry.message.content).includes(OUTPUT_MARKER));
}

const run = promisify(execFile);

export default function lessonsCompaction(pi: ExtensionAPI) {
	const outputs = new Map<string, Promise<string | undefined>>();

	pi.on("context", async (event, ctx) => {
		const messages = event.messages.filter((m) => m.role !== "custom" || m.customType !== LESSONS_TYPE);
		const unchanged = messages.length === event.messages.length ? undefined : { messages };
		const branch = ctx.sessionManager.getBranch();
		const checkpointAt = branch.findLastIndex((entry) => entry.type === "compaction");
		const lessonsAt = lastLessonsRun(branch);
		// A rerun after the checkpoint is already live. One in the retained tail is not: Codex native
		// replay replaces that tail with its opaque window.
		if (checkpointAt < 0 || lessonsAt < 0 || lessonsAt > checkpointAt) return unchanged;
		const anchor = messages.findLastIndex((m) => m.role === "compactionSummary");
		if (anchor < 0) return unchanged;

		const checkpoint = branch[checkpointAt].id;
		const key = `${checkpoint}\0${ctx.cwd}`;
		if (!outputs.has(key)) {
			outputs.set(key, run("sh", [SCRIPT], { cwd: ctx.cwd, timeout: 10_000 })
				.then(({ stdout }) => (stdout.includes(OUTPUT_MARKER) ? stdout : undefined), () => undefined));
		}
		const output = await outputs.get(key);
		if (!output) {
			outputs.delete(key);
			return unchanged;
		}

		messages.splice(anchor + 1, 0, {
			role: "custom",
			customType: LESSONS_TYPE,
			display: false,
			timestamp: messages[anchor].timestamp,
			content: `[${LESSONS_TYPE}:${checkpoint}]\n` +
				"Context-maintenance notice, not a new user request: the conversation was compacted, and the earlier " +
				`output of \`sh ${SCRIPT}\` is no longer in context. Its current output follows. ` +
				"Apply these lessons exactly as the script's header says, as if you had just run it. " +
				"Each lesson only amends the pstack file named in its `== lesson for <file>` header; it is not that file's " +
				`text and does not replace it. Those paths are relative to ${SKILLS_DIR}/. ` +
				"If you are following one of those files and its own text is not in your context, read it from there.\n\n" +
				output,
		});
		return { messages };
	});
}
