#!/bin/sh
# Print the pstack lesson layers and every lesson in them. Run from the starting directory.
# Project layers are every .agents/pstack-lessons/ at or above it (from a linked worktree, also at or
# above its main checkout), below $HOME; the nearest one is
# where new lessons go. With none, the write target is the store's root.
# --create also creates the write target and keeps it out of git through .git/info/exclude.
agent="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
case "$agent" in "~") agent=$HOME ;; "~/"*) agent="$HOME/${agent#"~/"}" ;; esac
user="$agent/pstack-lessons"
start=$(pwd -P)
home=$(cd "$HOME" && pwd -P)

# True when $1 can hold a project layer: not /, not $HOME, not an ancestor of $HOME.
allowed() {
  [ "$1" != / ] && [ "$1" != "$home" ] || return 1
  case "$home/" in "$1"/*) return 1 ;; esac
}

# Every directory from $1 up that can hold a project layer, nearest first.
chain() {
  d=$1
  while allowed "$d"; do
    printf '%s\n' "$d"
    d=$(dirname "$d")
  done
}

common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
root=$start
[ -n "$common" ] && root=$(dirname "$common")

# A linked worktree lives outside its main checkout, so it also reads the layers above the main
# checkout, nearer than any ancestor the two share.
main=$(chain "$root")
layers=$({ chain "$start" | grep -vxF -e "$main"; printf '%s\n' "$main"; } | while IFS= read -r d; do
  [ -n "$d" ] && [ -d "$d/.agents/pstack-lessons" ] && printf '%s\n' "$d/.agents/pstack-lessons"
done) # nearest first, one per line
[ -n "$layers" ] && layers="$layers
"

target=$(printf '%s' "$layers" | head -n 1)
[ -z "$target" ] && allowed "$root" && target="$root/.agents/pstack-lessons"

if [ "$1" = "--create" ] && [ -n "$target" ]; then
  mkdir -p "$target" || exit 1
  common=$(git -C "$target" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
  if [ -n "$common" ]; then
    line="/$(git -C "$target" rev-parse --show-prefix)"
    mkdir -p "$common/info" || exit 1
    grep -qxF "$line" "$common/info/exclude" 2>/dev/null ||
      echo "$line" >>"$common/info/exclude" || exit 1
  fi
  [ -z "$layers" ] && layers="$target
"
fi

echo "user layer: $user"
if [ -z "$target" ]; then
  echo "project write target: none"
elif [ -d "$target" ]; then
  echo "project write target: $target"
else
  echo "project write target: $target (not created yet)"
fi
echo "Lessons follow in rising priority: a later lesson wins over an earlier one for the same file."

show() {
  [ -d "$1" ] || return 0
  (cd "$1" && find -L . -type f -name '*.md' | sed 's#^\./##' | sort) | while IFS= read -r f; do
    printf '\n== lesson for %s from %s\n' "$f" "$1"
    cat "$1/$f"
  done
}
show "$user"
printf '%s' "$layers" | sed '1!G;h;$!d' | while IFS= read -r dir; do show "$dir"; done
