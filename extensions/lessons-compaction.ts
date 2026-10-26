import { fileURLToPath } from "node:url";
import type { BashToolDetails, ExtensionAPI, SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent";

export const LESSONS_TYPE = "pstack_lessons";
// The three lines lessons.sh prints first. lessons.sh indents a lesson line that would pass for one of its own, and
// the patterns are anchored to a line start, so neither a lesson nor source code that quotes them is a match. The
// first line is not anchored, so output of a command chained before the script without a final newline is cut off too.
// Lines end only at `\n`, as for sed: the `m` flag would also end them at `\r` and U+2028, which sed leaves alone.
export const LESSONS_START = /user layer: .*\nproject write target: .*\nLessons follow in rising priority/;
// The line lessons.sh prints last. The bash tool keeps only the tail of long output, which drops the header.
export const LESSONS_END = /(?<![^\n])== end of lessons(?![^\n])/;
// The line lessons.sh prints before each lesson.
export const LESSON_HEADER = /(?<![^\n])== lesson for /;
const WRAPPERS = new Set(["exec", "command", "time", "env", "nice", "nohup", "sudo", "xargs", "timeout"]);
const SHELLS = new Set(["sh", "bash", "dash", "zsh", "ksh"]);
// Words that can come before a command word in shell grammar.
const RESERVED = new Set(["{", "!", "if", "then", "else", "elif", "while", "until", "do"]);

// The simple commands of a shell command line, as words with quotes removed. Quoted text stays inside its word, so
// code passed to another interpreter is not split into commands, and comments and heredoc bodies are skipped. `$(` and a backtick
// only split, which is enough to find a command word inside them.
function simpleCommands(line: string): string[][] {
	const commands: string[][] = [];
	let words: string[] = [];
	let word: string | undefined;
	let quote = "";
	const heredocs: string[] = [];
	const endWord = () => {
		if (word !== undefined) words.push(word);
		word = undefined;
	};
	const endCommand = () => {
		endWord();
		if (words.length) commands.push(words);
		words = [];
	};
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		const heredoc = quote ? null : /^<<-?[ \t]*(['"]?)(\w+)\1/.exec(line.slice(i));
		if (quote) {
			if (c === quote) quote = "";
			else word += c === "\\" && quote === '"' && i + 1 < line.length ? line[++i] : c;
		} else if (heredoc) {
			endWord();
			heredocs.push(heredoc[2]);
			i += heredoc[0].length - 1;
		} else if (c === "'" || c === '"') {
			quote = c;
			word ??= "";
		} else if (c === "#" && word === undefined) {
			const newline = line.indexOf("\n", i);
			i = (newline < 0 ? line.length : newline) - 1;
		} else if (c === "\\") word = (word ?? "") + (line[++i] ?? "");
		else if (c === "\n") {
			endCommand();
			for (const end of heredocs.splice(0)) {
				const close = new RegExp(`\n\t*${end}(?=\n|$)`).exec(line.slice(i));
				i = close ? i + close.index + close[0].length : line.length;
			}
		} else if (/\s/.test(c)) endWord();
		else if (";&|()`".includes(c)) endCommand();
		else word = (word ?? "") + c;
	}
	endCommand();
	return commands;
}

// Whether a command line runs lessons.sh: in one of its simple commands the script's path is the command word, after
// any reserved words, env assignments, wrappers with their flags and numbers, and a shell with its flags, or it runs
// in the string a shell gets with `-c`. A command that only names the script, as a file argument (`cat`, `rg`, `git diff`), in a variable or in
// code for another interpreter, does not.
export function runsScript(line: string): boolean {
	return simpleCommands(line).some((words) => {
		const name = (at: number) => words[at]?.split("/").at(-1) ?? "";
		let i = 0;
		while (i < words.length && (RESERVED.has(words[i]) || /^\w+=/.test(words[i]) || WRAPPERS.has(name(i))
			|| words[i].startsWith("-") || /^\d/.test(words[i]))) {
			// The value of `env -u`, `sudo -u`, `nice -n`, `timeout -s` and the like.
			i += /^-[ugnskC]$/.test(words[i]) ? 2 : 1;
		}
		if (SHELLS.has(name(i))) {
			for (i++; words[i]?.startsWith("-"); i++) if (/^-\w*c/.test(words[i])) return runsScript(words[i + 1] ?? "");
		}
		return /(?:^|\/)lessons\.sh$/.test(words[i] ?? "");
	});
}
export const SKILLS_DIR = fileURLToPath(new URL("../skills", import.meta.url));
const SCRIPT = `${SKILLS_DIR}/poteto-mode/scripts/lessons.sh`;

type ToolResult = Extract<SessionMessageEntry["message"], { role: "toolResult" }>;

// Session files are parsed without validation, so raw content can be null or missing.
function textOf(content: ToolResult["content"] | null | undefined): string {
	return (content ?? []).flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");
}

const lastMatch = (text: string, pattern: RegExp) => [...text.matchAll(new RegExp(pattern, "g"))].at(-1);

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
		// the call tells the two apart. A command that runs the script and then shows such a file still passes for a
		// run. Results follow the message that made their calls, in call order, so each takes the first call left with
		// its id: some providers leave call ids empty.
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
		// The last run in a tool result, or undefined when there is none. One call can run the script before and after
		// writing a lesson, and output of commands chained before or after the script is stale by the time it comes back.
		const lessonsOf = (entry: SessionEntry): { text: string; whole: boolean } | undefined => {
			if (entry.type !== "message" || entry.message.role !== "toolResult" || !runs.has(entry.id) || edited.has(entry.id)) {
				return;
			}
			const text = textOf(entry.message.content);
			// Output without the last line was cut from the bottom (`| head`) and may lack the lessons with the highest
			// priority. Runs of the script from before it printed that line do not count either.
			const end = lastMatch(text, LESSONS_END);
			if (!end) return;
			const upTo = end.index + end[0].length;
			const start = lastMatch(text.slice(0, upTo), LESSONS_START);
			// Without its first lines, output counts only when the bash tool kept just its tail. A `| tail` shows a part
			// with nothing to say how much is missing.
			const details = entry.message.details as BashToolDetails | undefined;
			if (!start && !details?.truncation?.truncated) return;
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
