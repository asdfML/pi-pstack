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

## Open questions

- **Skill names.** `how`, `why`, `recall`, `correct`, `tdd` are generic and may collide with other
  packages. Decide on a `pstack-` prefix before a public release.
- **Package dependencies.** Pi packages cannot declare other Pi packages as dependencies;
  `dependencies` in `package.json` only covers npm modules imported by extensions. Required:
  pi-subagents, pi-goal-x. Optional: pi-background-tasks, a todo tool, a question tool, an MCP
  adapter for `why` sources. Plan: list them in the README with one `pi install` line, and have
  `/skill:setup-pstack` check which tools are present and tell the user what to install.
