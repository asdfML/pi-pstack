#!/bin/sh
# Print the pstack lesson layers and every lesson in them. Run from the starting directory.
# Project layers are every .pi/pstack/lessons/ at or above it (from a linked worktree, also at or
# above its main checkout), below $HOME; the nearest one is where new lessons go. With none, the
# write target is .pi/pstack/lessons/ in the main checkout, next to the store.
# --create also creates the write target and keeps its .pi/pstack/ out of git through
# .git/info/exclude.
. "$(dirname "$0")/layers.sh"
user="$agent/pstack/lessons"
layers=$(layer_dirs lessons) # nearest first, one per line
[ -n "$layers" ] && layers="$layers
"

target=$(printf '%s' "$layers" | head -n 1)
[ -z "$target" ] && allowed "$root" && target="$root/.pi/pstack/lessons"

if [ "$1" = "--create" ] && [ -n "$target" ]; then
  make_layer "$target" || exit 1
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
