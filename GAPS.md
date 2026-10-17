# Known gaps and open questions

Things the port does differently from upstream, or does not do yet. Each entry says what to
revisit.

## Limitations versus Cursor

- **No cloud workers.** Upstream `swarm` and `orchestrate` give each worker its own cloud VM:
  its own checkout, ports, and CPU. Pi runs workers locally. Rule for now:
  read-only lanes share the project directory; lanes that check out a SHA, build, or write get
  their own git worktree (`worktree: true`); lanes that run the app also get their own port from
  the brief; perf lanes run sequentially, never alongside other lanes.
  Later: spawn heavy lanes on devboxes or remote machines (for example through herdr), so
  swarm and orchestrate get real isolation and their own CPU again, as Cursor's cloud workers do.
- **Worktrees need a clean tree.** pi-subagents refuses `worktree: true` while the working tree
  has uncommitted changes. Skills tell the agent to commit or stash first, or to fall back to a
  separate output directory.
- **No skill-authoring loop.** Cursor's built-in `create-skill` runs draft, test, and iterate
  loops and a description-optimization loop. Pi has only its skills documentation, so `reflect`
  and the authoring playbook describe those loops in prose.
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
  parent; as fallbacks, `/skill:setup-pstack` sets `subagents.agentOverrides["poteto-agent"].defaultReads`
  to the skill's absolute path (pi-subagents skips the entry if the file is gone), and the agent
  can find the package with `pi list`. A pi-subagents option to pass hidden skills an agent
  definition names explicitly would remove these workarounds.
- **Nested subagent calls need permission.** With pi-permission-system set to ask, every
  `subagent` call a child makes goes to the main session's authorizer chain. Unattended runs need
  an auto-review model or allow rules for `subagent`, `bash`, `bg_run`, and the goal tools.
  Checked interactively, including depth-3 chains.
- **`auto` role value dropped.** Cursor's `auto` model alias has no Pi equivalent. Roles take
  `provider/id[:level]` or `inherit-parent`.

## Removed from the port

- `make-bot-ui`. Built on Cursor's Grok Bot webhook routines (`update_state`). Pi has no
  equivalent.
- `automations/benny`. Two Cursor Automations for Slack issue reports: one triages each report,
  the other reproduces confirmed bugs and may draft a fix. They run on Cursor's cloud automation
  product with Slack triggers. A Pi version could start each stage with a scheduled `subagent`
  run, an external trigger, or herdr, and read Slack through an MCP server.
- `plugin.json` and `.cursor-plugin/plugin.json`, the Cursor plugin manifests. `package.json` is
  the Pi manifest.

## Wake and loop mechanism

Cursor's `/loop` serves three uses in pstack. The port maps them to Pi packages, which makes the
port opinionated about the Pi stack.

- Loop until a predicate (Autonomous run, Visual parity, overnight runs): pi-goal-x.
- Periodic tick (`/loop 1h` audit in Multi-phase plan and Autopilot-full): a `bg_run` sleep
  timer whose exit wakes the session, rearmed after every tick. Without pi-background-tasks, a
  one-shot `schedule.create`, whose run notification wakes the session.
- Event wake (CI, merge, ref advancing): async subagent watcher or `bg_run`.

Checked in phase 4 with `pi --mode rpc` (a live session; `pi -p` exits after one turn, so nothing
can wake it): a pi-goal-x goal plus three 15-second `bg_run` timers wrote three ticks and completed
the goal. Two costs remain. While a timer runs, pi-goal-x sends continuation prompts, so the agent
spends two or three idle turns before the loop stops and the timer wakes it again. Once the agent
armed a second timer while one was still running. The `schedule.create` fallback is unchecked.

## Planned (from reviewing michael-denyer/pstack-claude)

- **Alternative wake mechanism.** pstack-claude ships its own `/loop` and `schedule_wakeup`
  (in-session re-prompt, MIT, about 230 lines). Revisit if the idle continuation turns of
  pi-goal-x plus `bg_run` timers cost too much.

## Open questions

- **Generated skills.** `create-verification-skill` and `automate-me` write new skills into the
  project's `.agents/skills/`. `pi update` does not touch them, so they do not get upstream fixes
  either. Amendments to pstack's own skills are solved by lesson files (**Lessons** in
  poteto-mode). Unchecked: how well agents follow lessons that conflict with the package text.

- **Concurrent lesson writes.** Several sessions can share one project lessons layer, for example
  task copies that link `.agents` to one workspace. Two sessions editing the same lesson file at
  once can lose one edit. There is no lock. Revisit if a lost lesson shows up.

- **Package dependencies.** Pi packages cannot declare other Pi packages as dependencies;
  `dependencies` in `package.json` only covers npm modules imported by extensions. Required:
  pi-subagents, pi-goal-x. Optional: pi-background-tasks, a todo tool, a question tool, an MCP
  adapter for `why` sources. The README lists the `pi install` lines, and `/skill:setup-pstack`
  checks which tools are present.
