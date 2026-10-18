# Integrations

An integration is the tool a project uses for one capability, such as its forge or its tracker. The user chooses each one. Bindings live on this machine, outside git. `<poteto-mode dir>` below is the parent of this file's directory.

## Keys

- `forge` hosts branches and pull requests.
- `ci` runs checks on a branch or a pull request.
- `review-bots` are the automated reviewers that comment on a pull request.
- `tracker` holds tickets and issues.
- `chat` is the team's messaging.
- `docs` holds the team's written documentation.
- `observability` holds metrics, logs, and traces.
- `errors` collects runtime errors and crashes.
- `analytics` holds product usage data.

## Resolve

Before the first operation of a capability, run `sh <poteto-mode dir>/scripts/integrations.sh <key>` by absolute path from the starting directory. A subagent runs it itself. Keep the result for the rest of the run.

Each key prints its status, the bindings file it came from, the recipe path, and the binding's notes. The notes name the server, the CLI, or the project key to use.

## Act on the status

- `bound` or `package default`. Open the recipe at the printed path and run each operation from its `## <operation>` section, with the binding's notes. A recipe without that section does not support the operation. Say so and leave the operation undone. Improvising it or reaching for another tool is out. For `package default`, also follow the printed line about Origin.
- `none`. The project does not use this capability. Skip the steps that need it and say so in the reply.
- `unbound`. In an interactive top-level session, gather candidates with `git remote -v`, `command -v` for the likely CLIs, and `mcp({})`. Propose them to the user with that evidence and ask which one to bind. Write the binding only after the user confirms. In an autonomous run or in a subagent, skip the capability, name the gap in the reply, and record nothing. A guess never becomes a binding.
- `recipe missing`, `invalid`, or a bound tool that is not there (the CLI is absent, the MCP server is not in `mcp({})`, or auth fails). The binding is stale. Stop that capability, name the binding and its file, and propose a rebind. Never fall back to `gh` or to another tool of the same kind, even one that is installed, connected, or found through an MCP search. A replacement is a new binding, so the `unbound` rules decide who may choose it. In an autonomous run or in a subagent, report the stale binding and do not look for a replacement.

## Write a binding

Only a top-level session writes, and only after the user confirms the tool. Ask the user where the binding belongs:

- This project. Run `sh <poteto-mode dir>/scripts/integrations.sh --create` from the main checkout and write to the target it prints.
- A parent folder that several projects share. Run the same command from that folder.
- The user layer, for a choice that holds in every project. The script prints its path. Create it if it does not exist.

`bindings.md` holds one `## <key>` section per capability. The section's first non-empty line is `recipe: <name>` or `none`. The rest is free text for the agent, such as server names, the CLI, and project keys.

```markdown
## forge
recipe: bitbucket
Bitbucket Data Center at bb.corp.example. MCP server `bitbucket`. Project PLAT.

## chat
none
```

A tool the package has no recipe for gets `recipes/<name>.md` in the same layer, with one `## <operation>` section for each operation the playbooks name. The package ships `github-gh` and `origin` for the forge. A recipe can drive a CLI, an MCP tool call, an HTTP API, or the project's own script. Both files hold names and commands only. Auth stays in the tool's own config. Rerun the script after writing and check that the key resolves to `bound`.
