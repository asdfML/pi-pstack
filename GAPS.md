# Known gaps and open questions

Things the port does differently from upstream, or does not do yet. Each entry says what to
revisit.

## Limitations versus Cursor

- **No cloud workers.** Upstream `swarm` and `orchestrate` give each worker its own cloud VM:
  its own checkout, ports, and CPU. Pi runs workers locally. Rule for now:
  read-only lanes share the project directory; lanes that check out a SHA, build, or write get
  their own git worktree (`worktree: true`); lanes that run the app also get their own port from
  the brief; perf lanes run sequentially, never alongside other lanes.
- **Scale.** `orchestrate` assumes dozens to hundreds of subagents. Local parallelism is bounded
  by the machine and pi-subagents concurrency limits.

## External integrations (make configurable later)

The first port keeps these as upstream wrote them. Next iteration: let `/skill:setup-pstack`
record which tools the user has, and make skills and playbooks use that.

- GitHub via `gh` (babysit, shipping, opening a PR, watch-pr).
- Bugbot and the agentic security reviewer (`references/bugbot-triage.md`). Generalize to any
  review bot.
- Origin CLI as a landing path in Shipping.
- `why` sources: Linear, Slack, Notion, Datadog, Sentry, Databricks.

## Open questions

- **Skill names.** `how`, `why`, `recall`, `correct`, `tdd` are generic and may collide with other
  packages. Decide on a `pstack-` prefix before a public release.
- **Package dependencies.** pi-subagents is required. Todo and question tools are optional.
  Document or enforce before a public release.
