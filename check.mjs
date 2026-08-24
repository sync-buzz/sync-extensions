#!/usr/bin/env node
/**
 * Checks a built extension against its own manifest.
 *
 *   node check.mjs [<id>…]
 *
 * Sync makes every one of these checks itself, and refuses a package that fails
 * one. The reason to make them here as well is *when*: Sync makes them while
 * somebody is opening a project, and reports them as a section that did not
 * appear. Making them at the end of a build turns the same failure into a line
 * in the terminal of the person who caused it.
 *
 * What it does that a type-checker cannot: it runs the module. `activate` is
 * ordinary code, its return value is decided at runtime, and the manifest is
 * JSON — nothing in the type system relates the two, so an area renamed in one
 * and not the other type-checks perfectly and installs as an empty column.
 *
 * The stand-in host is a proxy, so every member of the surface the module reads
 * at load answers with something. That is enough to reach `activate` and see
 * what it returns; it is deliberately not enough to render anything, which is a
 * question for the window rather than for a build.
 */

import React from "react";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Which columns each frame has.
 *
 * A copy of the shell's own table, and the one thing in this repository that is
 * a copy. It is the contract an area is held to, so it is stated where an
 * author can read it — and if it ever disagrees with the shell, the shell is
 * right and this is a bug in the checker rather than a difference of opinion.
 */
const FRAMES = {
  browse: { navigator: true, inspector: true },
  list: { navigator: true, inspector: false },
  detail: { navigator: false, inspector: true },
  single: { navigator: false, inspector: false },
};

const wanted = process.argv.slice(2);
const ids =
  wanted.length > 0
    ? wanted
    : readdirSync(join(root, "extensions"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

const problems = [];

function complain(id, message) {
  problems.push(`${id}: ${message}`);
}

for (const id of ids) {
  const folder = join(root, "extensions", id);
  const manifest = JSON.parse(readFileSync(join(folder, "manifest.json"), "utf8"));

  // Said before the checks rather than after them, so that a package which
  // fails one is still listed as having been looked at. A silent id reads as an
  // id nobody read, which is the one thing a checker must never look like.
  const brings = [
    ...(manifest.areas ?? []).map((area) => area.label),
    ...((manifest.types ?? []).length > 0
      ? [`${manifest.types.length} types`]
      : []),
  ];
  process.stdout.write(
    `${id} ${manifest.version} — ${brings.join(", ") || "a prompt and nothing else"}\n`,
  );

  if (manifest.id !== id) {
    complain(id, `its manifest calls it "${manifest.id}", and it lives in a folder called "${id}".`);
  }

  // Every kind it publishes is its own. Sync refuses the rest; this says so
  // before the package is anywhere near a project's memory.
  for (const path of manifest.types ?? []) {
    const definition = JSON.parse(readFileSync(join(folder, path), "utf8"));
    if (!definition.kind.startsWith(`${manifest.id}.`)) {
      complain(
        id,
        `"${definition.kind}" in ${path} is not its to publish: a kind it publishes begins with "${manifest.id}.".`,
      );
    }
  }

  const areas = manifest.areas ?? [];
  if (manifest.ui === undefined) {
    if (areas.length > 0) {
      complain(id, "it declares sections and no ui, and a section is drawn by code.");
    }
    continue;
  }

  const built = join(folder, manifest.ui);
  if (!existsSync(built)) {
    complain(id, `${manifest.ui} is not there. Build it first.`);
    continue;
  }

  const surface = new Proxy(
    {},
    { get: () => function stub() { return null; } },
  );
  globalThis.__syncExtensionHost__ = { React, api: surface };

  let produced;
  try {
    const module = await import(`${built}?checked=${Date.now()}`);
    if (typeof module.default !== "function") {
      complain(id, "its module exports no default function, which is what the host calls to start it.");
      continue;
    }
    produced = module.default({ id: manifest.id });
  } catch (threw) {
    complain(id, `it threw while starting: ${threw.message}`);
    continue;
  }

  // One area may be returned bare, exactly as the host reads it.
  const byArea =
    areas.length === 1 && "Workspace" in produced
      ? { [areas[0].id]: produced }
      : produced;

  for (const area of areas) {
    const module = byArea[area.id];
    if (module === undefined) {
      complain(id, `it declares the area "${area.id}" and returned nothing for it.`);
      continue;
    }
    const shape = FRAMES[area.frame];
    if (shape === undefined) {
      complain(id, `the area "${area.id}" asks for a "${area.frame}" frame, and there are ${Object.keys(FRAMES).join(", ")}.`);
      continue;
    }
    if (typeof module.Workspace !== "function") {
      complain(id, `the area "${area.id}" returned no Workspace, and every frame has one.`);
    }
    for (const column of ["Navigator", "Inspector"]) {
      const has = typeof module[column] === "function";
      const wants = shape[column.toLowerCase()];
      if (wants && !has) {
        complain(id, `the area "${area.id}" declares the "${area.frame}" frame, which has a ${column.toLowerCase()}, and returned none.`);
      }
      if (!wants && has) {
        complain(id, `the area "${area.id}" returned a ${column}, and the "${area.frame}" frame has no such column.`);
      }
    }
  }
}

if (problems.length > 0) {
  process.stderr.write(`\n${problems.join("\n")}\n`);
  process.exit(1);
}
