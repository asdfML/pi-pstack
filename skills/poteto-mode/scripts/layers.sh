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
super=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
[ -n "$super" ] && super=$(git -C "$super" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
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
# directory so that files gone from the disk count there too. The superproject of a submodule is
# this project too. Another repository, such as a dotfiles repository the folder or a symlink's
# target lives in, never counts.
tracked() {
  [ -n "$common" ] || return 1
  top=${1%/.pi/pstack/*}
  ours "$top" &&
    git -C "$top" ls-files -z -- ':(icase,literal).pi' 2>/dev/null | tr '\0' '\n' | awk -v l=".pi/pstack/${1##*/}" '
      { p = tolower($0) } p == ".pi" || p == ".pi/pstack" || p == l || index(p, l "/") == 1 { f = 1; exit }
      END { exit !f }' && return 0
  p=$1 rest=
  while [ -n "$p" ] && [ ! -d "$p" ]; do rest=${p##*/}${rest:+/$rest}; p=${p%/*}; done
  ours "$p" && [ -n "$(git -C "$p" ls-files -- ":(icase,literal)${rest:-.}" 2>/dev/null | head -n 1)" ]
}

# True when the directory $1 is in a work tree of this project's repository or of its superproject.
# A directory inside .git is in no work tree.
ours() {
  [ "$(git -C "$1" rev-parse --is-inside-work-tree 2>/dev/null)" = true ] || return 1
  c=$(git -C "$1" rev-parse --path-format=absolute --git-common-dir)
  [ "$c" = "$common" ] || { [ -n "$super" ] && [ "$c" = "$super" ]; }
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

# Create the layer $1, a <top>/.pi/pstack/<sub> path, and keep it out of the git of <top>'s checkout
# through .git/info/exclude, once. Its files can sit at two real paths, as through a local symlink at
# .pi or at the layer: the real .pi/pstack folder and the layer's own real folder. Each one in that
# checkout's work tree is excluded; with neither there, <top>'s .pi/pstack/ is. A repository the
# folder itself lives in is left alone.
make_layer() {
  mkdir -p "$1" || return 1
  top=${1%/.pi/pstack/*}
  [ "$(git -C "$top" rev-parse --is-inside-work-tree 2>/dev/null)" = true ] || return 0
  git_dir=$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)
  mkdir -p "$git_dir/info" || return 1
  pstack=$(in_tree "$(dirname "$1")") || pstack="/$(git -C "$top" rev-parse --show-prefix).pi/pstack/"
  exclude "$pstack"
  own=$(in_tree "$1") && case $own in "$pstack"*) ;; *) exclude "$own" ;; esac
  return 0
}

# The exclude line for the directory $1 when it is in a work tree of $git_dir's repository.
in_tree() {
  [ "$(git -C "$1" rev-parse --is-inside-work-tree 2>/dev/null)" = true ] &&
    [ "$(git -C "$1" rev-parse --path-format=absolute --git-common-dir)" = "$git_dir" ] &&
    echo "/$(git -C "$1" rev-parse --show-prefix)"
}

exclude() {
  grep -qxF "$1" "$git_dir/info/exclude" 2>/dev/null || echo "$1" >>"$git_dir/info/exclude"
}
