#!/bin/sh
# Print both pstack lesson layers and every lesson in them. Run from the starting directory.
# --create also creates the project layer and keeps it out of git through .git/info/exclude.
# The project layer is the nearest .agents/pstack-lessons/ above the working directory, never in
# $HOME or above it; if none exists, the one to create at the store's root.
agent="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
user="$agent/pstack-lessons"
start=$(pwd -P)
home=$(cd "$HOME" && pwd -P)

project=""
d="$start"
while [ "$d" != "/" ] && [ "$d" != "$home" ]; do
  case "$home" in "$d"/*) break ;; esac
  if [ -d "$d/.agents/pstack-lessons" ]; then project="$d/.agents/pstack-lessons"; break; fi
  d=$(dirname "$d")
done
if [ -z "$project" ] && [ "$start" != "$home" ]; then
  case "$home" in "$start"/*) ;; *)
    common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
    root=$start; [ -n "$common" ] && root=$(dirname "$common")
    project="$root/.agents/pstack-lessons" ;;
  esac
fi

if [ "$1" = "--create" ] && [ -n "$project" ]; then
  mkdir -p "$project"
  common=$(git -C "$project" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
  if [ -n "$common" ]; then
    mkdir -p "$common/info"
    grep -qxF '.agents/pstack-lessons/' "$common/info/exclude" 2>/dev/null ||
      echo '.agents/pstack-lessons/' >>"$common/info/exclude"
  fi
fi

layer() {
  if [ -z "$2" ]; then echo "$1 layer: none"; return; fi
  if [ -d "$2" ]; then echo "$1 layer: $2"; else echo "$1 layer: $2 (not created yet)"; fi
}
layer user "$user"
layer project "$project"
for dir in "$user" "$project"; do
  [ -n "$dir" ] && [ -d "$dir" ] || continue
  [ "$dir" = "$user" ] && name=user || name=project
  (cd "$dir" && find -L . -type f -name '*.md' | sed 's#^\./##' | sort) | while read -r f; do
    printf '\n== %s lesson for %s\n' "$name" "$f"
    cat "$dir/$f"
  done
done
