---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /skill:arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Open a todolist with one entry per phase (Frame, Fan out, Cross-judge, Pick, Graft, Verify) before launching anything.

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric, 3-6 concrete gradeable criteria for what success looks like on *this* task. It is the picker's tool in Phase D. Candidates only see the task.
3. Pick the runners. Use the `arena runners` line in `pstack/models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR`, else `~/.pi/agent`). If the file or that line is missing, run three runners on the parent model. An `inherit-parent` entry in this line means the parent model, so pass `model: "inherit"` for it. If `subagent` rejects a configured entry, use the closest valid `provider/id` of the same model family from its error's list of valid models, or drop the seat and say so when there is none. Identify the family from the model identity or metadata, not the provider connection prefix. A gateway can serve several vendors. Never pass a rejected model again, and skip any fallback already rejected, per the Subagents section of **poteto-mode**. If dropped seats leave fewer than two runners, add runners until there are two, or one when the line has one entry. Run each added runner on a remaining runner's model, or pass `model: "inherit"` so it runs on the parent model when none remain, and say so. When two or more entries resolve to the same model, say in the verdict that model diversity was reduced. Spawn more runners when the arena covers multiple design directions. Use the same model N times when the work is generation-bound rather than judgment-sensitive. Pick each subagent's reasoning level for the job, per the Subagents section of the **poteto-mode** skill.
4. Give each candidate its own output location (a git worktree where possible, otherwise `/tmp/arena-<slug>/candidate-<n>/`), per the **separate-before-serializing-shared-state** principle skill. For code-writing, builds, or verification, read [Pi isolation](../poteto-mode/references/pi-isolation.md) and provide a runnable separate checkout, including the scope's dirty changes when needed.

## Phase B: Fan out

Spawn all N subagents in one message as separate `subagent` calls, with `agent: "general-purpose"` and `async: true`, each with the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected.

If a candidate produces no output, proceed with N-1 and note the dropout.

## Phase C: Cross-judge

After all Phase B candidates complete, choose one model from the `arena cross-judge pool` line in `pstack/models.md` in the Pi agent directory (`$PI_CODING_AGENT_DIR`, else `~/.pi/agent`). Spawn one judge subagent with `agent: "general-purpose-readonly"` and `async: true`. The judge is never from the parent's vendor. Use model identity or metadata, not the provider connection prefix, to identify the vendor. A gateway can serve several vendors. Try only the entries from another vendor, in pool order. An `inherit-parent` entry is the parent model, so it never judges. If `subagent` rejects an entry, use a valid `provider/id` of the same model at the closest reasoning level from the error message, or move to the next entry when there is none. Never retry a rejected model. If the pool is missing or no entry from another vendor runs, skip the judge, pick the base alone in Phase D, and say so. If you do not know the parent's model, try the pool's explicit model entries in pool order and say that the vendor check did not run. Skip entries whose vendor cannot be established when the parent's vendor is known. The judge sees the rubric and the candidates by path label, scores each criterion, and recommends a base with rationale. It runs in parallel with your reading in Phase D. Don't spawn it while candidates are still writing.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric criterion by criterion, not on holistic feel, and compare with the cross-judge when Phase C ran one. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking invariants. When two feel tied, prefer the cleaner boundary or smaller API, per the Laziness Protocol.

## Phase E: Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things per candidate, not most of it. Fold each graft in by hand, per the **redesign-from-first-principles** principle skill, so the result stays coherent under one mental model. Don't paste mechanically.

If the candidates converge on one shape, that is strong agreement. Note it and ship the consensus shape. No graft is needed. If they wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

Verify the synthesized artifact like any other output, per the **prove-it-works** principle skill. If verification finds a problem the arena missed, either Phase A was wrong (re-frame and re-run) or a candidate caught it and you missed the graft (go back to Phase E). Don't paper over it.

## Outputs

One synthesized artifact, with a short synthesis note alongside naming the base and why, the cross-judge's verdict or that Phase C skipped the judge, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.
