---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /skill:swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Pick the worker model from the `swarm workers` line in `pstack/models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR`, else `~/.pi/agent`). If the file or that line is missing, or the value is `inherit-parent`, pass `model: "inherit"` so the workers run on the parent model. If `subagent` rejects a model, use the closest valid model of the same family from its error's list of valid models. Never retry a rejected model. If none remains, pass `model: "inherit"` and say so, including any loss of the requested model-race arm. For a model race, name each arm's model up front. Pick each subagent's reasoning level for the job, per the Subagents section of the **poteto-mode** skill.
4. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn all N workers in one message as separate `subagent` calls, except perf and measurement workers (below), with `agent: "general-purpose"`, `async: true`, and the step 3 model, using `model: "inherit"` for `inherit-parent`. Workers run on this machine, so isolate them by what they do:

- A worker that only reads shares the working directory.
- A worker that checks out a SHA, builds, or writes code needs a runnable separate checkout. Read [Pi isolation](../poteto-mode/references/pi-isolation.md), using `worktree: true` on a clean source or a separate checkout with scoped changes on a dirty source. A standalone artifact only needs its own output directory. A worktree worker's changes come back as a patch in the run's worktree handoff, and the parent applies the one it keeps. Worktrees with no changes are cleaned up.
- A worker that starts the app also gets its own port, named in its brief.
- Perf and measurement workers run one at a time after the other workers finish, so they do not compete for the CPU.

When a worker must start from a ref other than `HEAD`, pass it as `options.baseRef`.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

## Phase D: Report

Return one consolidated in-chat report with a result table, issue one-liners, gaps or dropouts, and the race rule when used.
