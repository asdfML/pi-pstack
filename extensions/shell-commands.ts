// How often a shell command line runs lessons.sh, read well enough to tell a run of the script from a mention of it.
// It reads quotes, backslashes, line continuations, comments, redirections, heredocs, and command, process and
// arithmetic substitutions. It does not expand variables, aliases or functions, so it misses the script fed to a
// shell on stdin (`sh < lessons.sh`, `cat lessons.sh | sh`), named through a variable (`sh "$L"`), run by a function
// called later, or given to `xargs` with no command word after it, and wrapper flags with values other than
// `-u -g -n -s -k -C`.

const WRAPPERS = new Set(["exec", "command", "time", "env", "nice", "nohup", "sudo", "xargs", "timeout", "watch",
	"source", "."]);
const SHELLS = new Set(["sh", "bash", "dash", "zsh", "ksh"]);
// Words that can come before a command word in shell grammar.
const RESERVED = new Set(["{", "!", "if", "then", "else", "elif", "while", "until", "do"]);
const HEREDOC = /^<<(-?)[ \t]*((?:'[^']*'|"[^"]*"|\\.|[^\s;&|()<>'"\\])+)/;

export type ScriptRuns = { count: number; last: boolean };
const NONE: ScriptRuns = { count: 0, last: false };

// The simple commands in shell text from `from` up to an unmatched `close` (`)` or a backtick), or to its end, as
// words with quotes removed. Quoted text stays inside its word, so code passed to another interpreter is not split
// into commands. A substitution stays part of its word, and the commands inside it come first. A heredoc body is
// `literal`: only the substitutions in it run, and only when its delimiter is not quoted.
function scan(line: string, from = 0, close = "", literal = false): { commands: string[][]; end: number } {
	const commands: string[][] = [];
	let words: string[] = [];
	let word: string | undefined;
	let quote = "";
	let ansi = false;
	let depth = 0;
	let target = false;
	const heredocs: { end: string; tabs: boolean; expands: boolean }[] = [];
	const endWord = () => {
		if (word !== undefined && !target) words.push(word);
		if (word !== undefined) target = false;
		word = undefined;
	};
	const endCommand = () => {
		endWord();
		if (words.length && !literal) commands.push(words);
		words = [];
	};
	const substitute = (at: number, opener: number, closer: string) => {
		const inner = scan(line, at + opener, closer);
		commands.push(...inner.commands);
		word = (word ?? "") + line.slice(at, inner.end + 1);
		return inner.end;
	};
	let i = from;
	for (; i < line.length; i++) {
		const c = line[i];
		if (!quote && !literal && c === close && (close === "`" || depth === 0)) break;
		if (quote === "'") {
			if (c === "'") quote = "";
			else word += ansi && c === "\\" ? (line[++i] ?? "") : c;
		} else if (c === "\\" && line[i + 1] === "\n") i++;
		else if (c === "`") i = substitute(i, 1, "`");
		else if (c === "$" && line[i + 1] === "(") i = substitute(i, 2, ")");
		else if (!quote && !literal && (c === "<" || c === ">") && line[i + 1] === "(") i = substitute(i, 2, ")");
		else if (literal) {
			if (c === "\\") i++;
		} else if (quote) {
			if (c === '"') quote = "";
			else word += c === "\\" && i + 1 < line.length ? line[++i] : c;
		} else if (c === "'" || c === '"' || (c === "$" && line[i + 1] === "'")) {
			ansi = c === "$";
			i += ansi ? 1 : 0;
			quote = line[i];
			word ??= "";
		} else if (c === "#" && word === undefined) {
			const newline = line.indexOf("\n", i);
			i = (newline < 0 ? line.length : newline) - 1;
		} else if (c === "\\") word = (word ?? "") + (line[++i] ?? "");
		else if (c === "<" || c === ">") {
			// A file descriptor before the operator is part of it, and the word after it is its target.
			if (/^\d+$/.test(word ?? "")) word = undefined;
			endWord();
			const heredoc = HEREDOC.exec(line.slice(i));
			if (heredoc) {
				const end = heredoc[2].replace(/'([^']*)'|"([^"]*)"|\\(.)/g, (_, single, double, escaped) =>
					single ?? double ?? escaped);
				heredocs.push({ end, tabs: heredoc[1] === "-", expands: !/['"\\]/.test(heredoc[2]) });
				i += heredoc[0].length - 1;
			} else {
				const operator = /^[<>]+[&|]?(?:\d+|-)?/.exec(line.slice(i))![0];
				target = !/[\d-]$/.test(operator);
				i += operator.length - 1;
			}
		} else if (c === "\n") {
			endCommand();
			for (const { end, tabs, expands } of heredocs.splice(0)) {
				let at = i + 1;
				let stop = at;
				for (; at <= line.length; at = stop + 1) {
					stop = line.indexOf("\n", at);
					if (stop < 0) stop = line.length;
					const text = line.slice(at, stop);
					if ((tabs ? text.replace(/^\t+/, "") : text) === end) break;
				}
				if (expands) commands.push(...scan(line.slice(i + 1, Math.min(at, line.length)), 0, "", true).commands);
				i = stop;
			}
		} else if (c === "(" && line[i + 1] === "(" && word === undefined) {
			const end = line.indexOf("))", i);
			i = end < 0 ? line.length : end + 1;
		} else if (c === "(" && word?.endsWith("=")) {
			// An array literal: its elements are words, not commands.
			const inner = scan(line, i + 1, ")");
			word += line.slice(i, inner.end + 1);
			i = inner.end;
		} else if (c === "(") {
			depth++;
			endCommand();
		} else if (c === ")") {
			depth--;
			endCommand();
		} else if (/\s/.test(c)) endWord();
		else if (";&|".includes(c)) endCommand();
		else word = (word ?? "") + c;
	}
	endCommand();
	return { commands, end: i };
}

// The runs of lessons.sh in one simple command: its path is the command word after any reserved words, env
// assignments, wrappers with their flags, values and numbers, and a shell with its flags, or it runs in the string a
// shell gets with `-c` or `eval` gets. A shell that only checks syntax (`-n`, `-o noexec`) runs nothing.
function runsOf(words: string[]): ScriptRuns {
	const name = (at: number) => words[at]?.split("/").at(-1) ?? "";
	let i = 0;
	let wrapped = false;
	while (i < words.length && (RESERVED.has(words[i]) || words[i] === "function" || /^\w+=/.test(words[i])
		|| WRAPPERS.has(name(i)) || (wrapped && (words[i].startsWith("-") || /^\d/.test(words[i]))))) {
		if (name(i) === "command" && /^-[vV]$/.test(words[i + 1] ?? "")) return NONE;
		wrapped ||= WRAPPERS.has(name(i));
		// The name a function is defined with, and the value of `env -u`, `sudo -u`, `nice -n`, `timeout -s` and the like.
		i += words[i] === "function" || /^-[ugnskC]$/.test(words[i]) ? 2 : 1;
	}
	if (name(i) === "eval") return scriptRuns(words.slice(i + 1).join(" "));
	if (SHELLS.has(name(i))) {
		// With `-c`, the first word after all the flags is the string, as in `bash -c -e '…'`.
		let string = false;
		for (i++; /^[-+]/.test(words[i] ?? ""); i += /^(?:[-+][oO]|--rcfile|--init-file)$/.test(words[i]) ? 2 : 1) {
			if (/^-\w*n/.test(words[i]) || (words[i] === "-o" && words[i + 1] === "noexec")) return NONE;
			string ||= /^-\w*c/.test(words[i]);
		}
		if (string) return scriptRuns(words[i] ?? "");
	}
	return /^(?:lessons\.sh|(?!-)[^=]*\/lessons\.sh)$/.test(words[i] ?? "") ? { count: 1, last: true } : NONE;
}

// How many times a command line runs lessons.sh, and whether its last command is one of those runs.
export function scriptRuns(line: string): ScriptRuns {
	const runs = scan(line).commands.map(runsOf);
	return { count: runs.reduce((sum, run) => sum + run.count, 0), last: runs.at(-1)?.last ?? false };
}
