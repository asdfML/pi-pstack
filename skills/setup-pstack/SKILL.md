---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget, check the Pi packages pstack needs, and optionally route larger tasks to poteto-mode automatically. Detects your available models and writes a roles file that overrides the skill defaults. Use for /skill:setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `pstack-models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR` when set, otherwise `~/.pi/agent`). pstack skills read it each time they spawn a subagent, so it sets pstack's model per role.

## Steps

### 1. Check dependencies

Look at the tools this session exposes. If only the `subagents_enable` loader is present, call it first. It counts as `subagent` being present.

- `subagent` (pi-subagents) is required. Every fan-out skill and every poteto-mode delegate runs through it. If it is missing, stop and tell the user to run `pi install npm:pi-subagents`.
- `create_goal` (pi-goal-x) is required for the Autonomous run playbook and other run-until-done work. If it is missing, tell the user to run `pi install npm:pi-goal-x`, then continue.
- Optional: a structured question tool, a todo tool, `bg_run` (pi-background-tasks), and an MCP gateway such as `mcp` (pi-mcp-adapter) for the **why** skill's sources. Report which are present. Do not push installs.

Then run `subagent({ action: "list" })`. It must show `poteto-agent`, `general-purpose`, `general-purpose-readonly`, and `comment-sicko`. If any is missing, the pstack package is not installed as a Pi package. Tell the user to `pi install` it.

### 2. Detect available models

Run `subagent({ action: "models" })`. It lists the models a subagent can use, as `provider/id`. That is the dependable source. If it fails, run `pi --list-models`. Never write a model you have not confirmed is available. `inherit-parent` is always valid even though it is not a detected model.

### 3. Load current state

The default for every role is `inherit-parent`: the subagent runs on the parent session's model. The role list is the file shape in step 6 below. If `pstack-models.md` already exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from the defaults. A line whose role is not in step 6 is from a retired role. Drop it.

### 4. Budget, map, and confirm

**(a) Ask for a budget.** Use a structured question tool when one is available, otherwise ask in plain text. Offer these four options with these exact labels, and name the current budget when the file records one. With no file, say that the defaults run every role on the parent model at the parent's reasoning level, so the budget applies only to roles the user assigns a model.

- `unlimited — max reasoning`
- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** Build the working table from the current choices. `unlimited`, `large`, `medium`, and `small` set the reasoning suffix of every `provider/id` value, panel entries included, to `:max`, `:xhigh`, `:high`, or `:medium`, replacing any suffix already there. `inherit-parent` takes no suffix and does not change.

**(c) Show the roles and confirm.** Show every role with its value, marking any model not in the detected set as needing a choice. Also list each line step 3 dropped. Ask whether to accept as-is or change specific roles, offering the detected models plus `inherit-parent` as the options. For panel roles (arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, `inherit-parent` entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena selects one value from it whose model family differs from the parent's when possible. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

**(d) Check panel diversity.** A panel catches more when its entries come from different model families. If every panel entry resolves to one family, `inherit-parent` included, tell the user that the panels will run the same model several times. The panel skills then vary the reasoning level across entries instead and say in their verdict that model diversity was reduced. When the detected set has models from another provider, offer to put them on the panels.

### 5. Validate

Every `provider/id` written must be in the detected set. `inherit-parent` always passes. If a chosen model is not available, stop and ask again.

### 6. Write the file

Write `pstack-models.md` with a `# budget` line naming the chosen label and its reasoning level, and one line per role, using the same labels poteto-mode uses. Overwrite the whole file so re-runs stay idempotent. Shape:

```
# pstack model configuration. One line per role. Delete a line to fall back to the default (inherit-parent).
# Values: `provider/id[:level]`, or `inherit-parent` to run the role on the parent session's model.
# Panel roles take a comma-separated list. One subagent runs per entry, so the list length sets the count.
# budget: large (xhigh)
feature, refactoring: inherit-parent
bug-fix: inherit-parent
perf-issue: inherit-parent
hillclimb: inherit-parent
judgment and prose: inherit-parent
hardest tasks: inherit-parent
how explorer: inherit-parent
how explainer: inherit-parent
why investigators: inherit-parent
why synthesizer: inherit-parent
reflect tooling: inherit-parent
reflect judgment, divergent, synthesizer: inherit-parent
arena runners: inherit-parent, inherit-parent
arena cross-judge pool: inherit-parent
swarm workers: inherit-parent
architect runners: inherit-parent, inherit-parent
interrogate reviewers: inherit-parent, inherit-parent
```

### 7. Offer automatic routing (optional)

Every pstack skill is hidden from automatic invocation, so pstack runs only when the user types `/skill:poteto-mode` or another `/skill:` command. Offer once to change that by adding a routing block to `AGENTS.md` in the Pi agent directory, which Pi loads into every session. Default to no. On yes, write the block below, filling in the absolute path of `../poteto-mode/SKILL.md` from this file. If the file already has a block between the markers, replace it. If the user asks to turn routing off, remove the block and its markers. Tell the user to re-run this skill if the pstack package moves, because the block names its path.

```
<!-- pstack-routing:start -->
## pstack routing

Read the poteto-mode skill at `<absolute path>/poteto-mode/SKILL.md` and follow it when a task meets any of these:

- it touches more than one file, or changes a signature other files call
- it involves a design or architecture choice
- it is a bug whose cause is not yet known, or a performance issue

For smaller tasks, such as a contained change to one file with an obvious test, a question, or a one-line edit, work directly and verify on the real artifact. When the intent is already specific, read that pstack skill from the same directory instead: `tdd`, `architect`, `how`, `why`, `arena`, `interrogate`.
<!-- pstack-routing:end -->
```

### 8. Confirm

Tell the user the file was written and that it applies to the next subagent a pstack skill spawns, with no restart. Re-running this skill updates it.

### 9. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /skill:create-verification-skill." On yes, run `/skill:create-verification-skill`. It writes the skill under the project's `.agents/skills/`. On no, move on without pushing.
