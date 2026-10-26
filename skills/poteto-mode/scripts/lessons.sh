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
write_target lessons "$layers"
code=0
[ "$1" = "--create" ] && { create_target || code=1; }

printf 'user layer: %s\n' "$user"
print_target
echo "Lessons follow in rising priority: a later lesson wins over an earlier one for the same file."

show() {
  [ -d "$1" ] || return 0
  (cd "$1" && find -L . -type f -name '*.md' | sed 's#^\./##' | sort) | while IFS= read -r f; do
    printf '\n== lesson for %s from %s\n' "$f" "$1"
    # A lesson line that would pass for one of this script's own lines gets a leading space, so a lesson that
    # quotes the output cannot end or start a run for the compaction extension.
    sed -e 's/^== / &/' -e 's/^user layer: / &/' -e 's/^project write target: / &/' \
      -e 's/^Lessons follow in rising priority/ &/' "$1/$f"
  done
}
show "$user"
printf '%s\n' "$layers" | sed '/^$/d; 1!G;h;$!d' | while IFS= read -r dir; do show "$dir"; done
# A tool that keeps only the tail of long output still keeps this line, so the run stays recognizable.
printf '\n== end of lessons\n'
exit $code
