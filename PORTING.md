# Porting pstack to Pi

## Philosophy

- **Port, not a rewrite.** Keep upstream wording, structure, and file layout. Change only the
  lines that name Cursor-only tools, paths, or products, so `git merge upstream` stays cheap.
- **No Cursor left behind.** The ported text names Pi tools and paths only. No references to
  Cursor features, built-ins, or names that do not exist in Pi.
- **Not opinionated about the user's stack.** The user picks models during `/skill:setup-pstack`,
  and the external tools (forge, CI, review bots, tracker, chat) per project, during setup or
  when a run first needs one. The port does not hardcode a provider or a model. Its only tool
  default is the forge of a GitHub remote with no binding, which is `gh`, or Origin when its CLI
  works there. The remaining limits are in [GAPS.md](GAPS.md).
- **Upstream skill names.** Skills keep their upstream names (`how`, `why`, `tdd`), with no
  `pstack-` prefix, to stay canonical with pstack.
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
| `~/.cursor/rules/pstack-models.mdc` | `~/.pi/agent/pstack/models.md` |
| `environment: "cloud"` | local run; isolation rule in GAPS.md |
| agent store (path in the system prompt) | `.pi/pstack/store/` in the main checkout, excluded with the rest of `.pi/pstack/` through `.git/info/exclude` (**Store** in poteto-mode) |
| `git show origin/main:pstack/skills/...` | read from the installed package (`<pstack>/...`) |
| Cursor restart | Pi restart; check `subagent({ action: "status" })` for surviving async runs |
| `/<skill>` | `/skill:<skill>` |
| `/loop until <predicate>` | pi-goal-x goal with the predicate as completion requirements |
| `/loop <interval> <tick>` | `bg_run` sleep timer rearmed after every tick; without `bg_run`, a one-shot `schedule.create` |
| event watcher that wakes the parent | async subagent or `bg_run` (pi-background-tasks) |
| `AskQuestion` | ask the user (structured question tool when available) |
| `~/.cursor/projects/*/agent-transcripts` | `~/.pi/agent/sessions/--<cwd>--/` for this workspace only (`<cwd>` without the leading `/`, each `/` as `-`; `$PI_CODING_AGENT_DIR` when set). Entries form a tree: follow `parentId` back from the last entry |
| Cursor built-in `create-skill` | the **Authoring or modifying a skill** playbook plus Pi's `docs/skills.md` |
| `cursor-team-kit` `deslop`, `control-ui`, `control-cli` | ported into this package, visible to the model as upstream (copyright Cursor, `LICENSE-cursor-team-kit`, `NOTICE.md`) |
| skills a skill generates for a project (`create-verification-skill`, `automate-me`) | `.agents/skills/<name>/` in the project |
| `gh` by default, Origin when its CLI resolves the repository | integrations; `integrations.sh` resolves the forge and playbooks run each operation from its recipe. The package ships the `github-gh` and `origin` recipes, with `github-gh` as the default for a github.com remote |
| built-in PR tool | removed; a PR tool from an MCP server or an extension is used only when the forge recipe names it |
| the project's choice of tools (upstream names its tools in the skill text) | `.pi/pstack/integrations/` (`bindings.md` and `recipes/`) in the project or a parent folder, or `~/.pi/agent/pstack/integrations/`, excluded from git like lessons (**Integrations** in poteto-mode) |
| edits to pstack's own skills (`reflect`, Bugbot learnings in Babysit, a broken skill mid-task) | lesson files that mirror the package path, in the project's `.pi/pstack/lessons/` or `pstack/lessons/` in the Pi agent directory (**Lessons** in poteto-mode); the package is never edited. Upstream has no compaction to survive; here `extensions/lessons-compaction.ts` re-adds the output of the last `lessons.sh` run after a compaction, unless the script ran again since |

## Tests

`extensions/lessons-compaction.test.ts` runs against the Pi pinned in the root `package.json`
`devDependencies`, not the Pi you have installed. Run `bun install` in the root once, then `bun test`.
When Pi updates, bump that pin to the new version and rerun the tests, or they keep checking the old behavior.
