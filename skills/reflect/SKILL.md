---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/skill:reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, find this conversation's transcript. Pi stores this workspace's sessions in `sessions/--<cwd>--/` under the Pi agent directory (`$PI_CODING_AGENT_DIR`, else `~/.pi/agent`), where `<cwd>` is the working directory without its leading `/` and with each `/` as `-`. Each `<timestamp>_<id>.jsonl` opens with a `type: "session"` header line. Every later line is an entry with an `id` and a `parentId`, and a message entry has `type: "message"` with `message.role` `user`, `assistant`, or `toolResult`. A file keeps abandoned branches, so follow `parentId` back from the last entry for the conversation that actually happened. Subagent transcripts live in that directory's `subagent-artifacts/*_transcript.jsonl`. Read only this workspace's directory. Do not glob across `sessions/*/`. That crosses workspace boundaries and reads private chats from unrelated projects.

```bash
ls -t <sessions-dir>/*.jsonl | head -10
```

For each candidate, find the first entry with `message.role` `user`. Take the file whose first user message contains the conversation's opening user prompt. If none matches, pass a tight digest of the session instead.

## 2. Spawn three reviewers in parallel

One message, three separate `subagent` calls (not a workflow), `agent: "general-purpose"`, `async: true`. Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and `general-purpose-readonly` has no MCP tools.

Each reviewer and the synthesizer name a role line in `pstack-models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR`, else `~/.pi/agent`). Set `model` to that line's value. Omit `model` when the file or the line is missing or the value is `inherit-parent`, so the subagent runs on the parent model. If `subagent` rejects a model, run that subagent on the parent model and say so. Pick each subagent's reasoning level for the job, per the Subagents section of the **poteto-mode** skill.

| Lens | Role line | Prompt template |
|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in their final response.

## 3. Synthesize

Once all three reviewers have reported, one `subagent` call, `agent: "general-purpose"`, `model` from the `reflect judgment, divergent, synthesizer` line. It spot-verifies citations through MCP, which `general-purpose-readonly` lacks. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): follow the **Authoring or modifying a skill** playbook in the **poteto-mode** skill and Pi's skills documentation (`docs/skills.md` in the Pi package), then draft, test, and iterate.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): rewrite its `description` per Pi's skills documentation, then check it against the prompts that should have triggered it.
- `new skill: <kebab-name>`: create it through the **Authoring or modifying a skill** playbook. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
