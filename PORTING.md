# Porting pstack to Pi

## Philosophy

- **Port, not a rewrite.** Keep upstream wording, structure, and file layout. Change only the
  lines that name Cursor-only tools, paths, or products, so `git merge upstream` stays cheap.
- **No Cursor left behind.** The ported text names Pi tools and paths only. No references to
  Cursor features, built-ins, or names that do not exist in Pi.
- **Not opinionated about the user's stack.** The user picks models, and later their external
  tools (tracker, chat, VCS host, review bots), during `/skill:setup-pstack`. The port does not
  hardcode a provider or a model. The first port keeps the external-tool text as upstream wrote
  it. Making it configurable is tracked in [GAPS.md](GAPS.md).
- **Fix inline.** Each skill carries its own Pi wording. No shared glossary that agents must read
  to translate Cursor terms at runtime.

## Cursor to Pi mapping

Reference for humans syncing upstream. Agents never read this file.

| Cursor | Pi |
|---|---|
| `Task` tool | `subagent` tool (pi-subagents) |
| `subagent_type: generalPurpose`, `readonly: true` | `agent: "general-purpose-readonly"` |
| `subagent_type: generalPurpose` (agent mode, MCP) | `agent: "general-purpose"` |
| `subagent_type: poteto-agent` | `agent: "poteto-agent"` |
| `run_in_background: true` | `async: true` |
| `model: <slug>` | `model: "<provider>/<id>[:<thinking>]"` from the user's roles file |
| `-fast` model slugs, fast mode | removed; the user configures speed in setup |
| `~/.cursor/rules/pstack-models.mdc` | `~/.pi/agent/pstack-models.md` |
| `environment: "cloud"` | local run; isolation rule in GAPS.md |
| `/<skill>` | `/skill:<skill>` |
| `/loop until <predicate>` | pi-goal-x goal with the predicate as completion requirements |
| `/loop <interval> <tick>` | pi-subagents `schedule.create` with `every` |
| event watcher that wakes the parent | async subagent or `bg_run` (pi-background-tasks) |
| `AskQuestion` | ask the user (structured question tool when available) |
| `~/.cursor/projects/*/agent-transcripts` | `~/.pi/agent/sessions/--<cwd>--/` for this workspace only (`<cwd>` without the leading `/`, each `/` as `-`; `$PI_CODING_AGENT_DIR` when set). Entries form a tree: follow `parentId` back from the last entry |
| Cursor built-in `create-skill` | `writing-for-agents` skill |
| `cursor-team-kit` `deslop`, `control-ui`, `control-cli` | ported into this package (copyright Cursor, needs `LICENSE-cursor-team-kit`) |
| skills a skill generates for a project (`create-verification-skill`, `automate-me`) | `.agents/skills/<name>/` in the project |
