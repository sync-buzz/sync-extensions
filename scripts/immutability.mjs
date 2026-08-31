#!/usr/bin/env node
/**
 * Refuses a tree that would republish a version with different bytes.
 *
 * A released version is immutable: `sync-ext registry` stops the release rather
 * than overwrite one, because a project's `integrity` is checked against what
 * the index says and an index that changed under a version would make that
 * check compare against a lie.
 *
 * That refusal arrives in CI, after the tag is pushed and after the archives
 * have been attached to a release that will never be indexed. This is the same
 * question asked on a desk: pack everything, and compare each archive against
 * the sha256 the committed index already publishes for that id and version.
 *
 * **Nothing about this needs the network.** `registry.json` is in the tree — it
 * is what the window reads — so the check is a file comparison and belongs in
 * `pnpm verify` beside the others.
 *
 * The failure it exists for has one cause and no ill intent: the contract moves,
 * every module is built against it, and a package nobody edited comes out as a
 * different file. Its number has to move, and the only moment anybody thinks
 * about that is the moment something refuses.
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const archives = join(root, "dist");

const index = JSON.parse(await readFile(join(root, "registry.json"), "utf8"));
if (index.formatVersion !== 1) {
  process.stderr.write(
    `the index is written in format ${index.formatVersion}, and this reads 1\n`,
  );
  process.exit(1);
}

let packed;
try {
  packed = await readdir(archives);
} catch {
  process.stderr.write("No archives to check. Run `pnpm pack` first.\n");
  process.exit(1);
}

const clashes = [];
for (const entry of index.extensions ?? []) {
  const name = `${entry.id}-${entry.version}.syncext`;
  // A version this tree no longer builds is a version that was superseded,
  // which is the ordinary case and not something to say anything about.
  if (!packed.includes(name)) continue;

  const bytes = await readFile(join(archives, name));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== entry.artefact.sha256) {
    clashes.push(`${entry.id} ${entry.version}`);
  }
}

if (clashes.length > 0) {
  process.stderr.write(
    `${clashes.join(", ")} ${clashes.length === 1 ? "is" : "are"} already published, and ${
      clashes.length === 1 ? "this build of it is a different file" : "these builds are different files"
    }.\n` +
      "A released version is immutable, so raise the version rather than the bytes under it.\n" +
      "The usual cause is a contract that moved: every module is built against it, " +
      "so a package nobody edited still comes out as a different file.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `immutability: nothing here would republish one of the ${(index.extensions ?? []).length} versions the index names.\n`,
);
