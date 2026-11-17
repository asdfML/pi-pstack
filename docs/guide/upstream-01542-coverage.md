# Partial upstream coverage at v0.15.42

The original import is v0.15.25 at `e5136d82418d2db3165ea1050d17577cd618cc05`.
This manifest classifies the changed-existing inventory through
`bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7`. It is not a full-release import claim.
Paths are relative to the imported `pstack/` subtree.

`Port` means the applicable delta is included with Pi, external Lessons, and configurable
integration/model adaptations. `Keep` means the local equivalent already meets the requirement.
`Defer` and `Exclude` name changes deliberately not imported. A mixed row names the boundary.
Static validation does not establish live workflow behavior. The
[intentional exceptions](upstream-exceptions.md) give the rationale for each necessary adaptation.

## Changed-existing inventory

| Path | Disposition and scope |
|---|---|
| `agents/comment-sicko.md` | Port. Trace code directly instead of automatic How. |
| `docs/guide/01-setup.md` | Keep Pi install, budget, live-goal caveat, and user models. Exclude other-harness instructions and fixed defaults. Port formal offer. Clarify vendor independence. |
| `docs/guide/02-poteto-mode.md` | Port. Routes, restatement, Sharpen, and direct tracing. Sharpen retains its preliminary answers and prompt rewrite. |
| `docs/guide/03-understand.md` | Port. Single How explainer and evidence-first Why. Keep bindings and document independent Recall. |
| `docs/guide/04-design.md` | Port. Direct tracing, vendor cross-judge, executable Interrogate, and wording. Keep Pi isolation. |
| `docs/guide/05-build-and-clean.md` | Port. Minor wording. |
| `docs/guide/06-verify-and-ship.md` | Port. Minor wording, Helpers, evidence surviving cleanup. Keep bound forge. Port formal/statechart sections. |
| `docs/guide/07-overnight.md` | Port. Ketchup and Autopilot ownership/verification. Keep Pi wake mechanisms. Port the Orchestrate coordinator/owner description with the Pi tracker and local-runtime limits. |
| `docs/guide/08-principles.md` | Port. Citation wording. |
| `docs/guide/09-make-it-yours.md` | Port. Minor wording and shared source ownership. Keep external Lessons. Port formal generators. |
| `docs/guide/10-recipes-and-pitfalls.md` | Port. Sharpen, Ketchup, executable-review and minor wording. Port formal/video recipes. Keep Pi isolation and inheritance. |
| `docs/guide/README.md` | Port. Advertise formal verification. Add local inventory/coverage links. |
| `skills/architect/SKILL.md` | Port. Direct code tracing. |
| `skills/arena/SKILL.md` | Port. Independent-vendor cross-judge and rejected-model handling. Keep configured roles and Pi isolation. |
| `skills/blast-radius/SKILL.md` | Port. Direct tracing. |
| `skills/how/SKILL.md` | Port. Single read-only explainer. |
| `skills/how/references/explainer-prompt.md` | Port deletion. |
| `skills/how/references/explorer-prompt.md` | Port deletion. |
| `skills/interrogate/SKILL.md` | Port. Runnable adversaries, intent, and coordinator reruns. Keep isolated dirty-change transfer. |
| `skills/interrogate/references/code-quality-review.md` | Port deletion. |
| `skills/interrogate/references/lead-judgment.md` | Port deletion. |
| `skills/interrogate/references/reviewer-prompt.md` | Port deletion. |
| `skills/interrogate/references/rubric.md` | Port deletion. |
| `skills/ketchup/SKILL.md` | Port. Every waiting call is decidable from the report. |
| `skills/make-bot-ui/SKILL.md` | Exclude. Requires upstream bot webhook routines absent in Pi. |
| `skills/no-comments/SKILL.md` | Port. Direct tracing and Pi discovery. Preserve the caller's actual scoped inputs, including uncommitted changes. |
| `skills/poteto-help/SKILL.md` | Port. Keep short upstream routing descriptions, Sharpen, Ketchup, and Autopilot. Keep Pi setup and accurate discovery; include formal/statechart/video routes. |
| `skills/poteto-help/references/recipes.md` | Port. Sharpen, Dropped list, Ketchup, no-merge Autopilot. Port formal recipe. |
| `skills/poteto-mode/SKILL.md` | Port. Goal restatement, premeasurement rule, caller and role pruning, rejected-model fallback. Keep Store, Lessons, Integrations, Pi models. New skills route through setup and help. |
| `skills/poteto-mode/playbooks/autonomous-run.md` | Port. Limit side discoveries to those that support the goal. Keep Pi goals and wakes. |
| `skills/poteto-mode/playbooks/autopilot-full.md` | Port. Owner pushes, base/rebase ownership, and scoped re-verification. Keep bound tools and Pi runtime. |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | Port. Full without merge authority; stack actual dependencies only. |
| `skills/poteto-mode/playbooks/babysit.md` | Port. Rebase ownership. Keep external Lessons and bound tools. |
| `skills/poteto-mode/playbooks/bug-fix.md` | Port. Direct tracing. |
| `skills/poteto-mode/playbooks/feature.md` | Port. Direct tracing. |
| `skills/poteto-mode/playbooks/hillclimb.md` | Port. Direct tracing. |
| `skills/poteto-mode/playbooks/investigation.md` | Port. Direct tracing and evidence-first history. |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | Port. Direct tracing and demonstrated-blocker rules. |
| `skills/poteto-mode/playbooks/opening-a-pr.md` | Port. Rebase ownership and removal of mandatory Interrogate from delegate instruction. |
| `skills/poteto-mode/playbooks/orchestrate.md` | Port. Owner per PR, independent current-head verification, first-unit pilot, native supervision and bounded retries. Adapt Project tracker/store, local isolation, worker continuity and bound forge/CI operations to Pi. |
| `skills/poteto-mode/playbooks/perf-issue.md` | Port. Direct tracing. |
| `skills/poteto-mode/playbooks/refactoring.md` | Port. Direct tracing. |
| `skills/poteto-mode/scripts/check-plan.mjs` | Port. Multi-backtick inline-code handling. |
| `skills/poteto-mode/scripts/check-plan.test.ts` | Port. Matching regression. |
| `skills/poteto-mode/scripts/orch/orch.test.ts` | Port deletion. Supersedes the earlier partial historical-PR regression port. |
| `skills/poteto-mode/scripts/orch/orch.ts` | Port deletion. |
| `skills/poteto-mode/scripts/orch/store.ts` | Port deletion. Supersedes the earlier active-PR selection correction. |
| `skills/poteto-mode/scripts/package.json` | Port. Remove the orch test target. Keep commander, which watch-pr still uses, and the existing bootstrap and lockfile. |
| `skills/poteto-mode/scripts/watch-pr/github.test.ts` | Port. Cross-repository stack regressions. |
| `skills/poteto-mode/scripts/watch-pr/github.ts` | Port. Cross-repository metadata and stack ordering. |
| `skills/poteto-mode/scripts/watch-pr/policy.test.ts` | Port. Matching polling-policy regressions. |
| `skills/poteto-mode/scripts/watch-pr/policy.ts` | Port. Clamp polling and retry sleeps to the remaining timeout. |
| `skills/poteto-mode/scripts/watch-pr/types.ts` | Port. Cross-repository PR shape. |
| `skills/poteto-mode/scripts/worktree-audit.sh` | Port. GNU/BSD stat and date portability. Keep bound forge resolution. |
| `skills/principle-explain-the-number/SKILL.md` | Port. Measurement noise rule. |
| `skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md` | Port. Upstream prose cuts. |
| `skills/principle-type-system-discipline/SKILL.md` | Port. Upstream prose cuts. |
| `skills/recall/SKILL.md` | Port. Own shared-record investigators. Keep Pi transcripts and project bindings. |
| `skills/reflect/SKILL.md` | Port no-push/no-PR and approved safe-copy boundary for other installed skills. Keep external Lessons for pstack. |
| `skills/reflect/references/synthesizer.md` | Port applicable review wording. Keep external Lessons instead of package mutation. |
| `skills/setup-pstack/SKILL.md` | Port retired How/Why roles and source-library pointers. Keep Pi setup, user-selected roles, and Lessons. Exclude fixed defaults; port formal offer. |
| `skills/sharpen/SKILL.md` | Port. Preliminary answers and prompt rewrite, prototypes for empirical choices. |
| `skills/swarm/SKILL.md` | Port applicable correctness/wording changes. Keep Pi workers and configured models. |
| `skills/teach/SKILL.md` | Port. Explicit How/Why composition retained. |
| `skills/typescript-best-practices/SKILL.md` | Port. Require a verifying type guard for brands. |
| `skills/typescript-best-practices/references/patterns.md` | Port. Replace the branded-type cast with a verifying type guard. |
| `skills/why/SKILL.md` | Port. Short evidence-first answer with binding pointer. |
| `skills/why/references/epistemics.md` | Port deletion. |
| `skills/why/references/investigator-prompt.md` | Port deletion. |
| `skills/why/references/source-playbook.md` | Adapt. Move to `skills/poteto-mode/integrations/source-playbook.md` for shared ownership. |
| `skills/why/references/sources/code-archaeology.md` | Adapt. Move to `skills/poteto-mode/integrations/sources/code-archaeology.md`. |
| `skills/why/references/sources/databricks.md` | Adapt. Move to `skills/poteto-mode/integrations/sources/databricks.md`, remove retired orchestration references. |
| `skills/why/references/sources/datadog.md` | Adapt. Move to `skills/poteto-mode/integrations/sources/datadog.md`. |
| `skills/why/references/sources/incident-postmortem.md` | Adapt. Move to `skills/poteto-mode/integrations/sources/incident-postmortem.md`. |
| `skills/why/references/sources/linear.md` | Adapt. Move to `skills/poteto-mode/integrations/sources/linear.md`, remove retired orchestration references. |
| `skills/why/references/sources/notion.md` | Adapt. Move to `skills/poteto-mode/integrations/sources/notion.md`, remove retired orchestration references. |
| `skills/why/references/sources/sentry.md` | Adapt. Move to `skills/poteto-mode/integrations/sources/sentry.md`. |
| `skills/why/references/sources/slack.md` | Adapt. Move to `skills/poteto-mode/integrations/sources/slack.md`, use bound tool. |
| `skills/why/references/synthesizer-prompt.md` | Port deletion. |

## Fidelity cleanup against the same source

The cleanup uses the same pinned `bf0c7cd` source, plus installed Pi 1.5.2 and pi-subagents 0.88.1
runtime documentation and source. It does not import the rest of v0.15.42 or change dependency pins.

- Model setup keeps 13 textual roles, user model identities, and explicit panel lengths. Missing
  panel configuration gives three inherited seats. Budgets adjust role-relative base effort and
  choose supported levels at or below the target and configured ceiling. `inherit-parent` launches
  explicitly with `model: "inherit"`. Swarm restores its same-family fallback.
- Canonical setup writes models in step 7, offers Lessons in step 8, verification in step 10, and
  formal verification in step 11 and integrations in step 12. Routing is a manual opt-in guide recipe. Setup does not maintain
  `defaultReads`. Package agents inherit project and global context subject to user overrides.
- Shared operational references `pi-isolation.md`, `pi-waits.md`, and `pi-transcripts.md` under
  `skills/poteto-mode/references/` replace repeated procedures. Callers retain short inline Pi
  substitutions. Runnable checkout isolation, conditional reproduction setup, per-component
  Visual parity loops, and workspace-bounded transcript reads remain required.
- Reflect retains the upstream no-push/no-PR boundary and edits an approved project or user copy
  of third-party installed skills. pstack amendments remain external Lessons. Urgency guidance is
  conditional on model/runtime support and the user's cost and quota policy, without fixed slugs.
- How, Why, Sharpen, and Ketchup keep the imported behavior. Help routes to their source rather
  than repeating procedures. Orchestrate and CLI removal are now ported in a separate unit. Formal verification, statechart, and video are now imported.

## Files outside that inventory

The source resolver, its regression tests, and the integration reference move source lookup to the
shared library without changing binding precedence or recipe names. The root README stays minimal;
upstream catalog additions do not apply. New formal verification, statechart, and video skills and
their help and setup entries are imported. All 411 upstream new-skill files are included. Of
Statechart's 406 supporting script files, 404 are byte-identical to upstream. Two files contain
minimal type-only fixes for strict TypeScript builds. `skills/statechart/scripts/run.ts` annotates
the shared `common` object to retain its `exit` type. `skills/statechart/scripts/test/cli.test.ts`
wraps two callbacks in async blocks that await `signalWhile` without returning its phase objects.
The imported corpus, pinned dependencies, and production executable logic remain unchanged.
Other differences are Pi invocation names, generated skill placement, user-selected rendering, and
client-compatible video delivery. Pi's native content has text and images, not video; ketchup-video
embeds when the client supports it and links the file otherwise. Both forms require rendered-file validation.
The full upstream Pele recipe remains available when that renderer is selected.

`tools/check-docs.mjs` adapts upstream `scripts/check-pstack-docs.mjs` outside the imported subtree.
Its checks retain upstream structure, using the Pi root layout, command syntax, agent names, and
[guide inventory](inventory.md) instead of requiring a catalog in the root README. Counts come from
the local tree, not the newer upstream release. The external Lessons runtime stays unchanged.
Root extension test dependencies were separately aligned to Pi 1.5.2 without changing extension code
or guards.
