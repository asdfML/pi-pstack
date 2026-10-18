#!/bin/sh
# Print which tool each pstack capability uses here. Run from the starting directory.
# Usage: integrations.sh [--create] [key...]
# Project layers are every .pi/pstack/integrations/ at or above it (from a linked worktree, also at
# or above its main checkout), below $HOME, then the user layer. Per key, the nearest layer whose
# bindings.md has a `## <key>` section wins, whole. The write target is always the main checkout's
# layer, so a binding for one repository never lands in a folder other repositories share. A
# submodule is the exception: its write target sits under the superproject's .git/modules, which
# every submodule shares.
# --create also creates the write target and keeps its .pi/pstack/ out of git.
. "$(dirname "$0")/layers.sh"
keys="forge ci review-bots tracker chat docs observability errors analytics"
pkg=$(cd "$(dirname "$0")/../integrations" && pwd -P)
why=$(cd "$(dirname "$0")/../../why/references/sources" && pwd -P)
user="$agent/pstack/integrations"

create=
want=
for a; do
  case $a in
    --create) create=1 ;;
    *) case " $keys " in
         *" $a "*) want="$want $a" ;;
         *) printf 'integrations.sh: unknown key "%s"; valid keys: %s\n' "$a" "$keys" >&2; exit 2 ;;
       esac ;;
  esac
done
[ -z "$want" ] && want=$keys

write_target integrations
code=0
[ -n "$create" ] && { create_target || code=1; }

project=$(layer_dirs integrations)
dirs=$(printf '%s\n%s\n' "$project" "$user" | sed '/^$/d') # bindings layers, nearest first

# The `## $2` section of file $1 from its first non-empty line; fails when there is none.
section() {
  [ -f "$1" ] && awk -v k="## $2" '
    /^## / { if (on) exit; h = $0; sub(/[ \t\r]+$/, "", h); if (h == k) { on = found = 1; next } }
    on && (body || NF) { body = 1; print }
    END { exit !found }' "$1"
}

# The path of recipe $1: project layers nearest first, then the user layer, then the package, then
# the why skill's source playbooks, so an evidence key can bind one by name.
recipe() {
  while IFS= read -r d; do
    [ -f "$d/recipes/$1.md" ] && { printf '%s\n' "$d/recipes/$1.md"; return 0; }
  done <<EOF
$dirs
$pkg
EOF
  [ -f "$why/$1.md" ] && { printf '%s\n' "$why/$1.md"; return 0; }
  return 1
}

# Whether origin is on GitHub. The host is read the way the transport reads it: an http(s) URL ends
# its authority at /, ?, or #, as curl does, and an ssh URL at /, as git does. An SSH host can be an
# alias from the ssh config, so ask ssh where it points, as the remote's user, since a Match block
# can choose the host by user; `ssh -G` only evaluates the config and never connects.
github() {
  url=$(git remote get-url origin 2>/dev/null) || return 1
  case $url in
    http://* | https://*) auth=${url#*://}; auth=${auth%%[/?#]*} ;;
    ssh://* | git+ssh://* | ssh+git://*) auth=${url#*://}; auth=${auth%%/*} ;;
    *://*) return 1 ;;
    *:*) auth=${url%%:*}; case $auth in */*) return 1 ;; esac ;;
    *) return 1 ;;
  esac
  host=${auth##*@} login=
  case $auth in *@*) login=${auth%@*}@ ;; esac
  case $url in *://*) host=${host%:*} ;; esac
  [ "$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')" = github.com ] && return 0
  case $url in http://* | https://*) return 1 ;; esac
  case $login$host in -*) return 1 ;; esac
  case $host in "" | -*) return 1 ;; esac
  ssh -G "$login$host" </dev/null 2>/dev/null |
    awk '$1 == "hostname" { h = $2 } END { exit !(h == "github.com" || h == "ssh.github.com") }'
}

resolve() {
  from=
  while IFS= read -r d; do
    body=$(section "$d/bindings.md" "$1") && { from="$d/bindings.md"; break; }
  done <<EOF
$dirs
EOF
  if [ -z "$from" ]; then
    if [ "$1" = forge ] && github; then
      printf '\n== forge: package default\nrecipe: github-gh at %s\n' "$(recipe github-gh)"
      printf 'The remote is on github.com and no layer binds forge. If `command -v origin` succeeds and `origin pr list --limit 1` works in this repository, use the origin recipe at %s instead. Otherwise stay on github-gh and record the fallback.\n' "$(recipe origin)"
    elif [ "$1" = ci ]; then
      printf '\n== ci: same as forge\n'
      echo "No layer binds ci, so the forge recipe's \`checks\`, \`logs\`, and \`rerun\` sections serve CI."
    else
      printf '\n== %s: unbound\n' "$1"
    fi
    return
  fi
  first=$(printf '%s\n' "$body" | head -n 1 | sed 's/[[:space:]]*$//')
  case $first in
    none) status=none detail= ;;
    recipe:*)
      name=$(printf '%s\n' "${first#recipe:}" | sed 's/^[[:space:]]*//')
      case $name in
        "" | .* | *[!A-Za-z0-9._-]*)
          status=invalid detail="recipe name \"$name\" must match [A-Za-z0-9._-]+ and must not start with a dot" ;;
        *)
          if path=$(recipe "$name"); then
            status=bound detail="recipe: $name at $path"
          else
            status="recipe missing" detail="recipe: $name, but no layer or the package has recipes/$name.md"
          fi ;;
      esac ;;
    *) status=invalid detail="the first line must be \"recipe: <name>\" or \"none\", found \"$first\"" ;;
  esac
  printf '\n== %s: %s\nfrom: %s\n' "$1" "$status" "$from"
  [ -n "$detail" ] && printf '%s\n' "$detail"
  rest=$(printf '%s\n' "$body" | sed 1d)
  [ -n "$rest" ] && printf '%s\n' "$rest"
  return 0
}

printf 'user layer: %s\n' "$user"
if [ -n "$project" ]; then
  echo "project layers, nearest first:"
  printf '%s\n' "$project" | sed 's/^/  /'
else
  echo "project layers: none"
fi
print_target
echo "Each key shows the section from the nearest layer that has one. Use only the recipe named here."

for k in $keys; do
  case " $want " in *" $k "*) resolve "$k" ;; esac
done

warnings=$(while IFS= read -r d; do
  [ -f "$d/bindings.md" ] && awk -v keys=" $keys " '
    /^## / { h = substr($0, 4); sub(/[ \t\r]+$/, "", h)
      if (h == "" || h ~ /[ \t]/ || !index(keys, " " h " ")) printf "warning: %s: unknown heading \"%s\" ignored\n", FILENAME, $0 }' "$d/bindings.md"
done <<EOF
$dirs
EOF
)
[ -n "$warnings" ] && printf '\n%s\n' "$warnings"
exit $code
