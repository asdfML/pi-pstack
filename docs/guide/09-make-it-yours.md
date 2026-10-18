# Make it yours

poteto-mode is one person's style. The machinery underneath, playbooks, routing, model roles, works just as well wearing yours. This page covers generating a personal mode, capturing lessons from a session, fixing the repo so agents stop repeating mistakes, binding the tools each project uses, authoring a focused skill, and testing a skill change before you trust it.

Start smaller than you think. You don't need many skills on day one, or even this whole package. Prompt plainly, watch where agents fail, and add a skill or a check when the same failure shows up twice.

## Generate your own mode with `/skill:automate-me`

```text
/skill:automate-me
```

You don't describe your style, because [`/skill:automate-me`](../../skills/automate-me/SKILL.md) reads it out of your history. It mines your recent transcripts in the active workspace for repeated preferences, in how you like replies, delegation, verification, code, prose, and process, then asks you which patterns are really you. It drafts `.agents/skills/<your-name>-mode/SKILL.md` through the Authoring or modifying a skill playbook, runs the draft through [`/skill:unslop`](../../skills/unslop/SKILL.md), and opens a PR from a worktree so you review it like any other change.

Run it again whenever your habits drift:

```text
/skill:automate-me update my mode skill with everything since its last edit
```

Update mode mines only the history since the skill last changed. It keeps rules you haven't contradicted, revises the ones with new evidence, and adds sections only for genuinely new patterns.

## Capture a session's lessons with `/skill:reflect`

Right after a task that taught you something, run:

```text
/skill:reflect that took way too long. capture what we learned so the next run doesn't repeat it.
```

[`/skill:reflect`](../../skills/reflect/SKILL.md) sends the transcript to three parallel reviewers, then a synthesizer sorts the proposals into `Accepted`, `Rejected`, and `Backlog` and waits for your approval before any skill changes. A change to a pstack skill lands as a lesson file outside the package, in the project's `.pi/pstack/lessons/` or your own `pstack/lessons/` in the Pi agent directory, so `pi update` keeps it. Approve a proposal only if it would change a future decision. One weird session is an anecdote, not a rule.

## Fix the environment with `/skill:correct`

When you correct agents for the same mistake again and again, the fix belongs in the repo, not in your next prompt. Rank the options by how well they hold:

1. Make the mistake impossible with architecture or a better data structure.
2. Block it with types, or with a lint or CI check whose error names the fix.
3. Catch it with a test.
4. Write it down as a doc or agent rule. Nothing fails when an agent skips a rule, so this comes last.

Human review isn't on the list. A reviewer who must catch the same mistake on every PR is the problem this fixes. [`/skill:correct`](../../skills/correct/SKILL.md) does the work:

```text
/skill:correct agents keep calling the database client directly instead of going through the repository layer
```

It reads recent commits, reverts, review comments, and comments that explain workarounds, then groups the mistakes into classes. A class counts once it has happened twice. It fixes the most frequent classes one commit each, at the highest level that works, and proves each new check fails on a real past mistake. It also keeps a table in the agent instruction file that pairs each rule with what enforces it, so a rule that nothing enforces shows up as a repeat. The reply lists each class with its evidence, the level chosen, and why a higher level didn't work.

Run it with no argument and it finds the classes from history on its own. `/skill:reflect` and `/skill:correct` split the work. `/skill:reflect` improves skills from one session. `/skill:correct` changes the repo so a mistake class can't come back. Pair it with `/skill:architect` when the fix is a new boundary. [Run many projects in parallel](./07-overnight.md#run-many-projects-in-parallel) has a prompt that does both across a whole repo.

## Bind your project's tools

pstack opens PRs, reads CI, and gathers evidence through the tools you choose for each project. A hobby repo can use `gh` while a work repo uses a Bitbucket MCP server and Jira. pstack never picks a tool because it's installed or connected. An MCP server you connect once shows up in every project, and the repo doesn't say which tracker or chat your team uses.

A GitHub repository needs no setup. When the repository's `origin` remote points at github.com, directly or through an SSH host alias, the forge resolves to the package's `gh` recipe. If the Origin CLI is installed and can read the repository's PRs, the agent uses the Origin recipe instead. CI runs through the same recipe until you bind it separately.

Any other forge, CI, tracker, or chat starts unbound. Bind it once in `/skill:setup-pstack`, which offers the step when you start it inside a project:

```text
/skill:setup-pstack
```

If you skip that, the first run that needs the capability asks you. It gathers candidates from `git remote -v`, the CLIs on your `PATH`, and `mcp({})`, shows you the evidence, and writes the binding only after you confirm. `none` is a valid answer for a capability the project doesn't use. An autonomous run or a subagent never asks and never writes. It skips the capability and names the gap in its report.

Bindings live in `bindings.md` and recipes in `recipes/`, inside an `integrations/` folder in one of three places:

- `.pi/pstack/integrations/` in the project, for one repository.
- `.pi/pstack/integrations/` in a parent folder, for every project under it, such as `~/work/.pi/pstack/integrations/` for all your work repos. Your home directory itself never holds one.
- `~/.pi/agent/pstack/integrations/`, for a choice that holds in every project. With `$PI_CODING_AGENT_DIR` set, it's `pstack/integrations/` in that directory.

For each capability, the nearest folder whose `bindings.md` has a section for it wins. All of these files stay on your machine. pstack adds the project's `.pi/pstack/` to `.git/info/exclude`, so git never sees them and teammates who don't use pstack see no change. pstack ignores a folder that git tracks, with a warning, so a branch can't bring its own bindings or recipes. Git treats excluded files as disposable, though. Checking out a branch that commits `.pi/pstack/` replaces your local files, and switching back deletes them, so keep a copy if you work with such branches.

`bindings.md` has one `## <key>` section per capability. The keys are `forge`, `ci`, `review-bots`, `tracker`, `chat`, `docs`, `observability`, `errors`, and `analytics`. A section's first line is `recipe: <name>` or `none`. The rest is notes for the agent, such as the server name, the CLI, and the project key. Here a corporate project uses Bitbucket through an MCP server, tracks work in Jira, and has no team chat for pstack to read:

```markdown
## forge
recipe: bitbucket
Bitbucket Data Center at bb.corp.example. MCP server `bitbucket`. Project PLAT.

## tracker
recipe: jira
CLI `jira`, project PLAT. The ticket key goes in the PR title.

## chat
none
```

A recipe tells the agent how one tool does the work. For the forge and CI, it has one `## <operation>` section for each operation the playbooks name, such as `create`, `view`, and `merge`. When a recipe has no section for an operation, the agent does it with the same tool, reading its `--help` or MCP tool descriptions. It never switches to another tool. For an evidence key such as `tracker`, a recipe is one investigator playbook for `/skill:why`, shaped like its [source playbooks](../../skills/why/references/sources/). The agent looks for `recipes/<name>.md` in the folders above, nearest first, then in the package. The package ships `github-gh` and `origin` for the forge, and the `/skill:why` source playbooks resolve by name, as in `recipe: linear`. The example above needs your own `recipes/bitbucket.md` and `recipes/jira.md`, and `/skill:setup-pstack` drafts a missing recipe from the tool's `--help` or its MCP tool descriptions.

Here is the start of a GitLab forge recipe, `recipes/gitlab.md`, that drives the `glab` CLI. It's an example, so check each command against `glab --help` before you rely on it:

````markdown
## create

Open the merge request ready, never as a draft, so leave out `--draft`. For a stack child, pass the parent branch as the target.

```sh
glab mr create --fill --yes [--target-branch <parent-branch>]
```

## view

Read the merge request state before you refer to it.

```sh
glab mr view <number>
```
````

When a bound tool is missing, the agent stops that capability. A CLI that isn't installed, an MCP server that isn't in `mcp({})`, failed auth, and a recipe that neither a folder nor the package has all count as a stale binding. The agent names the binding and its file and asks you to rebind. It never falls back to `gh` or to another tool of the same kind, even one that's installed. An autonomous run reports the stale binding and looks for no replacement.

Neither file holds secrets. Write names and commands only. Tokens, URLs with credentials, and cookies stay in the tool's own config, such as the MCP server's settings or the CLI's login.

To see what each capability resolves to, run the resolver from the project. `<pstack>` is the pi-pstack directory that `pi list` prints:

```text
sh <pstack>/skills/poteto-mode/scripts/integrations.sh
```

It prints each key with its status, the file it came from, the recipe path, and the binding's notes. `bound` and `package default` name the recipe in use. `same as forge` under `ci` means the forge recipe runs CI. `none` means the project doesn't use that capability, and `unbound` means nobody chose a tool yet. `recipe missing` and `invalid` point at a binding to fix.

## Author a focused skill

When you already know the workflow you want to capture:

```text
/skill:poteto-mode write a skill for verifying database migrations in this repo
```

Writing a skill matches the [Authoring or modifying a skill playbook](../../skills/poteto-mode/playbooks/authoring-a-skill.md), which follows Pi's skills documentation, validates the frontmatter and links, and ships the result through the Opening a PR playbook. Agent-facing prose has a higher bar than human prose, because an unhelpful sentence becomes an instruction some future agent follows. Let the playbook hold that bar rather than writing a `SKILL.md` freehand.

One special case has its own generator. A skill that must drive your app and prove behavior is a verification skill, so use [`/skill:create-verification-skill`](../../skills/create-verification-skill/SKILL.md) and [`/skill:maintain-verification-skill`](../../skills/maintain-verification-skill/SKILL.md) instead. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers both.

## Write docs to a standard with `/skill:technical-writing`

Skills aren't the only prose you ship. For docs, RFCs, readmes, PR descriptions, and commit messages:

```text
/skill:technical-writing review the readme changes
```

[`/skill:technical-writing`](../../skills/technical-writing/SKILL.md) applies a layered standard with one goal, prose a tired engineer understands on the first read. It picks the document's mode first (tutorial, how-to, reference, or explanation), then works sentence by sentence: who does what, one thought per sentence, nothing readable two ways. Use it to review what you or an agent just wrote, or name it up front when you ask for a doc.

## Test a skill change blind

A skill edit affects every future session, so test it like the experiment it is. The same goes for adopting someone else's skill. Check that it makes the agent better on your work before you keep it.

```text
/skill:poteto-mode run the eval playbook on this skill change. same task for both variants, candidates stay blind.
```

When a skill keeps missing and you know what it should do, change and test it in one task:

```text
/skill:poteto-mode update the review skill so it flags missing migrations, and eval the change.
```

Asking for the eval up front keeps the edit honest. A fix written from one bad session tends to overfit that session, and over many edits the skill drifts. The eval catches the drift before it ships.

The [Eval playbook](../../skills/poteto-mode/playbooks/eval.md) is built around one failure mode, the observer effect. An agent that knows it's being evaluated behaves differently. So candidate agents get an organic-looking task in sanitized directories, never the words "eval" or "candidate", and never each other's existence. One judge scores all outputs under neutral labels, and chain-following gets graded from which files each candidate actually read, not from what it claims.

Read every output yourself before accepting the verdict. If you disagree with the judge, suspect the rubric before you suspect your judgment.

**Pitfall:** don't edit a skill mid-task because it's misbehaving. Write a lesson for a pstack skill, fix a project skill in its own PR, and keep the task moving. A skill edit that ships tangled into feature work is invisible to review and impossible to evaluate.

Next: [Recipes and pitfalls](./10-recipes-and-pitfalls.md).
