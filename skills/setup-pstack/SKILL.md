---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget, and check the Pi packages pstack needs. Detects your available models and writes a roles file that overrides the skill defaults. Use for /skill:setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `pstack/models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR` when set, otherwise `~/.pi/agent`). pstack skills read it each time they spawn a subagent, so it sets pstack's model per role.

## Steps

### 1. Check dependencies

Look at the tools this session exposes. If only the `subagents_enable` loader is present, call it first. It counts as `subagent` being present.

- `subagent` (pi-subagents) is required. Every fan-out skill and every poteto-mode delegate runs through it. If it is missing, stop and tell the user to run `pi install npm:pi-subagents`.
- `create_goal` (pi-goal-x) is required for the Autonomous run playbook and other run-until-done work. If it is missing, tell the user to run `pi install npm:pi-goal-x`, then continue.
- Optional: a structured question tool, a todo tool, `bg_run` (pi-background-tasks), and an MCP gateway such as `mcp` (pi-mcp-adapter) for evidence sources. Report which are present. Do not push installs.

Then run `subagent({ action: "list" })`. It must show `poteto-agent`, `general-purpose`, `general-purpose-readonly`, and `comment-sicko`. If any is missing, the pstack package is not installed as a Pi package. Tell the user to `pi install` it.

### 2. Allow one more level of nesting

pi-subagents allows two levels below the main session by default. pstack chains can need three, for example an Autopilot PR owner delegating code to a `poteto-agent`, which runs `no-comments` and spawns `comment-sicko`. Read `extensions/subagent/config.json` in the Pi agent directory. If `maxSubagentDepth` is missing or below 3, offer once to set it to 3, keeping every other key, and confirm the file still parses as JSON. `PI_SUBAGENT_MAX_DEPTH`, when set, overrides the file, so mention it if it is set below 3. On no, say that the deepest chains will stop at the second level.

If a permission extension gates tool calls, tell the user that a nested `subagent` call may ask for approval, and that in a non-interactive run (`pi -p`) an unapproved call is rejected.

### 3. Detect available models

Run `subagent({ action: "models" })`. It lists the models a subagent can use, as `provider/id`. That is the dependable source. If it fails, run `pi --list-models`. Never write a model you have not confirmed is available. `inherit-parent` is always valid even though it is not a detected model.

### 4. Load current state

The default for every role is `inherit-parent`. Pass `model: "inherit"` to select the current parent model, without a thinking suffix or override. Omitting `model` instead allows Pi's agent overrides and defaults to select a different model. The role list is the file shape in step 7 below. If `pstack/models.md` already exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from the defaults. A line whose role is not in step 7 is from a retired role. Drop it.

### 5. Budget, map, and confirm

**(a) Ask for a budget.** Use a structured question tool when one is available, otherwise ask in plain text. Offer these four options with these exact labels, and name the current budget when the file records one. With no file, say that the defaults select the parent model without overriding reasoning, so the budget applies only to roles the user assigns an explicit model.

- `unlimited — max reasoning`
- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** Build the working table from the current choices, keeping every model identity and panel list. Each role has a target effort, its base effort moved by the budget.

| Role | Base effort |
| --- | --- |
| `feature, refactoring` | `xhigh` |
| `bug-fix` | `xhigh` |
| `perf-issue` | `xhigh` |
| `hillclimb` | `xhigh` |
| `judgment and prose` | `xhigh` |
| `hardest tasks` | `max` |
| `reflect tooling` | `high` |
| `reflect judgment, divergent, synthesizer` | `xhigh` |
| `arena runners` | `high` |
| `arena cross-judge pool` | `high` |
| `swarm workers` | `high` |
| `architect runners` | `high` |
| `interrogate reviewers` | `high` |

`large` keeps the base, `unlimited` raises it one step, `medium` lowers it one step, and `small` lowers it two steps, clamped on the ladder `low`, `medium`, `high`, `xhigh`, `max`. Most roles start at `xhigh`, and each budget label names where those land. Replace only the reasoning suffix of each explicit model, panel entries included. `inherit-parent` takes no suffix and does not change.

Use the current Pi model metadata (`reasoning` and `thinkingLevelMap`) to choose the highest supported level at or below the target and any configured thinking ceiling. A non-reasoning model supports only `off`. For reasoning models without a level map, Pi core supports through `high`; `null` excludes a level and `xhigh` and `max` require explicit mappings. Select the level before launch rather than relying on Pi's runtime clamp, which can choose a higher level. The lower fallback ladder also includes `minimal` and `off`. If no supported level fits, or metadata is unavailable, mark the role as needing a choice. Never substitute a different model merely to obtain an effort level. Do not rewrite Pi defaults or agent overrides. Per-run model selection follows Pi's normal precedence; configured thinking defaults, ceilings and model-scope policies still apply.

**(c) Show the roles and confirm.** Show every role with its value, marking any model not in the detected set as needing a choice. Also list each line step 4 dropped. Ask whether to accept as-is or change specific roles, offering the detected models plus `inherit-parent` as the options. For panel roles (arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, `inherit-parent` entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena runs one judge. It tries only values from a model vendor other than the parent's, in list order, so order it by preference. Follow Arena's Phase C eligibility and skip rules. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

**(d) Check panel diversity.** A panel catches more when its entries come from different model families. If every panel entry resolves to one family, `inherit-parent` included, tell the user that model diversity is reduced. When the detected set has models from another family, offer to put them on the panels.

### 6. Validate

Every base `provider/id` written must be in the detected set, with a supported suffix within the configured thinking ceiling and model scope. `inherit-parent` needs no suffix validation and remains subject to Pi's runtime policies. If a chosen model or level is not available, stop and ask again.

### 7. Write the file

Write `pstack/models.md` with a `# budget` line naming the chosen label and its reasoning level, and one line per role, using the same labels poteto-mode uses. Overwrite the whole file so re-runs stay idempotent. Shape:

```
# pstack model configuration. One line per role. Delete a line to fall back to the default (inherit-parent).
# Values: `provider/id[:level]`, or `inherit-parent` to select the parent session's model via model: "inherit".
# Panel roles take a comma-separated list. One subagent runs per entry, so the list length sets the count.
# budget: large (xhigh)
feature, refactoring: inherit-parent
bug-fix: inherit-parent
perf-issue: inherit-parent
hillclimb: inherit-parent
judgment and prose: inherit-parent
hardest tasks: inherit-parent
reflect tooling: inherit-parent
reflect judgment, divergent, synthesizer: inherit-parent
arena runners: inherit-parent, inherit-parent, inherit-parent
arena cross-judge pool: inherit-parent
swarm workers: inherit-parent
architect runners: inherit-parent, inherit-parent, inherit-parent
interrogate reviewers: inherit-parent, inherit-parent, inherit-parent
```

### 8. Turn on lessons

pstack keeps the user's amendments to its skills as lessons outside the package, in the layers the **Lessons** section of `../poteto-mode/SKILL.md` defines. That section reaches only runs under poteto-mode. Offer once to add the block below to `AGENTS.md` in the Pi agent directory, so direct skill calls read lessons too. Package agents inherit global and project context explicitly; user overrides can disable that inheritance. Default to yes. Fill in the absolute path of the directory that holds this skill's directory. Replace an existing block between the markers after reconciling any different configured path with the user's choice. A different path alone does not prove the package moved. On no, say that this setup adds no global Lessons instruction.

```
<!-- pstack-lessons:start -->
## pstack lessons

Before you follow a skill from `<absolute path>/`, a skill invoked with `/skill:` included, run `sh <absolute path>/poteto-mode/scripts/lessons.sh` from the working directory once per session, in a bash call of its own with no `cd`, pipe, redirection, or other command, and apply its output per the authoritative Lessons section of `<absolute path>/poteto-mode/SKILL.md`. Read that section for precedence and writing rules. Write amendments outside the package, never into it.
<!-- pstack-lessons:end -->
```

### 9. Confirm

Tell the user the file was written and that it applies to the next subagent a pstack skill spawns, with no restart. Re-running this skill updates it.

### 10. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /skill:create-verification-skill." On yes, run `/skill:create-verification-skill`. It writes the skill under the project's `.agents/skills/`. On no, move on without pushing.

### 11. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /skill:create-formal-verification-skill." On yes, invoke `/skill:create-formal-verification-skill` (resolves wherever pstack is installed: workspace, user, or package). On no, move on without pushing.

### 12. Offer to bind the project's tools (optional)

Run `sh <absolute path>/poteto-mode/scripts/integrations.sh` from the starting directory, filling in the absolute path of the directory that holds this skill's directory. If it prints a plain `project write target: none`, there is no project here, as in the home directory, so skip this step and say why. If it prints `none` because git tracks the project's layer, say so, and in the offer below name only the user layer as the place for a binding. Offer once to bind the tools this project uses for the capabilities in `../poteto-mode/references/integrations.md`, such as its forge, CI, and tracker. Default to yes, since nothing is written until the user confirms a tool. On no, say that each capability resolves when a run first needs it, and that an unbound one is asked about then or skipped in an autonomous run.

On yes:

1. Show each key from the script's output in one short table, with its status and the file or recipe it resolved to.
2. Ask which keys to set now. For each one, follow the `unbound` procedure in `../poteto-mode/references/integrations.md`. Gather candidates with their evidence, ask which one to bind and where it belongs, and write the binding only after the user confirms and, for a tool with no recipe, after step 3 writes its recipe. For this project's layer, first run the same script with `--create` from the main checkout and write into the target it prints. When it prints `project write target: none, because …`, write nothing there and say why. A binding of `none` is a valid answer. Record it like any other binding.
3. When the chosen tool has no recipe in any layer or the package, draft `recipes/<name>.md` in the binding's layer from the tool's own description. Read `mcp({ describe: "<tool>" })` for each MCP tool the recipe calls, or `<cli> --help` and `<cli> <subcommand> --help` for a CLI. For `forge` and `ci`, the draft's first line names the tool it drives. For `forge`, give the draft one `## <operation>` section for each `## ` heading of the package's `github-gh` recipe. For `ci`, the sections are `checks`, `logs`, and `rerun`, plus `watch` when the tool can wait until the checks finish. For an evidence key (`tracker`, `docs`, `chat`, `observability`, `errors`, `analytics`), the recipe is one source playbook: bind a playbook from `../poteto-mode/integrations/sources/` by name when one fits the tool, or adapt the closest one to the tool. Its binding's notes name the tool. For `review-bots`, the recipe names the bots, how a pass ends, and how to count passes. Show the draft. Check it with one read-only operation, such as `view` on an existing PR the user names for the forge or one search for an evidence key. A check never runs a write operation. Write the recipe after the user confirms, then the binding. If the user rejects the draft, write no binding.
4. Rerun the script and report each key you set with the status it now resolves to.
