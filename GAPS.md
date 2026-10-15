# Known gaps and open questions

Things the port does differently from upstream, or does not do yet. Each entry says what to
revisit.

## Limitations versus Cursor

- **No cloud workers.** Upstream `swarm` and `orchestrate` give each worker its own cloud VM:
  its own checkout, ports, and CPU. Pi runs workers locally. Rule for now:
  read-only lanes share the project directory; lanes that check out a SHA, build, or write get
  their own git worktree (`worktree: true`); lanes that run the app also get their own port from
  the brief; perf lanes run sequentially, never alongside other lanes.
- **Scale.** `orchestrate` assumes dozens to hundreds of subagents. Local parallelism is bounded
  by the machine and pi-subagents concurrency limits.

## External integrations (make configurable later)

The first port keeps these as upstream wrote them. Next iteration: let `/skill:setup-pstack`
record which tools the user has, and make skills and playbooks use that.

- GitHub via `gh` (babysit, shipping, opening a PR, watch-pr).
- Bugbot and the agentic security reviewer (`references/bugbot-triage.md`). Generalize to any
  review bot.
- Origin CLI as a landing path in Shipping.
- `why` sources: Linear, Slack, Notion, Datadog, Sentry, Databricks.

## Pi behavior the port works around

- **Hidden skills never reach subagents.** pi-subagents drops every skill with
  `disable-model-invocation: true` from a child's prompt, even when the agent names it in
  `skills`. All pstack skills are hidden, so `poteto-agent` gets the poteto-mode path from its
  parent, and falls back to `pi list` to find the package directory.
- **`auto` role value dropped.** Cursor's `auto` model alias has no Pi equivalent. Roles take
  `provider/id[:level]` or `inherit-parent`.

## Removed from the port

- `make-bot-ui`. Built on Cursor's Grok Bot webhook routines (`update_state`). Pi has no
  equivalent. `poteto-help` and `docs/guide/09-make-it-yours.md` still mention it upstream.

## Wake and loop mechanism

Cursor's `/loop` serves three uses in pstack. The port maps them to Pi packages, which makes the
port opinionated about the Pi stack. Verify each mapping with a real run in phase 4.

- Loop until a predicate (Autonomous run, Visual parity, overnight runs): pi-goal-x.
- Periodic tick (`/loop 1h` audit in Multi-phase plan and Autopilot-full): pi-subagents
  `schedule.create`. The tick runs as a scheduled run whose notification wakes the session, not
  as the parent re-prompting itself. Check that this keeps the playbook's drift audit intact.
- Event wake (CI, merge, ref advancing): async subagent watcher or `bg_run`.

## Not ported yet

- `docs/guide/` (10 pages, about 1100 lines). A human tutorial: setup, poteto-mode, understand,
  design, build and clean, verify and ship, overnight runs, principles, making it yours, recipes
  and pitfalls. Not loaded by agents; `poteto-help` links to it. Decide whether to port, trim, or
  link upstream.

## Planned (from reviewing michael-denyer/pstack-claude)

- **Denylist check.** A script that fails when `skills/` or `agents/` still name Cursor-only
  things (`Cursor`, `Task` tool, `subagent_type`, `~/.cursor`, `AskQuestion`, `/loop`). Run it
  after every upstream merge.
- **NOTICE.md.** Per-component table: path, upstream commit, copyright holder, license file.
  cursor-team-kit is (c) Cursor, not Lauren Tan. The routing block in `setup-pstack` step 7 is
  adapted from pstack-claude's session-start text (MIT, (c) Michael Denyer); credit it there.
- **Single-family panels.** When the user's roles file resolves a panel to one model family,
  vary the reasoning level instead and say in the verdict that model diversity was reduced.
- **Per-skill Pi notes to write into the skills while porting:** `comment-sicko` never runs in a
  worktree (a worktree starts from `HEAD` and lacks uncommitted changes); the `why` synthesizer
  starts only after every investigator has reported; `create-verification-skill` and
  `automate-me` write to `.agents/skills/`.
- **Optional auto-routing.** pstack only runs when the user types `/skill:poteto-mode`, because
  every skill sets `disable-model-invocation`. `/skill:setup-pstack` offers to add a short
  routing paragraph to `~/.pi/agent/AGENTS.md` ("for multi-file changes, design choices, and
  unknown bugs, use `/skill:poteto-mode`"). Off unless the user opts in.
- **Alternative wake mechanism.** pstack-claude ships its own `/loop` and `schedule_wakeup`
  (in-session re-prompt, MIT, about 230 lines). Revisit if pi-goal-x plus `schedule.create`
  falls short in phase 4.

## Open questions

- **Generated and customized skills.** `create-verification-skill` and `automate-me` write new
  skills into the project's `.agents/skills/`. Unclear yet: how a generated skill relates to the
  package across `pi update` (it is not overwritten, but it does not get upstream fixes either),
  how a user customizes a packaged skill without forking (today: copy it into `.agents/skills/`,
  which collides by name with the packaged one), and whether pstack should support project
  overrides the way pstack-claude's project playbooks do.

- **Skill names.** `how`, `why`, `recall`, `correct`, `tdd` are generic and may collide with other
  packages. Decide on a `pstack-` prefix before a public release.
- **Package dependencies.** Pi packages cannot declare other Pi packages as dependencies;
  `dependencies` in `package.json` only covers npm modules imported by extensions. Required:
  pi-subagents, pi-goal-x. Optional: pi-background-tasks, a todo tool, a question tool, an MCP
  adapter for `why` sources. Plan: list them in the README with one `pi install` line, and have
  `/skill:setup-pstack` check which tools are present and tell the user what to install.
