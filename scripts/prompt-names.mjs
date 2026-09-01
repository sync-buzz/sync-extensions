// Every name a prompt spells in backticks is a name an agent will call.
//
// A prompt is the one file in a package that nothing else validates: the
// manifest is schema-checked, the module is type-checked and run by
// `sync-ext check`, and the prose beside them is read by an agent that does
// what it says. A prompt naming a call that does not exist costs that agent a
// turn per name, and its next guess is usually a worse version of the same
// mistake.
//
// What this holds is the checkable half — a name that looks like a call has to
// be one of three things:
//
//   * a tool of Sync's own agent surface (the list below),
//   * `<id>.<tool>` for a tool this package declares,
//   * `<id>.<type>` for a kind this package publishes.
//
// Dotted names that are members rather than calls — `fields.status`,
// `freshness.state` — are allowed by their first segment, which is why that
// list is here rather than a guess about what a verb looks like.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Sync's published agent surface. Its source is `published.rs` and `own.rs` in
// the Sync repository, and it is written out in `docs/extensions.md` under
// "What a prompt may tell an agent to call" — which is the copy to check this
// against when the surface moves.
const SURFACE = new Set([
  "memory_get_record",
  "memory_list_records",
  "memory_list_folders",
  "memory_list_types",
  "memory_read_content",
  "memory_search",
  "memory_backlinks",
  "memory_diff",
  "memory_schema_status",
  "sync_projects",
  "sync_project",
  "sync_instructions",
  "sync_apply",
  "sync_call",
  "sync_speak",
]);

// Last segments that make a name a file rather than a call. A prompt naming a
// module of the repository — `use-corpus.ts` — is the same shape as a call and
// is not one.
const FILES = new Set([
  "ts", "tsx", "js", "jsx", "json", "md", "css", "rs", "toml", "yml", "yaml", "sh", "lock",
]);

// First segments that introduce a member of a record rather than a call.
const MEMBERS = new Set([
  "fields",
  "freshness",
  "archive",
  "source_paths",
  "content_ref",
  "envelope",
  "extension",
  "sync",
]);

// The check proves itself before it runs. A regular expression that stopped
// matching — a `-` moved inside a class, a flag dropped — would report a clean
// tree for ever, which is the failure this file exists to prevent.
function selfTest() {
  const bad = ["`documents.create` files it", "`folders.list` with a kind", "`memory_write_all`"];
  const good = ["`sync_apply` writes it", "`fields.status`", "`use-corpus.ts`", "`tasks.task`"];
  const call = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9_-]*)+$/;
  const tool = /^(memory|sync)_[a-z_]+$/;
  const reads = (line) => {
    const named = line.match(/`([^`\n]+)`/)[1];
    if (tool.test(named)) return !SURFACE.has(named);
    if (!call.test(named)) return false;
    const segments = named.split(".");
    if (FILES.has(segments[segments.length - 1])) return false;
    return !MEMBERS.has(segments[0]) && segments[0] !== "tasks";
  };
  for (const line of bad) {
    if (!reads(line)) throw new Error(`prompt-names: stopped catching ${line}`);
  }
  for (const line of good) {
    if (reads(line)) throw new Error(`prompt-names: now fails on ${line}`);
  }
}
selfTest();

const root = "extensions";
const ids = readdirSync(root);
const failures = [];

for (const id of ids) {
  const promptFile = join(root, id, "prompt", "instructions.md");
  if (!existsSync(promptFile)) continue;
  const manifest = JSON.parse(readFileSync(join(root, id, "manifest.json"), "utf8"));
  const own = new Set([
    ...(manifest.tools ?? []).map((tool) => `${manifest.id}.${tool.name}`),
    ...(manifest.types ?? []).map((path) =>
      JSON.parse(readFileSync(join(root, id, path), "utf8")).kind,
    ),
  ]);

  const prose = readFileSync(promptFile, "utf8");
  for (const [, spelled] of prose.matchAll(/`([^`\n]+)`/g)) {
    const named = spelled.trim();
    if (/^(memory|sync)_[a-z_]+$/.test(named)) {
      if (!SURFACE.has(named)) failures.push(`${id}: \`${named}\` is not a tool Sync publishes`);
      continue;
    }
    if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9_-]*)+$/.test(named)) continue;
    const segments = named.split(".");
    const first = segments[0];
    if (FILES.has(segments[segments.length - 1])) continue;
    if (MEMBERS.has(first) || own.has(named)) continue;
    if (first === manifest.id) {
      failures.push(`${id}: \`${named}\` is neither a tool nor a kind this package declares`);
      continue;
    }
    if (ids.includes(first)) continue;
    failures.push(`${id}: \`${named}\` reads as a call and answers to nothing`);
  }
}

if (failures.length > 0) {
  console.error("prompt-names: a prompt names something that does not exist.\n");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    "\nEach one costs an agent a turn. Name what exists, or write it as prose rather than in backticks.",
  );
  process.exit(1);
}
console.log(`prompt-names: every name in ${ids.length} packages' prompts answers to something.`);
