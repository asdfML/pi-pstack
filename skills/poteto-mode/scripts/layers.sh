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
      echo "warning: $d/.pi/pstack/$1 skipped because git tracks it" >&2
      continue
    fi
    printf '%s\n' "$d/.pi/pstack/$1"
  done
}

# True when this project's git index supplies the layer $1, a <d>/.pi/pstack/<sub> path, so a branch
# could ship it. The index of <d>'s checkout tracks .pi or .pi/pstack (a symlink or a submodule
# there) or anything in the layer, in any letter case, even files gone from the disk. Or the project
# tracks files at the layer's real path, as through a local symlink, read from its nearest existing
# directory so that files gone from the disk count there too. Another repository, such as a dotfiles
# repository the folder or a symlink's target lives in, never counts.
tracked() {
  [ -n "$common" ] || return 1
  d=${1%/.pi/pstack/*}
  [ "$(git -C "$d" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" = "$common" ] &&
    git -C "$d" ls-files -z -- ':(icase).pi' 2>/dev/null | tr '\0' '\n' | awk -v l=".pi/pstack/${1##*/}" '
      { p = tolower($0) } p == ".pi" || p == ".pi/pstack" || p == l || index(p, l "/") == 1 { f = 1; exit }
      END { exit !f }' && return 0
  p=$1 rest=
  while [ -n "$p" ] && [ ! -d "$p" ]; do rest=${p##*/}${rest:+/$rest}; p=${p%/*}; done
  [ "$(git -C "$p" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" = "$common" ] &&
    [ -n "$(git -C "$p" ls-files -- ":(icase)${rest:-.}" 2>/dev/null | head -n 1)" ]
}

# Set target to the project write target for layer $1: the nearest layer in $2, the output of
# layer_dirs, else the main checkout's .pi/pstack/$1. When the project's index supplies that one,
# target is empty and blocked names it. Outside any project both are empty.
write_target() {
  target=$(printf '%s\n' "$2" | sed -n 1p) blocked=
  [ -z "$target" ] && allowed "$root" && target="$root/.pi/pstack/$1"
  [ -n "$target" ] && tracked "$target" && { blocked=$target; target=; }
  return 0
}

print_target() {
  if [ -n "$blocked" ]; then
    echo "project write target: none, because git tracks $blocked"
  elif [ -z "$target" ]; then
    echo "project write target: none"
  elif [ -d "$target" ]; then
    echo "project write target: $target"
  else
    echo "project write target: $target (not created yet)"
  fi
}

# For --create: create the write target, or fail when git tracks it.
create_target() {
  if [ -n "$blocked" ]; then
    echo "warning: nothing created, because git tracks $blocked" >&2
    return 1
  fi
  [ -z "$target" ] || make_layer "$target"
}

# Create the layer $1, a <d>/.pi/pstack/<sub> path, and keep <d>/.pi/pstack/ out of the git of <d>'s
# checkout through .git/info/exclude, once. A repository the folder itself lives in is left alone.
make_layer() {
  mkdir -p "$1" || return 1
  d=${1%/.pi/pstack/*}
  git_dir=$(git -C "$d" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
  [ -n "$git_dir" ] || return 0
  line="/$(git -C "$d" rev-parse --show-prefix).pi/pstack/"
  mkdir -p "$git_dir/info" || return 1
  grep -qxF "$line" "$git_dir/info/exclude" 2>/dev/null ||
    echo "$line" >>"$git_dir/info/exclude"
}
