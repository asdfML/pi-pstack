#!/usr/bin/env node
// Fails when ported files still name Cursor-only tools, paths, or products.
// Usage: node tools/denylist.mjs [path...]   (default: skills agents)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const skills = readdirSync(join(root, "skills"));

const rules = [
  [/\bCursor\b/, "Cursor"],
  [/~\/\.cursor|\.cursor\//, "Cursor path"],
  [/`Task`|\bTask (tool|calls?|subagents?|spawns?)\b|\bTask\(/, "Task tool"],
  [/subagent_type|generalPurpose|run_in_background|readonly: *(true|false)/, "Task parameter"],
  [/\breadonly\b/, "Task parameter", /\.md$/],
  [/environment: *"(cloud|local)"|cloud_base_branch|cloud (agents?|workers?|VMs?)\b/i, "cloud agent"],
  [/AskQuestion/, "AskQuestion"],
  [/pstack-models\.mdc|alwaysApply/, "Cursor rule"],
  [/cursor-team-kit|\bcreate-skill\b/, "Cursor built-in or plugin"],
  [/\/loop\b/, "/loop"],
  [/\b(grok|composer|cursor-grok)-[\w.-]+|claude-opus-5-5-(low|medium|high|xhigh|max)/, "Cursor model slug"],
  [/agent-transcripts/, "Cursor transcripts"],
  [new RegExp(`(?<![\\w:.\\/-])\\/(${skills.join("|")})\\b(?!\\/)`), "slash command without /skill:"],
];

function* files(path) {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) yield* files(join(path, name));
  } else if (/\.(md|mjs|ts|sh)$/.test(path)) yield path;
}

const targets = process.argv.slice(2);
let hits = 0;
for (const target of targets.length ? targets : ["skills", "agents"]) {
  for (const file of files(join(root, target))) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const [re, label, only] of rules) {
        if ((!only || only.test(file)) && re.test(line)) {
          hits++;
          console.log(`${relative(root, file)}:${i + 1}: ${label}: ${line.trim().slice(0, 140)}`);
        }
      }
    });
  }
}
if (hits) {
  console.error(`\n${hits} denylist hit(s)`);
  process.exit(1);
}
