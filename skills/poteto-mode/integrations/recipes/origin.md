Drives pull requests through the Origin CLI, `origin`.

## create

Open the PR ready, never as a draft, so pass `--status open`. For a stack child, pass the parent branch as the base.

```sh
origin pr create --status open [--base <parent-branch>]
```

## retarget

```sh
origin pr edit <pr> --base <parent-branch>
```

## ready

```sh
origin pr ready <number>
```

## view

Read the PR state before you refer to it.

```sh
origin pr view <number>
```
