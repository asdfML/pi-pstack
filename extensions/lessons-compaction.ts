import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BashToolDetails, ExtensionAPI, SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent";

export const LESSONS_TYPE = "pstack_lessons";
// The three lines lessons.sh prints first. lessons.sh indents a lesson line that would pass for one of its own, and
// the patterns are anchored to a line start, so neither a lesson nor source code that quotes them is a match.
// Lines end only at `\n`, as for sed: the `m` flag would also end them at `\r` and U+2028, which sed leaves alone.
export const LESSONS_START = /(?<![^\n])user layer: .*\nproject write target: .*\nLessons follow in rising priority/;
// The line lessons.sh prints last. The bash tool keeps only the tail of long output, which drops the header.
export const LESSONS_END = /(?<![^\n])== end of lessons(?![^\n])/;
// The line lessons.sh prints before each lesson.
export const LESSON_HEADER = /(?<![^\n])== lesson for /;
export const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
const SCRIPT = `${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`;
// A word the shell takes as it is: no whitespace, quote, expansion, glob or operator.
const PLAIN = "[^\\s;&|<>()$`'\"\\\\*?[]";
// A path as one plain word, or in quotes when it holds a space. A failed `cd` or `sh` prints its path, so a path
// holds no line break: its lines could pass for a run.
const PATH = `(${PLAIN}+|'[^'\n]*'|"[^"$\`\\\\\n]*")`;
// The script with nothing else in its call, so all of the call's output is the script's: by `sh` as the skill writes
// it or by its path, after a `cd` to an absolute path, which prints nothing or one error line, and with `--create`,
// whose own lines go to stderr, and `2>&1`, which the bash tool does anyway. PI_CODING_AGENT_DIR is the only env
// assignment: `PATH=` could pick another `sh`. Any other command, even one that runs the script, is not a run, since
// output chained after the script could pass for lessons, and the notice puts it in a user message.
const RUN = new RegExp(`^(?:cd[ \\t]+${PATH}[ \\t]*(?:&&|;)[ \\t]*)?(?:PI_CODING_AGENT_DIR=${PLAIN}*[ \\t]+)?`
	+ `(?:(sh)[ \\t]+)?${PATH}(?:[ \\t]+--create)?(?:[ \\t]+2>&1)?$`);
const unquote = (word: string) => (/^['"]/.test(word) ? word.slice(1, -1) : word);

export function runsScript(command: string): boolean {
	const [, dir, sh, script] = RUN.exec(command.trim()) ?? [];
	// Without `sh`, bash looks a word with no `/` up in PATH.
	if (script === undefined || (sh === undefined && !script.includes("/"))) return false;
	// The script's path is relative to the `cd`. Without one the call's directory is unknown, so the path must be absolute.
	const paths = (dir === undefined ? [script] : [dir, script]).map(unquote);
	// `resolve` drops `x/..` by name, but bash fails a `cd` to a missing `x` and runs the next command anyway, and the
	// kernel follows a symlink `x` first. Without `..`, a path that resolves to the script names its real ancestors.
	return isAbsolute(paths[0]) && !paths.some((p) => p.split("/").includes("..")) && resolve(...paths) === SCRIPT;
}

type ToolResult = Extract<SessionMessageEntry["message"], { role: "toolResult" }>;

// Session files are parsed without validation, so raw content can be null or missing.
function textOf(content: ToolResult["content"] | null | undefined): string {
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
		// Results of tool calls that ran the script. Any tool can show a lesson file that quotes a whole run, and only
		// the call tells the two apart. Results follow the message that made their calls, in call order, so each takes
		// the first call left with its id: some providers leave call ids empty.
		const runs = new Set<string>();
		let calls: { id: string; run: boolean }[] = [];
		for (const entry of branch) {
			if (entry.type !== "message") continue;
			if (entry.message.role === "assistant") {
				calls = (entry.message.content ?? []).flatMap((c) => (c.type === "toolCall"
					? [{ id: c.id, run: runsScript(String(c.arguments?.command ?? "")) }] : []));
			} else if (entry.message.role === "toolResult") {
				const { toolCallId } = entry.message;
				const call = calls.findIndex((c) => c.id === toolCallId);
				if (call >= 0 && calls.splice(call, 1)[0].run) runs.add(entry.id);
			}
		}
		// The run in a tool result, or undefined when there is none.
		const lessonsOf = (entry: SessionEntry): { text: string; whole: boolean } | undefined => {
			if (entry.type !== "message" || entry.message.role !== "toolResult" || !runs.has(entry.id) || edited.has(entry.id)) {
				return;
			}
			const text = textOf(entry.message.content);
			// Output without the last line was cut short, as by a run that failed, and may lack the lessons with the
			// highest priority.
			const end = [...text.matchAll(new RegExp(LESSONS_END, "g"))].at(-1);
			if (!end) return;
			const upTo = end.index + end[0].length;
			// When the bash tool kept just the tail, the first lines are gone, and what matches them is a quote in a lesson
			// from a session older than the indentation in lessons.sh. In a whole run, the first match and the last end line
			// keep every lesson of such a session.
			const details = entry.message.details as BashToolDetails | undefined;
			const start = details?.truncation?.truncated ? undefined : (text.match(LESSONS_START) ?? undefined);
			return { text: text.slice(start?.index ?? 0, upTo), whole: start !== undefined };
		};
		if (branch.slice(checkpointAt + 1).some(lessonsOf)) return;
		// A run kept in the retained tail still counts as gone: Codex native replay replaces that tail.
		let run: ReturnType<typeof lessonsOf>;
		for (let i = checkpointAt - 1; run === undefined && i >= 0; i--) run = lessonsOf(branch[i]);
		if (run === undefined) return;
		// A whole run without a lesson printed none, and a rerun like that is still live, so the check is not in lessonsOf.
		// Output cut from the top lost its header to the length of its lessons, even if no lesson header is left.
		if (run.whole && !LESSON_HEADER.test(run.text)) return;

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
				"If you are following one of those files and its own text is not in your context, read it from there." +
				(run.whole ? "" : " The bash tool cut the start of this output, so earlier lessons are " +
					"missing, and the lines before the first `== lesson for` header end a lesson whose header was cut. " +
					"To see them, run the script again and read the full-output log the bash tool names.") +
				"\n\n" +
				run.text +
				// When nothing follows the checkpoint this notice is the prompt, and it replaces Claude Bridge's own
				// "continue the task" prompt for a turn that ends at a tool result.
				"\n\nThat is the end of the repeated output. Continue where the conversation left off. " +
				"Tool calls that already have results are done.",
		});
		return { messages: event.messages };
	});
}
