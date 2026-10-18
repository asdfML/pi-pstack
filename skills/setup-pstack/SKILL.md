---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget, check the Pi packages pstack needs, and optionally route larger tasks to poteto-mode automatically. Detects your available models and writes a roles file that overrides the skill defaults. Use for /skill:setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `pstack/models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR` when set, otherwise `~/.pi/agent`). pstack skills read it each time they spawn a subagent, so it sets pstack's model per role.

## Steps

### 1. Check dependencies

Look at the tools this session exposes. If only the `subagents_enable` loader is present, call it first. It counts as `subagent` being present.

- `subagent` (pi-subagents) is required. Every fan-out skill and every poteto-mode delegate runs through it. If it is missing, stop and tell the user to run `pi install npm:pi-subagents`.
- `create_goal` (pi-goal-x) is required for the Autonomous run playbook and other run-until-done work. If it is missing, tell the user to run `pi install npm:pi-goal-x`, then continue.
- Optional: a structured question tool, a todo tool, `bg_run` (pi-background-tasks), and an MCP gateway such as `mcp` (pi-mcp-adapter) for the **why** skill's sources. Report which are present. Do not push installs.

Then run `subagent({ action: "list" })`. It must show `poteto-agent`, `general-purpose`, `general-purpose-readonly`, and `comment-sicko`. If any is missing, the pstack package is not installed as a Pi package. Tell the user to `pi install` it.

### 2. Allow one more level of nesting

pi-subagents allows two levels below the main session by default. pstack chains can need three, for example `poteto-agent` running `no-comments`, whose `comment-sicko` then runs the **how** skill's explorers. Read `extensions/subagent/config.json` in the Pi agent directory. If `maxSubagentDepth` is missing or below 3, offer once to set it to 3, keeping every other key, and confirm the file still parses as JSON. `PI_SUBAGENT_MAX_DEPTH`, when set, overrides the file, so mention it if it is set below 3. On no, say that the deepest chains will stop at the second level.

If a permission extension gates tool calls, tell the user that a nested `subagent` call may ask for approval, and that in a non-interactive run (`pi -p`) an unapproved call is rejected.

### 3. Point the pstack agents at this package

A parent passes `poteto-agent` the absolute path of the poteto-mode skill in every prompt. As a fallback that needs no shell, pi-subagents can hand the agent that path itself through `defaultReads`. Offer once to set it, and set it on yes. Re-running this skill keeps it current.

- The path is `poteto-mode/SKILL.md` in the directory that holds this skill's directory. Resolve it to an absolute path.
- Read `settings.json` in the Pi agent directory. Set `subagents.agentOverrides["poteto-agent"].defaultReads` to a one-entry list with that path. Keep every other key and every other override field as it is. Write the file back and confirm it still parses as JSON.
- If a `defaultReads` entry is already there and names another path, the package moved since the last run. Say so and replace it. A path whose file no longer exists is harmless, because pi-subagents skips missing files, but replace it too.
- On no, change nothing. The parent's path and the agent's `pi list` lookup still work.

### 4. Detect available models

Run `subagent({ action: "models" })`. It lists the models a subagent can use, as `provider/id`. That is the dependable source. If it fails, run `pi --list-models`. Never write a model you have not confirmed is available. `inherit-parent` is always valid even though it is not a detected model.

### 5. Load current state

The default for every role is `inherit-parent`: the subagent runs on the parent session's model. The role list is the file shape in step 8 below. If `pstack/models.md` already exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from the defaults. A line whose role is not in step 8 is from a retired role. Drop it.

### 6. Budget, map, and confirm

**(a) Ask for a budget.** Use a structured question tool when one is available, otherwise ask in plain text. Offer these four options with these exact labels, and name the current budget when the file records one. With no file, say that the defaults run every role on the parent model at the parent's reasoning level, so the budget applies only to roles the user assigns a model.

- `unlimited — max reasoning`
- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** Build the working table from the current choices. `unlimited`, `large`, `medium`, and `small` set the reasoning suffix of every `provider/id` value, panel entries included, to `:max`, `:xhigh`, `:high`, or `:medium`, replacing any suffix already there. `inherit-parent` takes no suffix and does not change.

**(c) Show the roles and confirm.** Show every role with its value, marking any model not in the detected set as needing a choice. Also list each line step 5 dropped. Ask whether to accept as-is or change specific roles, offering the detected models plus `inherit-parent` as the options. For panel roles (arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, `inherit-parent` entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena selects one value from it whose model family differs from the parent's when possible. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

**(d) Check panel diversity.** A panel catches more when its entries come from different model families. If every panel entry resolves to one family, `inherit-parent` included, tell the user that the panels will run the same model several times. The panel skills then vary the reasoning level across entries instead and say in their verdict that model diversity was reduced. When the detected set has models from another provider, offer to put them on the panels.

### 7. Validate

Every `provider/id` written must be in the detected set. `inherit-parent` always passes. If a chosen model is not available, stop and ask again.

### 8. Write the file

Write `pstack/models.md` with a `# budget` line naming the chosen label and its reasoning level, and one line per role, using the same labels poteto-mode uses. Overwrite the whole file so re-runs stay idempotent. Shape:

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

### 9. Offer automatic routing (optional)

Every pstack skill is hidden from automatic invocation, so pstack runs only when the user types `/skill:poteto-mode` or another `/skill:` command. Offer once to change that by adding a routing block to `AGENTS.md` in the Pi agent directory, which Pi loads into every session. Default to no. On yes, write the block below, filling in the absolute path of `../poteto-mode/SKILL.md` from this file. If the file already has a block between the markers, replace it. If the user asks to turn routing off, remove the block and its markers. If a block already exists and names another path, the package moved since the last run. Say so and update the path even when the user keeps routing on.

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

### 10. Turn on lessons

pstack keeps the user's amendments to its skills as lessons outside the package, in the layers the **Lessons** section of `../poteto-mode/SKILL.md` defines. That section reaches only runs under poteto-mode. Offer once to add the block below to `AGENTS.md` in the Pi agent directory, so a direct `/skill:how` and the subagents of every pstack skill read lessons too. Default to yes. Fill in the absolute path of the directory that holds this skill's directory. Replace an existing block between the markers, and update its paths if the package moved. On no, say that lessons apply only under poteto-mode.

```
<!-- pstack-lessons:start -->
## pstack lessons

Before you follow a skill from `<absolute path>/`, a skill invoked with `/skill:` included, run `<absolute path>/poteto-mode/scripts/lessons.sh` from the working directory once per session and apply the lessons it prints for the files you use. A lesson adds to the file. On a conflict the later lesson in the script's output wins, and every lesson wins over the file. Write lessons per the Lessons section of `<absolute path>/poteto-mode/SKILL.md`, never into the package.
<!-- pstack-lessons:end -->
```

### 11. Confirm

Tell the user the file was written and that it applies to the next subagent a pstack skill spawns, with no restart. Re-running this skill updates it.

### 12. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /skill:create-verification-skill." On yes, run `/skill:create-verification-skill`. It writes the skill under the project's `.agents/skills/`. On no, move on without pushing.

### 13. Offer to bind the project's tools (optional)

Run `sh <absolute path>/poteto-mode/scripts/integrations.sh` from the starting directory, filling in the absolute path of the directory that holds this skill's directory. If it prints `project write target: none`, there is no project layer to write, so skip this step and say why. Otherwise offer once to bind the tools this project uses for the capabilities in `../poteto-mode/references/integrations.md`, such as its forge, CI, and tracker. Default to yes, since nothing is written until the user confirms a tool. On no, say that each capability resolves when a run first needs it, and that an unbound one is asked about then or skipped in an autonomous run.

On yes:

1. Show each key from the script's output in one short table, with its status and the file or recipe it resolved to.
2. Ask which keys to set now. For each one, follow the `unbound` procedure in `../poteto-mode/references/integrations.md`. Gather candidates with their evidence, ask which one to bind, write the binding only after the user confirms and, for a tool with no recipe, after step 3 writes its recipe, and ask where it belongs. `none` is a valid answer. Record it like any other binding.
3. When the chosen tool has no recipe in any layer or the package, draft `recipes/<name>.md` in the binding's layer from the tool's own description. Its first line names the tool it drives. Read `mcp({ describe: "<tool>" })` for each MCP tool the recipe calls, or `<cli> --help` and `<cli> <subcommand> --help` for a CLI. For `forge`, give the draft one `## <operation>` section for each `## ` heading of the package's `github-gh` recipe. For `ci`, the sections are `checks`, `logs`, `rerun`, and `watch`. For an evidence key (`tracker`, `docs`, `chat`, `observability`, `errors`, `analytics`), the recipe is one investigator playbook: bind a playbook from `../why/references/sources/` by name when one fits the tool, or adapt the closest one to the tool. For `review-bots`, the recipe names the bots, how a pass ends, and how to count passes. Show the draft. Check it with one read-only operation, such as `view` on an existing PR the user names for the forge or one search for an evidence key. A check never runs a write operation. Write the recipe after the user confirms, then the binding. If the user rejects the draft, write no binding.
4. Rerun the script and report each key you set with the status it now resolves to.
