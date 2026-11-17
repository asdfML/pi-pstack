# Intentional upstream exceptions

The comparison target is pstack v0.15.42 at `bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7`.
The original import baseline remains v0.15.25. This is a documented partial port, not a claim that
all files from a newer release were imported. The [coverage manifest](upstream-01542-coverage.md)
records the file-level dispositions.

Keep original wording and behavior unless one of the exceptions below requires a change.
A preferred phrasing, an extra workflow gate, or a different architecture is not an exception.

## Platform and policy adaptations

| Area | Necessary difference | Contract retained |
|---|---|---|
| Worker API and lifecycle | Pi uses `subagent`, asynchronous completion notifications, supported `steer` and `resume` actions, and explicit report `output` bindings. A transcript fork is not a copy of another worker's checkout or process. | Fresh workers for independent tasks, complete context in briefs, ownership of results and bounded retries. |
| Model selection | User-selected roles live in `pstack/models.md` in the Pi agent directory. There are no fixed provider or model defaults. `inherit-parent` launches with native `model: "inherit"`, not omission. | Editable role assignments, same-family fallback, default panel sizes and explicit custom panel lengths. |
| Reasoning budgets | Role-relative effort is clamped to levels the selected model and Pi support, without changing model identity. Priority service requires actual runtime support and the user's cost policy. | Upstream effort differences between roles and budget offsets. |
| Review independence | Model identity determines family and vendor, not the provider connection name. Missing independence is disclosed. | Arena skips an ineligible cross-vendor judge as upstream permits. Orchestrate still requires an eligible different-family verifier for a merge pass. No same-vendor waiver is invented. |
| Agent context | Package agent profiles inherit project and global context, subject to user overrides. Hidden workflow skills are reached through an explicit path, with package discovery as fallback. | Workers receive their instructions and external Lessons. Setup does not maintain a separate default-reading framework. Read-only profiles narrow the tool list but still allow shell commands; they are not filesystem or network sandboxes. |
| Isolation | Local workers use runnable separate checkouts and scoped dirty-input transfer rather than assuming separate machines. Shared host resources need separate ports/resources or serialization. | Independent attempts, one writer per checkout, protected Git state and honest verification limits. |
| Store and tracker | The shared Store is `.pi/pstack/store/` in the main checkout. Orchestrate keeps a coordinator-owned `notes.md` tracker there. | Durable program context without recreating the removed bookkeeping CLI, inbox database or computed frontier engine. |
| Wakes and waiting | Native owned-task completion comes first. External event availability is conditional. The shared [Pi waits](../../skills/poteto-mode/references/pi-waits.md) procedure owns supported watcher/timer fallbacks. | Checkable exit conditions and caller exclusions remain authoritative. Orchestrate's no-polling rule excludes the integration contract's polling and timer-based watch fallbacks. Missing event delivery is reported, not replaced with a polling service. |
| Transcripts | Pi session JSONL must be attributed to the intended parent and active branch. Child receipts identify child reports. See [Pi transcripts](../../skills/poteto-mode/references/pi-transcripts.md). | The correct task window and evidence, without scanning unrelated private sessions or substituting a child's session. |
| External tools | [Integration bindings](../../skills/poteto-mode/references/integrations.md) select the project's forge, CI and evidence sources. Shared source recipes retain usable lookup instructions without the retired dispatcher. | Mandatory evidence searches, live-state checks and publication safety. Installed tools never override an explicit binding. An unbound GitHub remote retains the documented package forge default. |
| Skill amendments | Changes learned during use of pstack become external Lessons. Other installed skills are copied to an approved project/user location before editing. | User approval, safe mutation boundaries and Reflect's prohibition on push or PR creation. |
| Skill authoring | Pi's skill documentation and the authoring playbook replace an unavailable platform helper. Ordinary agent-facing prose reads only the prose guidance, not the skill-publication workflow. Generated project skills use `.agents/skills/`. | Frontmatter, resolvable references, demonstrated checks and the generated formal skill's coverage/sync record. |
| Structured questions | Automate-me offers four options per question, the overlap between upstream's four-to-six range and Pi's two-to-four limit. | The original minimum breadth, one or two questions, multi-select categories and free-form follow-up. |
| Chart rendering | The Mermaid renderer is user-selected. The full upstream Pele recipe remains available when selected. | Statechart semantics, bug marks, graph limits and readable chart/report handoff. Pinned TLC/Java dependencies are implementation requirements, not a mandatory renderer or service. |
| Video delivery | Embed video only when the client supports it; otherwise link the rendered file. Pi has no native video message-content variant. | The original catch-up window, read-only exception outside the repository, calls-only render failure, subtitles and validation of the rendered file before either delivery form. |

Default panels have three inherited seats, not three guaranteed model identities. The default
inherited Arena judge pool is ineligible, so the cross-vendor judge is skipped and disclosed unless
the user configures an eligible pool. Architect's runner template therefore says each runner uses
its selected model, rather than claiming every selected identity differs.

The shared Pi references hold operational procedures, not a translation glossary or a new workflow
framework. Callers keep their original task-specific obligations.

## Minimal verified upstream corrections

The Statechart import includes 406 supporting files. Of those, 404 remain byte-identical to the
comparison source, including the corpus and pinned dependencies. Two files need strict TypeScript
corrections under the supplied configuration:

- [`scripts/run.ts`](../../skills/statechart/scripts/run.ts) annotates the common result with a type
  derived from the existing `CheckResult`. This prevents literal exit codes widening to `number`.
  No production expression, value or control flow changes.
- [`scripts/test/cli.test.ts`](../../skills/statechart/scripts/test/cli.test.ts) awaits two asynchronous
  test helpers without returning their unused phase object. Waiting, rejection propagation,
  assertions, timeouts and expected results remain unchanged.

These are build-compatibility corrections, not new behavior. Compiler settings and tests are not
weakened to hide the original errors. The [testing notes](../../PORTING.md#tests) also describe the
process-local canonical temporary path required by the upstream symlink fixture on macOS. That
fixture workaround does not modify imported source.

The local documentation checker adapts the monorepo layout to this package's minimal README and
guide-owned inventory. The denylist distinguishes actual periodic-loop commands from ordinary
module paths such as `passes/loop-check.ts`. Their tests cover both valid inputs and real failures.

## Deliberate exclusions

- The bot-specific UI helper needs a particular webhook environment that this port does not require.
- The hosted automation pack is not replaced with a claimed equivalent local service.
- Fixed model defaults, other-platform installation instructions and direct mutation of installed
  pstack skills are not imported.
- The three team-kit skills retain their separately recorded import baseline and license. This port
  does not claim a refresh of that external tool set.

## Verification boundaries

Executable tests, real TLC checks, skill-loader checks and source comparisons are separate evidence.
They do not establish future agent obedience, live generation of a project verification skill,
client video playback, event delivery or multi-day recovery. Missing live coverage must remain
explicit. Independent reviews from one vendor must not be called cross-vendor reviews.

Original upstream comments and unchanged code are not rewritten merely to satisfy a local style
preference. New adapter prose and code still need to earn their place.
