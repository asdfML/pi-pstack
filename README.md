# pi-pstack

An unofficial port of [pstack](https://github.com/cursor/plugins/tree/main/pstack) by
Lauren Tan ([poteto](https://x.com/poteto)) to the [Pi](https://pi.dev) coding agent.

This project is not affiliated with or endorsed by Lauren Tan, Cursor, or Anysphere. "pstack" and
"poteto-mode" are names from the original project, used here only to identify what this port is
based on. All credit for the skills, playbooks, and principles goes to the original author.

Licensed under MIT, like the original. See [LICENSE](LICENSE), [LICENSE-cursor-team-kit](LICENSE-cursor-team-kit), and [NOTICE.md](NOTICE.md). The upstream source and version
are recorded in [UPSTREAM.md](UPSTREAM.md). How the port differs from upstream is in
[PORTING.md](PORTING.md) and [GAPS.md](GAPS.md).

## Install

pi-pstack needs pi-subagents and pi-goal-x. pi-background-tasks is optional and gives long runs
their wake-up timers.

```text
pi install npm:pi-subagents
pi install npm:pi-goal-x
pi install npm:pi-background-tasks
pi install git:github.com/asdfML/pi-pstack
```

Then run `/skill:setup-pstack` in Pi. The [guide](docs/guide/README.md) walks through the rest.

pi-pstack re-adds your lessons after a context compaction through `extensions/lessons-compaction.ts`.
pi-subagents loads it in background children only. The agents that write code for pstack (`poteto-agent`,
`general-purpose`) run in the background, and read-only reviewers never run `lessons.sh`. To cover
foreground children too, add that file's absolute path (`pi list` shows where the package is) to
`subagents.defaultSubagentOnlyExtensions` in `~/.pi/agent/settings.json`.
