# Upstream

Source: https://github.com/cursor/plugins/tree/main/pstack
Imported: pstack v0.15.25, cursor/plugins@e5136d82418d2db3165ea1050d17577cd618cc05

Also imported from the same commit: `cursor-team-kit/skills/{deslop,control-ui,control-cli}` into `skills/`, and `cursor-team-kit/LICENSE` as `LICENSE-cursor-team-kit`.

The `upstream` branch holds these files verbatim. `main` merges it and
carries the Pi adaptations. To sync: replace the `upstream` tree with a newer
pstack and the three cursor-team-kit skills, commit, then `git merge upstream` on `main` and run
`node tools/denylist.mjs` until it passes.
