---
name: why
description: "Use for 'why does X work this way', 'why we picked Y', design rationale, regressions, postmortems, or data-backed thresholds. Resolves the project's bound sources and queries each evidence category (source control, issue tracker, long-form docs, real-time chat, infrastructure observability, error tracking, product analytics warehouse) in parallel, then returns a cited read on decisions and tradeoffs. Use how for runtime behavior."
disable-model-invocation: true
---

# Why

Investigate the motivation and intent behind code. The companion `how` skill answers what the code does and how it works. `why` answers what forces led to its shape.

Each spawn below names a role line in `pstack/models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR`, else `~/.pi/agent`). Set `model` to that line's value. Omit `model` when the file or the line is missing or the value is `inherit-parent`, so the subagent runs on the parent model. If `subagent` rejects a model, run that subagent on the parent model and say so. Pick each subagent's reasoning level for the job, per the Subagents section of the **poteto-mode** skill.

Every spawn is a `subagent` call with `agent: "general-purpose"`, which runs in the background and keeps the session's MCP tools. **Do not use `general-purpose-readonly`.** It has no MCP tools, which disables the MCP-backed investigators and the synthesizer's citation spot-checks. Investigators still shouldn't write anything.

## Operating Posture

Operate as a **careful, cautious, and precise investigator**. Be honest about what you know vs what you're inferring. Read `references/epistemics.md` for the full confidence framework and phrasing guide. The synthesizer must follow it.

## Step 1. Understand the Target and the Question

The **target** is usually a chunk of code, a pattern, a feature, or a named design decision. The **question** is usually a design rationale, a tradeoff, a motivating edge case, an external constraint, dead code, or a broad history sweep.

If the target is vague ("why do we do it this way?" with no clear referent), make your best guess from conversation context (open files, recent edits, cursor location, what was just discussed). State your interpretation briefly so the user can redirect if you're off, then proceed.

## Step 2. Establish the Code Anchor

Before spawning investigators, build the seed context inline: file paths and line ranges, key symbols (functions, classes, constants), the last few commits touching the target, PR numbers from merge commits (pattern `(#1234)` in the subject line), and any linked ticket IDs. Run `git blame -L <start>,<end> <file>` for last-touch commits, `git log --follow -p -- <file>` for full history with patches through renames, `git log --oneline -20 -- <file>` for recent commits with PR numbers visible, and `git log -1 --format=%B <commit>` to extract PR numbers. Then pull the PR bodies and discussion for any substantive commit with the forge recipe's `view`, resolved per `../poteto-mode/references/integrations.md`, and read the title, body, author, createdAt, mergedAt, labels, closing issue references, comments, and reviews. When the forge is `none` or unbound, anchor on git alone and record that the PR discussion was not read. This anchor goes to every investigator and to the synthesizer.

## Step 3. Spawn Parallel Investigators

**Default to the full parallel investigation.** The goal is a complete coverage map, not a minimal one. Document the null, don't skip the search.

### Discovery

Before spawning investigators, run `sh <this skill's directory>/../poteto-mode/scripts/integrations.sh tracker docs chat observability errors analytics` by absolute path from the starting directory. Each evidence category is one integration key:

1. Source control history (git, plus the `forge` binding)
2. Issue / ticket tracker (`tracker`)
3. Long-form documents (`docs`)
4. Real-time team chat (`chat`)
5. Infrastructure observability (`observability`)
6. Error / exception tracking (`errors`)
7. Product analytics warehouse (`analytics`)

Source control is always available through git, with PR discussion from the forge recipe. For the other six, act on each key's status per `../poteto-mode/references/integrations.md`:

- `bound`. One investigator for that key, owning the bound tool, with the recipe as its source playbook and the binding's notes.
- `none`. No investigator. Sources Consulted says the project does not use that category.
- `unbound`. In an interactive top-level run, gather the visible MCPs and CLIs as the reference's `unbound` rule says, and classify them into the categories using the name, server instructions, tool names, and resource descriptors. If a tool could fit more than one category, choose the one matching its primary evidence and record the ambiguity in the coverage map. Propose the candidates and ask the user once for all unbound keys together, with `none` allowed. Write the confirmed bindings per the reference, then spawn. In an autonomous run or in a subagent, skip the key and record the gap.
- A stale binding (`recipe missing`, `invalid`, or a bound tool that is not there) follows the reference, and the key is recorded as a gap.

Never spawn an investigator for a tool only because it is visible.

Spawn one investigator per bound category plus source control, all in a single message as separate `subagent` calls (not a workflow) so they run concurrently, each owning exactly one tool or MCP. Don't ask one agent to cover multiple MCPs. `model`: the `why investigators` line.

Each investigator's prompt is `references/investigator-prompt.md` filled in, plus:
- the source playbook the binding resolves to, at the recipe path `integrations.sh` printed (a `references/sources/<source>.md` playbook when the binding names one), with the binding's notes. Source control uses `references/sources/code-archaeology.md`.
- `references/sources/incident-postmortem.md` **if the target code looks defensive** (null checks, retry logic, timeout handling, rate limiting, feature flags, egress guards, OOM handlers)
- the code anchor and the user's original question

### Investigator roster, one per bound evidence category

Each category below is uniquely positioned to surface one shape of "why", shown after "Best at". Use it to know what to expect back, to name a gap when a category returns empty, and, only in the rare provably-irrelevant case, to justify a skip.

1. **Source control** (git history, the forge recipe for PRs, code comments, tests). Always spawn, the only guaranteed source. Best at *implementation-time rationale captured during review*.
2. **Issue / ticket tracker** (e.g. Linear, Jira, GitHub Issues, Plane, Shortcut MCP). Best at *the product or business forcing function*. Strongest when the why is external to engineering.
3. **Long-form documents** (e.g. Notion, Confluence, Google Docs, Coda MCP). Best at *long-form design rationale*, written out before it becomes code.
4. **Real-time team chat** (e.g. Slack, Discord, Microsoft Teams, Mattermost MCP). Best at *real-time deliberation that never reached a doc*. Especially important when the source control, ticket, and doc paper trail is thin.
5. **Infrastructure observability** (e.g. Datadog, New Relic, Honeycomb, Grafana, Splunk MCP). Best at *infrastructure and runtime reality that motivated the code*. Strongest when the target reacts to an infra signal (timeouts, retries, rate limits, circuit breakers).
6. **Error / exception tracking** (e.g. Sentry, Rollbar, Bugsnag, Airbrake MCP). Best at *the specific exceptions and error trajectories that motivated defensive or corrective code*. Strongest for catch blocks, null guards, type checks, retries, and other defenses.
7. **Product analytics warehouse** (e.g. Databricks, Snowflake, BigQuery, ClickHouse, dbt, Redshift MCP). Best at *product and data reality that shaped the code*. Strongest for flag-gated code, experiment-driven ships, data migrations, and "where did this number come from" questions.

### When to skip an investigator

Only with an **explicit, written justification** that goes in the final Sources Consulted. Two valid reasons:

- **No tool is bound for that category.** For `none`, say the project does not use it: "Real-time team chat skipped. The project does not use team chat." For an unbound or stale key, flag it as a gap, not a choice: "Real-time team chat skipped. No chat tool is bound, so the conversational record was not searchable."
- **The source is provably irrelevant**, not just "probably irrelevant." A high bar: "Error / exception tracking skipped. Target is a build-time script with no runtime code path."

If your scope assessment suggests a single-commit trivial target where the PR description already contains the complete answer, you may answer inline **only after** confirming all seven available category searches would be redundant. Say so explicitly. This should be rare.

## Step 4. Synthesize

Spawn one synthesizer only after every investigator has reported, because their reports are its input. `model`: the `why synthesizer` line. It gets:
1. The investigator findings, including any null results and any categories skipped with justification
2. The code anchor
3. The user's original question
4. The epistemics framework from `references/epistemics.md`
5. The synthesizer prompt template from `references/synthesizer-prompt.md`

## Step 5. Present

Present the synthesizer's output to the user. You may lightly edit for clarity or add context from the conversation, but **do not rewrite the confidence language**.

## Output Format

The structure is the one in `references/synthesizer-prompt.md`: The Question, The Code in Question, What We Found, What We Can Reasonably Infer, Competing Hypotheses, What We Don't Know, Sources Consulted, Confidence Summary. Adapt as needed, but keep the confidence separation intact, and keep Sources Consulted as one line per investigator, including the ones that returned nothing or were skipped, with the reason.

After Sources Consulted, if the user's `why` question is a precursor to changing this code, convert the lineage findings into a Preserve / Change / Avoid / Risk constraint set for planning the change.

## Common Failure Modes to Avoid

- **Recency bias**. Assuming the most recent commit is authoritative. The current shape is often the accretion of many earlier decisions. Trace back.
