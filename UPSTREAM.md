# Upstream

Source: https://github.com/cursor/plugins/tree/main/pstack
Imported: pstack v0.15.25, cursor/plugins@e5136d82418d2db3165ea1050d17577cd618cc05

Also imported from the same commit: `cursor-team-kit/skills/{deslop,control-ui,control-cli}` into `skills/`, and `cursor-team-kit/LICENSE` as `LICENSE-cursor-team-kit`.

The `upstream` branch holds the original import verbatim. `main` carries the Pi adaptations.

## Partial ports after the baseline

Existing-workflow and minor fixes are partially ported through
cursor/plugins@bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7, the pinned v0.15.42 tree. This is not a
full v0.15.42 import or a package version bump. The original v0.15.25 baseline above remains.
The [per-file coverage manifest](docs/guide/upstream-01542-coverage.md) records the changed-existing
inventory, adaptations, exclusions, and deferred work. The
[intentional exceptions](docs/guide/upstream-exceptions.md) explain why the remaining departures are
necessary and which upstream contracts they preserve.

The partial port covers the short How and Why workflows, independent Recall investigators,
shared integration source recipes, executable Interrogate, Arena cross-judge independence,
Sharpen's preliminary answers and prompt rewrite, dependency-only Autopilot-stack without merge authority, demonstrated-blocker
rules, Ketchup completeness, minor script and prose changes, and matching help and guide updates.
The earlier partial port included the `orch` active-PR selection correction from
cursor/plugins@3c596e701b5ca3d213e072464eec36baf0dee3e7. It is superseded by the pinned upstream
Orchestrate rewrite and CLI deletion. Orchestrate now uses one owner per PR, current-head independent
verification, a lightweight `notes.md` tracker under the existing Store, and available event
subscriptions. Pi checkout isolation, supported worker continuity, and configurable forge/CI
operations replace the platform-specific calls. No replacement bookkeeping CLI is introduced.
The upstream `scripts/check-pstack-docs.mjs`, outside the imported `pstack/` subtree, is adapted as
`tools/check-docs.mjs` for the Pi root layout and guide-owned inventory.

A fidelity cleanup against the same pinned tree restores three default panel seats,
role-relative reasoning budgets, Swarm's same-family fallback, and Reflect's no-push/no-PR and
safe-copy boundary. It retains textual role assignments, user-selected identities and list lengths,
external Lessons, and configurable tools. Setup no longer installs workflow routing or maintains
`defaultReads`; routing remains a manual opt-in guide recipe. Three shared Pi references cover
isolation, waits, and transcripts without a runtime translation glossary. Runtime adaptations were
checked against installed Pi 1.5.2 and pi-subagents 0.88.1 documentation and source, not imported as
new package dependency pins. This cleanup does not change the baseline or claim a full release.

The remaining feature import adds formal verification generation and maintenance, statechart with
its upstream implementation and corpus, and ketchup-video. Of Statechart's 406 supporting script
files, 404 are byte-identical to upstream. Two files contain minimal type-only fixes for strict
TypeScript builds. `skills/statechart/scripts/run.ts` annotates the shared `common` object to retain
its `exit` type. `skills/statechart/scripts/test/cli.test.ts` wraps two callbacks in async blocks that
await `signalWhile` without returning its phase objects. The imported corpus, pinned dependencies,
and production executable logic remain unchanged. Help, setup and guide routes are included.
Pi command names, generated skill placement, user-selected rendering and video file links when a
client cannot embed video are the necessary adaptations. Both video delivery forms
require validation of the rendered file; Pi's native message content supports text and images, not
video playback. The upstream Pele recipe is retained as an optional renderer recipe.

Excluded items are make-bot-ui, fixed model defaults, other-harness installation instructions, and
direct mutation of installed skills. External Lessons already handle the last item. The Lessons
runtime and the three cursor-team-kit skills are not refreshed by this partial port. Separately,
root test dependencies were aligned to installed Pi 1.5.2 without changing extension code or guards.

For a later full sync, replace the `upstream` tree with the selected pstack and three cursor-team-kit
skills, commit, then merge it on `main`. Reconcile the partial-port manifest before claiming that
baseline. Run `node tools/check-docs.mjs` and `node tools/denylist.mjs skills agents docs/guide`.
The default denylist also scans local research artifacts, so classify pre-existing hits separately
rather than rewriting unrelated reports.
