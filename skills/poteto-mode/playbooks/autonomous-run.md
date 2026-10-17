### Autonomous run

**You own the exit condition. Define done, then drive to it without stopping.**

1. State the exit condition as a checkable predicate before the first iteration (tests green, repro fixed, all N PRs merged, pixel-diff zero).
2. Hold the run in a pi-goal-x goal (`create_goal`) whose completion requirements are the predicate, so Pi keeps continuing until it holds. Pick the wake mechanism for waits. An event to watch (CI, a merge, a ref advancing) gets a watcher that wakes you on the event, an async subagent or a `bg_run` command that exits on it, with a long `bg_run` sleep timer as heartbeat fallback. No event gets a `bg_run` sleep timer sized to when the result is worth re-checking, rearmed when it fires. Before arming a timer, check `bg_status`, and keep a timer from this run that is still running instead of arming a second one, because other wakes do not stop it. Without `bg_run`, use a one-shot `subagent` `schedule.create` at the same delay. Pick each subagent's reasoning level for the job, per the Subagents section.
3. Each iteration makes the smallest change the evidence justifies, verifies it against the predicate, commits if it advanced, discards changes that didn't help. Belt-and-suspenders that "might help" gets reverted, not left to ride.
   Sequence the work via the **sequence-verifiable-units** principle skill, verifying each unit before the next instead of batching checks at the end.
4. Mid-run discoveries are yours. Address broken skills, related bugs, flaky verifiers, review noise, tooling failures, orphaned follow-ups, and fixable drift yourself via poteto-mode. Put out-of-band fixes in their own PR. Do not park reversible work for the human or ask the user. Surface only irreversible actions, genuine product or preference calls no experiment can settle, or a real dead end. Keep the predicate as the main drive, and return to it after each side fix.
5. Checkpoint every iteration via the **show-me-your-work** skill, a row for what changed and whether the predicate moved.
6. Stop when the predicate is met. A plateau is not a stop, so keep going and pivot your approach to push past it. Surface a genuine dead end rather than spinning, and never relax the predicate to declare victory.

**Reply:** the exit condition, iterations run, what landed, what was discarded, final predicate state.
