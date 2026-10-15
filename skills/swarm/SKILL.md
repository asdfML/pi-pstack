---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /skill:swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

Fan out N parallel local workers. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report.

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is total workers, not the concurrency limit.
4. Pick the worker model from the `swarm workers` line in `pstack-models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR`, else `~/.pi/agent`). If the file or that line is missing, or the value is `inherit-parent`, omit `model` so the workers run on the parent model. If `subagent` rejects a model, run the workers on the parent model and say so. For a model race, name each arm's model up front. Pick each subagent's reasoning level for the job, per the Subagents section of the **poteto-mode** skill.
5. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn all N workers in one message as `subagent` calls, except perf and measurement workers (below), with `agent: "general-purpose"`, `async: true`, and the step 4 model, left unset for `inherit-parent`. Workers run on this machine, so isolate them by what they do:

- A worker that only reads shares the working directory.
- A worker that checks out a SHA, builds, or writes gets `worktree: true`. It needs a clean working tree. Commit your own in-progress work first. Never commit or stash changes you did not make. Give those workers separate output directories instead. A worktree worker's changes come back as a patch in the run's worktree handoff, and the parent applies the one it keeps. Worktrees with no changes are cleaned up.
- A worker that starts the app also gets its own port, named in its brief.
- Perf and measurement workers run one at a time after the other workers finish, so they do not compete for the CPU.

When a worker must start from a ref other than `HEAD`, pass it as `options.baseRef`.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
