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
the goal. Once the agent armed a second timer while one was still running, so the playbooks now
rearm only when the timer fires and check `bg_status` (or `schedule.list`) before arming.

Rechecked the same way after that fix. With `bg_run`, a watcher wake during a running 70-second
heartbeat armed nothing, and the heartbeat was armed exactly twice. Without `bg_run`, one-shot
`schedule.create` timers (`sessionOnly: true`, workflow `return "tick"`) woke the session twice;
goal continuations in between found the pending schedule through `schedule.list` and armed no
second one, and `schedule.delete` after each fire left no records behind.

While a timer runs, pi-goal-x sends continuation prompts, so a 70-second wait cost about ten idle
turns. pi-goal-x's `strictExecutionContract` setting removes them: the agent declares
`update_goal({ continuation: { kind: "wait", deadline } })` after arming a timer, and the `bg_run`
wake supersedes the wait. The same scenario took 6 turns instead of about 25. Strict mode is a user
setting, and it pauses the goal after any turn that ends without a `ready` or `wait` declaration.

**pi-goal-x with pi-claude-bridge.** Two problems when the session model is a `claude-bridge` model:

- The completion auditor can never approve. It runs in an in-process session without extensions,
  so claude-bridge never captured its system prompt and fails the request
  (`prompt_capture_unresolved` in `claude-bridge-diag.log`). pi-goal-x reads only text parts and
  drops the provider error, so the rejection reads "Auditor produced no approval marker."
  `auditorProjectResources: true` does not help. Workaround: an auditor model outside
  claude-bridge (`"model": "openai-codex/gpt-6.1-sol"` in `pi-goal-x-settings.json`), which
  approved and completed a goal in a live run.
- `update_goal` reaches the model turns after `create_goal`, not on the next turn. Claude Code
  appears to get the tool list only when the bridge starts a fresh query. In strict mode the goal
  pauses before the agent can declare `wait`.

## Planned (from reviewing michael-denyer/pstack-claude)

- **Alternative wake mechanism.** pstack-claude ships its own `/loop` and `schedule_wakeup`
  (in-session re-prompt, MIT, about 230 lines). Revisit if the idle continuation turns of
  pi-goal-x plus `bg_run` timers cost too much.

## Open questions

- **Generated skills.** `create-verification-skill` and `automate-me` write new skills into the
  project's `.agents/skills/`. `pi update` does not touch them, so they do not get upstream fixes
  either. Amendments to pstack's own skills are solved by lesson files (**Lessons** in
  poteto-mode). Unchecked: how well agents follow lessons that conflict with the package text.

- **Package dependencies.** Pi packages cannot declare other Pi packages as dependencies;
  `dependencies` in `package.json` only covers npm modules imported by extensions. Required:
  pi-subagents, pi-goal-x. Optional: pi-background-tasks, a todo tool, a question tool, an MCP
  adapter for `why` sources. The README lists the `pi install` lines, and `/skill:setup-pstack`
  checks which tools are present.
