import { expect, test } from "bun:test";
import { type ScriptRuns, scriptRuns } from "./shell-commands.ts";

test("a command runs the script when the script's path is a command word, and not when it only names the script", () => {
	const runs = ["sh /abs/skills/poteto-mode/scripts/lessons.sh", "/abs/scripts/lessons.sh", "sh lessons.sh --create",
		"cd ~/x && sh skills/poteto-mode/scripts/lessons.sh | head -c 400", "PI_CODING_AGENT_DIR=/tmp/a sh /a/lessons.sh",
		"(cd x; ./lessons.sh)", "bash -x /a/lessons.sh", "sh \"$D/lessons.sh\"; echo done", "echo $(sh /a/lessons.sh)",
		"git status\nsh /a/lessons.sh", "env LC_ALL=C sh /a/lessons.sh", "bash -c \"sh /a/lessons.sh\"",
		"bash -lc 'sh /a/lessons.sh'", "timeout 10 sh /a/lessons.sh", "sh \"/Users/me/My Dir/lessons.sh\"",
		"sh $(dirname \"$0\")/lessons.sh", "cat <<EOF > note.md\nsh /a/lessons.sh\nEOF\nsh /a/lessons.sh", "/bin/sh /a/lessons.sh",
		"env LABEL=\"a b\" sh /a/lessons.sh", "/usr/bin/env sh /a/lessons.sh", "ls # note\nsh /a/lessons.sh",
		"{ sh /a/lessons.sh; } 2>&1", "if [ -d x ]; then sh /a/lessons.sh; fi", "for d in a; do sh /a/lessons.sh; done",
		"! sh /a/lessons.sh", "ksh /a/lessons.sh", "env -u X sh /a/lessons.sh", "sudo -u me sh /a/lessons.sh",
		"nice -n 5 sh /a/lessons.sh", "/bin/bash -c /a/lessons.sh", "cd /x && \\\nsh /a/lessons.sh", "sh \\\n  /a/lessons.sh",
		"cd /x &&\t\\\nsh /a/lessons.sh", "source /a/lessons.sh", ". /a/lessons.sh", "bash -o pipefail -c 'sh /a/lessons.sh'",
		"echo \"$(sh /a/lessons.sh)\"", "echo `sh /a/lessons.sh`", "n=$((1<<3))\nsh /a/lessons.sh", "cat <<< 'x'\nsh /a/lessons.sh",
		"cat <<EOF\n\tEOF\nEOF\nsh /a/lessons.sh", "x=$(echo ')'); sh /a/lessons.sh", "x=$(echo \\)); sh /a/lessons.sh",
		"</dev/null sh /a/lessons.sh", "sh /a/lessons.sh>/tmp/out; cat /tmp/out", "sh /a/lessons.sh 2>&1 | tail -n 5",
		"X=1 \\\n  sh /a/lessons.sh", "2>/dev/null sh /a/lessons.sh", "cat <<<x\nsh /a/lessons.sh",
		"cat <<'EOF-X'\nx\nEOF-X\nsh /a/lessons.sh", "sh 2>&1 /a/lessons.sh", "/lessons.sh", "./lessons.sh",
		"cat <(sh /a/lessons.sh)", "diff <(sh /a/lessons.sh) x", "cat <<EOF\n$(sh /a/lessons.sh)\nEOF",
		"function f { sh /a/lessons.sh; }; f", "sh -c -- 'sh /a/lessons.sh'", "eval sh /a/lessons.sh", "eval \"sh /a/lessons.sh\"",
		"watch -n 2 sh /a/lessons.sh", "echo $'it\\'s'; sh /a/lessons.sh", "((n<<=1))\nsh /a/lessons.sh",
		"(( x = 1<<3 ))\nsh /a/lessons.sh", "bash --rcfile /x -c 'sh /a/lessons.sh'",
		"bash -c -e 'sh /a/lessons.sh'", "bash -c -o pipefail 'sh /a/lessons.sh'", "bash -ec 'sh /a/lessons.sh'",
		"cat <<-'R'\n\tsh /a/lessons.sh\n\tR\nsh /a/lessons.sh", "echo $((1<<3))\nsh /a/lessons.sh",
		"x=$(cat <<'R'\n1) a\nR\n); sh /a/lessons.sh"];
	const names = ["cat report.md /a/lessons.sh", "rg -n 'end of lessons' /a/lessons.sh review/", "git diff -- /a/lessons.sh",
		"sed -n 1,40p /a/lessons.sh", "shellcheck /a/lessons.sh", "sh /a/my-lessons.sh", "sh /a/lessons.sh.bak",
		"cat /a/lessons.shared.md", "bun test lessons.test.ts", "sh -c 'cat r.md /a/lessons.sh'",
		"python3 -c 'from pathlib import Path; print(Path(\"/a/lessons.sh\").read_text())'",
		"node -e \"require('fs').readFileSync('/a/lessons.sh')\"", "F=/a/lessons.sh; cat $F", "echo x; -v=/a/lessons.sh",
		"cat <<'EOF' > note.md\nRun it with:\nsh /a/lessons.sh\nEOF", "echo 'sh /a/lessons.sh' > note.md",
		"grep -h -B 120 -e '== end of lessons' -e '(sh lessons.sh)' review/*.md", "ls # then; sh /a/lessons.sh",
		"echo \\; sh /a/lessons.sh", "grep -h -B 12 -E 'foo|lessons.sh' r.md", "awk '/a/||/lessons.sh/' f",
		"rg \"(lessons.sh)\" .", "curl 'http://x?a=1&lessons.sh'", "L=/a/lessons.sh; sed -n 1,80p \"$L\" review.md",
		"echo then lessons.sh", "cat $(pwd)/lessons.sh report.md", "cat `pwd`/lessons.sh report.md",
		"grep -h -B 120 '== end of lessons' $(pwd)/skills/poteto-mode/scripts/lessons.sh review/*.md",
		"cat <<'END.DOC'\nsh /a/lessons.sh\nEND.DOC", "cat <<\\EOF\nsh /a/lessons.sh\nEOF",
		"cat <<'EOF-LESSONS'\nsh /a/lessons.sh\nEOF-LESSONS", "cat <<EOF\nx\n\tEOF\nsh /a/lessons.sh\nEOF",
		"echo \\\nsh /a/lessons.sh", "source ./env.sh", "cat $( (echo a) )/lessons.sh r",
		"diff $(git rev-parse --show-toplevel)/lessons.sh old.sh", "x=$(pwd)/lessons.sh; cat \"$x\"", "echo $(pwd)/lessons.sh",
		"-- /a/lessons.sh", "2 /a/lessons.sh", "cat <<< /a/lessons.sh", "cat > /a/lessons.sh", "cat 2> /a/lessons.sh x",
		"cat $(echo \\))/lessons.sh r", "cat <(cat /a/lessons.sh report.md)", "diff <(cat /a/lessons.sh) <(cat /b/lessons.sh)",
		"tee >(cat /a/lessons.sh) < x", "cat <(echo a) /a/lessons.sh", "cat < <(sort /a/lessons.sh)", "cat $(printf %s /a # c )\n)/lessons.sh r.md",
		"report=$(cat <<'REPORT'\n1) Example only:\nsh /a/lessons.sh\nREPORT\n)\nprintf '%s\\n' \"$report\"",
		"cat <<'EOF'\n$(sh /a/lessons.sh)\nEOF", "sh -n /a/lessons.sh", "bash -n /a/lessons.sh", "sh -o noexec /a/lessons.sh",
		"command -v /a/lessons.sh && cat review.md", "files=(/a/lessons.sh other.md); cat \"${files[@]}\""];
	expect(runs.filter((command) => !scriptRuns(command).count)).toEqual([]);
	expect(names.filter((command) => scriptRuns(command).count)).toEqual([]);
});

test("a command line counts its runs of the script and whether the last command is one", () => {
	const cases: [string, ScriptRuns][] = [["sh /a/lessons.sh", { count: 1, last: true }],
		["sh /a/lessons.sh && echo a > l.md && sh /a/lessons.sh", { count: 2, last: true }],
		["sh /a/lessons.sh && gh issue view 42", { count: 1, last: false }],
		["cd x && sh /a/lessons.sh 2>&1", { count: 1, last: true }], ["sh /a/lessons.sh | tail -n 3", { count: 1, last: false }],
		["bash -c 'sh /a/lessons.sh; echo'", { count: 1, last: false }], ["cat review.md", { count: 0, last: false }]];
	expect(cases.map(([command]) => [command, scriptRuns(command)])).toEqual(cases);
});
