# Known gaps and open questions

Things the port does differently from upstream, or does not do yet. Each entry says what to
revisit.

## Limitations versus Cursor

- **No automatic per-worker VM provisioning.** Upstream `swarm` and `orchestrate` give each worker
  its own cloud VM: its own checkout, ports, and CPU. This port launches local workers on a shared
  host by default. This is a port limitation, not a claim that Pi has no remote execution support.
  The shared [Pi isolation procedure](skills/poteto-mode/references/pi-isolation.md) covers runnable
  checkouts, ports, shared resources, and sequential performance measurements. Remote placement
  would need explicit provisioning and the same resource-isolation guarantees.
- **Worktrees need a clean tree.** pi-subagents refuses `worktree: true` while the working tree
  has uncommitted changes. Pi isolation includes a scoped transfer to a separate runnable
  checkout without stashing or committing the user's work. An output directory alone is not
  a checkout. Reproduction setup is conditional on the work being run, not a universal gate.
- **No skill-authoring loop.** Cursor's built-in `create-skill` runs draft, test, and iterate
  loops and a description-optimization loop. Pi has only its skills documentation, so `reflect`
  and the authoring playbook describe those loops in prose.
- **Scale.** `orchestrate` assumes dozens to hundreds of subagents. Local parallelism is bounded
  by the machine and pi-subagents concurrency limits.

## External integrations

Integrations are configurable per project. Each capability (forge, CI, review bots, tracker,
chat, and the other evidence sources) resolves through `integrations.sh` to the tool the user bound,
and playbooks run each operation from that tool's recipe. A GitHub remote with no binding uses the
package's `github-gh` recipe. The agent reference is
[`references/integrations.md`](skills/poteto-mode/references/integrations.md), and the user guide
is [Bind your project's tools](docs/guide/09-make-it-yours.md#bind-your-projects-tools).

What remains:

- `watch-pr` works only on github.com, and its pass count covers only Bugbot threads. On another
  forge, Babysit and Shipping wait through the recipe's `watch` or a timer, and the pass count
  comes from the `review-bots` recipe.
- Bindings stay out of git through `.git/info/exclude`, and git treats excluded files as
  disposable. Checking out a branch that commits `.pi/pstack/` replaces the local files, and
  switching back deletes them. The scripts skip such a layer, but the local copy is already gone.
- Orchestrate uses PR and CI event subscriptions only when the bound tools provide them. Native
  subagent completion wakes are not forge events. Without external event delivery, report that
  limitation rather than promising unattended PR/CI monitoring or adding a polling loop.
- `worktree-audit.sh` reads PR state only when the forge resolves to `github-gh` or `origin`. Any
  other forge leaves the PR column at `-`.
- The package ships recipes only for `github-gh` and `origin`, plus the shared source playbooks in `skills/poteto-mode/integrations/sources/`
  (Linear, Slack, Notion, Datadog, Sentry, Databricks, code archaeology, incident postmortem).
  Every other tool needs a recipe the user writes or `/skill:setup-pstack` drafts.
- `/skill:setup-pstack` step 12, which binds the project's tools and drafts recipes, has not been
  run end to end.
- GitHub detection resolves an SSH host alias with `ssh -G`. It never connects, but it evaluates
  the user's SSH config, and a `Match exec` block runs its command (checked with a temporary
  config). Only `github.com` and `ssh.github.com` count, so a GitHub Enterprise remote stays
  unbound until the user binds it.

## Pi behavior the port works around

- **Hidden skills never reach subagents.** pi-subagents drops every skill with
  `disable-model-invocation: true` from a child's prompt, even when the agent names it in
  `skills`. Most workflow skills are hidden. The four discoverable skills are `setup-pstack`,
  `control-ui`, `control-cli`, and `deslop`. `poteto-agent` gets the poteto-mode path from its
  parent, or finds the package with `pi list`. Setup does not maintain `defaultReads` overrides.
- **Nested subagent calls need permission.** With pi-permission-system set to ask, every
  `subagent` call a child makes goes to the main session's authorizer chain. Unattended runs need
  an auto-review model or allow rules for `subagent`, `bash`, `bg_run`, and the goal tools.
  Checked interactively, including depth-3 chains. In an Eval, the authorizer can reject a
  candidate's launch or push, or be the only thing that stops a wrong action, so read its
  decisions before scoring an arm.
- **`auto` role value dropped.** Cursor's `auto` model alias has no Pi equivalent. Roles take
  `provider/id[:level]` or `inherit-parent`. The latter launches with `model: "inherit"`;
  omitting `model` can select an agent default instead.
- **Model capabilities differ.** Budgets adjust each role's base effort, then select a supported
  level at or below the target and configured ceiling without changing model identity. Priority
  service is conditional on runtime and model support and the user's cost and quota policy.
- **Context inheritance is configurable.** Package agents explicitly inherit project and global
  context. User overrides can disable it. The global Lessons offer does not guarantee propagation
  to unrelated agents.

## Partial upstream ports

The original import remains v0.15.25. Existing-workflow and minor changes are partially ported
from `bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7`, not a full v0.15.42 import. The
[coverage manifest](docs/guide/upstream-01542-coverage.md) classifies every changed-existing file.

- Formal verification generation and maintenance, statechart, and ketchup-video are imported.
  Statechart retains its pinned TLC, Java and test dependencies. Rendering uses the user's chosen
  Mermaid renderer, with the upstream Pele recipe available when selected. Text and tooling checks
  do not establish live agent behavior for generated proofs or rendered catch-up videos.
- Orchestrate now follows the upstream owner-per-PR protocol without `orch`. Its lightweight
  tracker is `orchestrate/<project-slug>/notes.md` under the existing shared Store. Existing old
  program files are not deleted or converted automatically. When picking up an old program,
  reconcile its PRs and current heads into the tracker before resuming work.
- Orchestrate requires a different-model-family verifier for each PR's merge pass. A single vendor
  does not imply multiple families are available. If no eligible verifier is available, report the
  gap without treating author verification as the required pass.
- Fixed model defaults remain excluded. Setup keeps user-selected models and `inherit-parent`.
- External Lessons handle amendments to pstack. Reflect edits an approved project or user copy
  of other installed skills, never their installed cache, and never pushes or opens a PR.
- Same-vendor cross-judging is skipped, not replaced with a judge from another connection to the
  same vendor. Arena still runs candidates and parent selection and discloses the omission.
- Documentation and static checks are not live evaluations of How, Why, Recall, Interrogate,
  Arena, Sharpen, or Autopilot. Live auth and goal caveats below still apply.

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

- Loop until a predicate uses pi-goal-x. Visual parity retains a predicate per component.
- Periodic ticks and event wakes follow [Pi waits](skills/poteto-mode/references/pi-waits.md).
  That procedure owns native completion, timer fallback, deduplication, and cleanup.

The following live checks predate the fidelity cleanup; they are evidence for those scenarios,
not a fresh evaluation of every caller.

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
Decision: pstack does not use strict mode and accepts the idle turns, because strict mode breaks
goals under claude-bridge (below). If idle turns on hour-long ticks cost too much, pstack-claude
(michael-denyer/pstack-claude) ships an in-session `/loop` and `schedule_wakeup` (MIT, about 230
lines) to port instead.

**pi-goal-x with pi-claude-bridge.** Two problems when the session model is a `claude-bridge` model
(seen with pi-goal-x 0.32.3 and pi-claude-bridge 0.9.3):

- The completion auditor can never approve, and without an auditor model of its own it uses the
  session model. claude-bridge forwards only system prompts it recorded in its own
  `before_agent_start` hook and fails any other request (`resolveOrDerive` in
  `src/prompt-capture.ts`; `prompt_capture_unresolved` in `claude-bridge-diag.log`). The auditor
  runs in an in-process `createAgentSession` without extensions, so that hook never sees its prompt.
  `runGoalCompletionAuditor` in `extensions/goal-auditor.ts` collects only text parts and drops the
  provider's `errorMessage`, so the rejection reads "Auditor produced no approval marker."
  `auditorProjectResources: true` does not help: the auditor session then loads its own
  claude-bridge instance, whose hook records the prompt in that instance's store, while the
  request still goes through the parent's provider and its store. Resolved by configuration: the
  auditor gets a model outside claude-bridge in `pi-goal-x-settings.json`, which approved and
  completed a goal in a live run. The setup guide (`docs/guide/01-setup.md`) tells users to set it.
- `update_goal` reaches the model turns after `create_goal`, not on the next turn, although
  pi-goal-x adds it before each turn. Unconfirmed cause: Claude Code gets the tool list only when
  the bridge starts a fresh query. In strict mode the goal pauses before the agent can declare
  `wait`, which is why pstack does not use strict mode.

## Open questions

- **Generated skills.** `create-verification-skill` and `automate-me` write new skills into the
  project's `.agents/skills/`. `pi update` does not touch them, so they do not get upstream fixes
  either. Amendments to pstack's own skills are solved by lesson files (**Lessons** in
  poteto-mode). Unchecked: how well agents follow lessons that conflict with the package text.

- **Lessons and context compaction.** `extensions/lessons-compaction.ts` repeats the output of the
  last `sh <path>/lessons.sh` run after a compaction drops it. It counts only a call that prints
  nothing but the script's output: the script by `sh` or by its path, optionally after a `cd` to an
  absolute path and with `--create` or `2>&1`. A session whose runs all take another form, such
  as `| head` or a chained command, gets no notice, and a rerun in another form does not stop the
  older lessons from coming back. The skill asks for the script in a call of its own. Checked live
  on all three compaction strategies: after a compaction the model quotes the lessons and treats
  them as amendments. Unchecked: that it acts on them.

- **Package dependencies.** Pi packages cannot declare other Pi packages as dependencies;
  `dependencies` in `package.json` only covers npm modules imported by extensions. Required:
  pi-subagents, pi-goal-x. Optional: pi-background-tasks, a todo tool, a question tool, an MCP
  adapter for bound evidence sources. The README lists the `pi install` lines, and `/skill:setup-pstack`
  checks which tools are present.
