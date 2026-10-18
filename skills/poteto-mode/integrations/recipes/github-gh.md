Drives GitHub pull requests through the GitHub CLI, `gh`.

## create

Open the PR ready, never as a draft, so leave out `--draft`. For a stack child, pass the parent branch as the base.

```sh
gh pr create [--base <parent-branch>]
```

## retarget

```sh
gh pr edit <pr> --base <parent-branch>
```

## ready

```sh
gh pr ready <number>
```

## view

Read the PR state before you refer to it.

```sh
gh pr view <number>
```
