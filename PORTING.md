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
- **Fix inline.** Replace Cursor names where they occur. Shared operational procedures for
  [isolation](skills/poteto-mode/references/pi-isolation.md),
  [waits](skills/poteto-mode/references/pi-waits.md), and
  [transcripts](skills/poteto-mode/references/pi-transcripts.md) avoid repeating the same steps.
  They are not a glossary agents use to translate Cursor terms at runtime.

The [intentional exceptions](docs/guide/upstream-exceptions.md) record the necessary differences
from the pinned comparison source, including the two minimal Statechart typecheck corrections.

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
| `-fast` model slugs, fast mode | no fixed slugs; request accelerated service only when the selected model and runtime support it and the user's cost and quota policy permits it |
| `~/.cursor/rules/pstack-models.mdc` | `pstack/models.md` in `$PI_CODING_AGENT_DIR`, else `~/.pi/agent`; 13 editable role assignments |
| `inherit-parent` role alias | explicit `model: "inherit"`, without a reasoning override; omission can select agent defaults |
| `environment: "cloud"` | local runnable checkouts per [Pi isolation](skills/poteto-mode/references/pi-isolation.md), not separate VMs |
| agent store (path in the system prompt) | `.pi/pstack/store/` in the main checkout, excluded with the rest of `.pi/pstack/` through `.git/info/exclude` (**Store** in poteto-mode) |
| `git show origin/main:pstack/skills/...` | read from the installed package (`<pstack>/...`) |
| Cursor restart | Pi restart; check `subagent({ action: "status" })` for surviving async runs |
| `/<skill>` | `/skill:<skill>` |
| `/loop until <predicate>` | pi-goal-x goal with the same predicate, per component for Visual parity |
| `/loop <interval> <tick>` | periodic continuation per [Pi waits](skills/poteto-mode/references/pi-waits.md) |
| event watcher that wakes the parent | native completion first, per [Pi waits](skills/poteto-mode/references/pi-waits.md) |
| `AskQuestion` | ask the user (structured question tool when available) |
| `~/.cursor/projects/*/agent-transcripts` | workspace-attributed Pi sessions and the active branch per [Pi transcripts](skills/poteto-mode/references/pi-transcripts.md), honoring the configured agent directory |
| Cursor built-in `create-skill` | the **Authoring or modifying a skill** playbook plus Pi's `docs/skills.md` |
| `cursor-team-kit` `deslop`, `control-ui`, `control-cli` | ported into this package, visible to the model as upstream (copyright Cursor, `LICENSE-cursor-team-kit`, `NOTICE.md`) |
| skills a skill generates for a project (`create-verification-skill`, `automate-me`) | `.agents/skills/<name>/` in the project |
| `gh` by default, Origin when its CLI resolves the repository | integrations; `integrations.sh` resolves the forge and playbooks run each operation from its recipe. The package ships the `github-gh` and `origin` recipes, with `github-gh` as the default for a github.com remote |
| built-in PR tool | removed; a PR tool from an MCP server or an extension is used only when the forge recipe names it |
| the project's choice of tools (upstream names its tools in the skill text) | `.pi/pstack/integrations/` (`bindings.md` and `recipes/`) in the project or a parent folder, or `~/.pi/agent/pstack/integrations/`, excluded from git like lessons (**Integrations** in poteto-mode) |
| edits to pstack's own skills (`reflect`, Bugbot learnings in Babysit, a broken skill mid-task) | lesson files that mirror the package path, in the project's `.pi/pstack/lessons/` or `pstack/lessons/` in the Pi agent directory (**Lessons** in poteto-mode); the package is never edited. Upstream has no compaction to survive; here `extensions/lessons-compaction.ts` re-adds the output of the last `lessons.sh` run after a compaction, when that run printed lessons and no later call ran the script in a form the extension counts |

## Partial upstream ports

Keep the original import baseline in [UPSTREAM.md](UPSTREAM.md). Record each partial port against
its pinned commit and classify every changed-existing file in the
[coverage manifest](docs/guide/upstream-01542-coverage.md). A partial port does not advance the
`upstream` baseline or imply that the complete release landed.

Shared evidence recipes belong to `skills/poteto-mode/integrations/sources/`, with their index at
`skills/poteto-mode/integrations/source-playbook.md`. Why and Recall consume them through the
existing integration bindings. Recipe names, overrides, `none`, and stale-binding handling remain
part of that contract. Why no longer owns a mandatory investigator sweep. Recall owns its own
investigators.

Keep Pi setup and external Lessons when upstream changes model defaults or edits installed skills.
Budgets adjust role-relative effort without changing model identity. Missing panel configuration
means three inherited seats; explicit lists retain their lengths. Setup writes the role file in
step 7, offers Lessons in step 8, verification in step 10, formal verification in step 11, and integrations in step 12.
Automatic routing is a [manual opt-in recipe](docs/guide/09-make-it-yours.md#opt-into-automatic-routing-manually),
not a setup step. Setup does not maintain `defaultReads`. Package agents explicitly inherit global
and project context, subject to user overrides.
Orchestrate follows the upstream owner-per-PR protocol without the old `orch` CLI. Map the Project
tracker and store to `orchestrate/<project-slug>/notes.md` under the existing shared Store. Use Pi
worker continuity only for state that needs it, not transcript fork as a substitute for a worker's
checkout or live processes. Keep conditional PR/CI subscriptions and disclose missing event delivery.
Formal verification generation and maintenance, statechart and ketchup-video are now imported. Keep statechart's executable logic and corpus unchanged; retain only the documented strict-typecheck corrections. Generated formal verify skills use the project's `.agents/skills/`. Renderer choice is the user's; the upstream Pele recipe remains conditional.

`node tools/check-docs.mjs` ports the upstream documentation check without its monorepo root or
README catalog assumptions. It checks the minimal README, guide, and help against the installed
skill tree. The guide owns the inventory. It does not traverse `node_modules` or `.pi`.

## Tests

The tests in `extensions/` run against the Pi pinned in the root `package.json`
`devDependencies`, not the Pi you have installed. On a fresh clone, run `bun install` in the root and in
`skills/poteto-mode/scripts`, then `bun test` in the root. When Pi updates, bump that pin to the new version
and run `bun install`. Until then the tests that compare the pin with the installed Pi and with `node_modules` fail.
The Codex replay test runs the pinned `pi-openai-toolkit`, the toolkit the Codex native compaction strategy uses.
When that strategy moves to a new toolkit version, bump this pin with it and run `bun install`.

Statechart retains its own upstream Node test runner. Install its pinned test dependency in
`skills/statechart/scripts`, then run `npm test` there. Set `TLA2TOOLS` to the pinned TLC 1.7.4 jar
and `JAVA` to a working JDK binary for the complete suite; without the jar, TLC-dependent tests skip.
On macOS, give the suite a canonical `TMPDIR`, obtained with
`node -e 'console.log(require("node:fs").realpathSync(require("node:os").tmpdir()))'`.
The upstream relative-symlink fixture otherwise constructs a broken link when `/var` aliases
`/private/var`. This is a process-local test environment setting, not a change to the imported code.
