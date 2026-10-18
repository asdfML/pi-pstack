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

If your Pi model is a `claude-bridge/...` model, give the pi-goal-x completion auditor a model outside claude-bridge. Otherwise the auditor inherits the bridge model, every request it makes fails, and goals pause instead of completing. Put this in `~/.pi/agent/pi-goal-x-settings.json`, with any model `pi --list-models` shows that is not `claude-bridge/...`:

```json
{
  "model": "openai-codex/gpt-6.1-sol",
  "thinkingLevel": "high"
}
```

Open sessions pick it up after a restart or `/goal-refresh`. [GAPS.md](../../GAPS.md) has the cause.

## Pick your models

Run:

```text
/skill:setup-pstack
```

[`/skill:setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `pstack/models.md` in the Pi agent directory (`~/.pi/agent`, or `$PI_CODING_AGENT_DIR` when set), a small file every pstack skill reads when it spawns a subagent. Setup also checks the packages above and offers three settings: a third level of subagent nesting, a lessons block so every session reads your amendments to pstack's skills, and an optional routing block that points every session at `/skill:poteto-mode`. Started inside a project, setup also offers to bind the tools the project uses, such as its forge and tracker, and drafts a recipe for a tool pstack has none for.

Out of the box every role runs on your session's model at your session's reasoning level. The budget sets the reasoning level of every role you give a model: `unlimited` is `max`, `large` is `xhigh`, `medium` is `high`, and `small` is `medium`. Lower budgets spend fewer tokens.

You only override what you care about. A role with no line in the file runs on your session's model. To restore that, delete the role's line. A rerun of `/skill:setup-pstack` starts from the file you have and keeps your choices.

Set a role to `inherit-parent` and pstack omits the subagent `model` field, so the subagent inherits your session's model. Any other value is a `provider/id[:level]` that `subagent({ action: "models" })` lists. For a diverse review panel, give its entries models from different providers. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/skill:swarm` worker unless a race names a model for each arm.

## Accept the verification offer, or don't

At the end of setup, `/skill:setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/skill:create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.agents/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/skill:create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

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

From here you can type normal follow-ups. `/skill:poteto-mode` attaches the skill to one message, and it fades as the chat moves on, so start each new task with it. To have every session reach for it on multi-file changes, design choices, and unknown bugs, accept the routing block when `/skill:setup-pstack` offers it.

Next: [Route work through `/skill:poteto-mode`](./02-poteto-mode.md).
