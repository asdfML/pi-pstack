# Set up pstack

In this page you install the package, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the package

pi-pstack runs on two other Pi packages: pi-subagents for every subagent, and pi-goal-x for runs that go until a check passes. pi-background-tasks is optional and gives long runs their wake-up timers. In a terminal, run:

```text
pi install npm:pi-subagents
pi install npm:pi-goal-x
pi install npm:pi-background-tasks
pi install <pi-pstack source>
```

Use the pi-pstack source from the [README](../../README.md). `pi list` shows the installed packages.

If your Pi model is a `claude-bridge/...` model, give the pi-goal-x completion auditor a model outside claude-bridge. Otherwise the auditor inherits the bridge model, every request it makes fails, and goals pause instead of completing. Put this in `~/.pi/agent/pi-goal-x-settings.json`, replacing `<provider>/<model-id>` with any model `pi --list-models` shows that is not `claude-bridge/...`:

```json
{
  "model": "<provider>/<model-id>",
  "thinkingLevel": "high"
}
```

Open sessions pick it up after a restart or `/goal-refresh`. [GAPS.md](../../GAPS.md) has the cause.

## Pick your models

Run:

```text
/skill:setup-pstack
```

[`/skill:setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `pstack/models.md` in the Pi agent directory (`~/.pi/agent`, or `$PI_CODING_AGENT_DIR` when set), a small file every pstack skill reads when it spawns a subagent. Setup also checks the packages above and offers a third level of subagent nesting and a global Lessons block for direct skill calls. Package agents explicitly inherit project and global context; user overrides remain authoritative. Started inside a project, setup also offers to bind the tools the project uses, such as its forge and tracker, and drafts a recipe for a tool pstack has none for.

Out of the box every role selects your session's model without a reasoning override. The 13 roles remain editable text assignments. Missing panel configuration gives Arena, Architect, and Interrogate three inherited seats each; an explicit list sets its own length.

The budget adjusts each explicit model's role-relative effort. Hardest tasks start at `max`, ordinary code, prose, and judgment at `xhigh`, and workers, tooling, and panels at `high`. `unlimited` raises the base one step, `large` keeps it, `medium` lowers it one step, and `small` lowers it two. Setup chooses the highest supported level at or below that target and the configured ceiling, without changing the model identity. `inherit-parent` stays suffix-free. The role table in setup step 5 gives the exact assignments.

You only override what you care about. A role with no line in the file runs on your session's model. To restore that, delete the role's line. A rerun of `/skill:setup-pstack` starts from the file you have and keeps your choices.

Set a role to `inherit-parent` and pstack launches it with `model: "inherit"`. Omitting `model` can select an agent default instead. Any other value is a `provider/id[:level]` whose model `subagent({ action: "models" })` lists and whose level Pi supports. For a diverse review panel, give its entries models from different vendors. Arena's cross-judge eligibility and skip rules live in the [Arena skill](../../skills/arena/SKILL.md). For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/skill:swarm` worker unless a race names a model for each arm.

## Accept the verification offer, or don't

In step 10, `/skill:setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/skill:create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.agents/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/skill:create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

Then setup offers once to generate a formal verification skill with [`/skill:create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md), unless the project already has one. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Say yes when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. Otherwise say no, and run it later if that changes. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

The model file applies to the next subagent a skill spawns. There is nothing to restart.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/skill:setup-pstack` and pick a smaller reasoning budget or cheaper models. A strong model in the main chat with cheaper, faster models in the code roles is a good split.
- Set a role to `inherit-parent` so it runs on the session's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save `/skill:poteto-mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/skill:poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/skill:poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. `/skill:poteto-mode` attaches the skill to one message, and it fades as the chat moves on, so start each new task with it. For automatic routing, use the [manual opt-in recipe](./09-make-it-yours.md#opt-into-automatic-routing-manually). It is separate from setup.

Next: [Route work through `/skill:poteto-mode`](./02-poteto-mode.md).
