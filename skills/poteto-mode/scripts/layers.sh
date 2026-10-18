# The directory walk shared by lessons.sh and integrations.sh. Source it from the starting directory.
agent="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
case "$agent" in "~") agent=$HOME ;; "~/"*) agent="$HOME/${agent#"~/"}" ;; esac
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

# Every existing <d>/.pi/pstack/$1, nearest first, one per line. A linked worktree lives outside its
# main checkout, so it also reads the layers above the main checkout, nearer than any ancestor the
# two share. A layer git tracks is skipped: a branch, such as a PR head under review, could ship it.
layer_dirs() {
  main=$(chain "$root")
  { chain "$start" | grep -vxF -e "$main"; printf '%s\n' "$main"; } | while IFS= read -r d; do
    [ -n "$d" ] && [ -d "$d/.pi/pstack/$1" ] || continue
    if tracked "$d/.pi/pstack/$1"; then
      echo "warning: $d/.pi/pstack/$1 skipped because git tracks files in it" >&2
      continue
    fi
    printf '%s\n' "$d/.pi/pstack/$1"
  done
}

# True when git tracks a file in directory $1. Git runs from inside it, so a tracked symlink on the
# way, a case variant of the path, or a submodule there is caught too.
tracked() {
  [ -n "$(git -C "$1" ls-files 2>/dev/null | head -n 1)" ]
}

# Create the layer $1 and keep its .pi/pstack/ out of git through .git/info/exclude, once.
make_layer() {
  mkdir -p "$1" || return 1
  git_dir=$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
  [ -n "$git_dir" ] || return 0
  line="/$(git -C "$(dirname "$1")" rev-parse --show-prefix)"
  mkdir -p "$git_dir/info" || return 1
  grep -qxF "$line" "$git_dir/info/exclude" 2>/dev/null ||
    echo "$line" >>"$git_dir/info/exclude"
}
