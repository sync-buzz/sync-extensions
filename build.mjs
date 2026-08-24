#!/usr/bin/env node
/**
 * Builds one extension into the module Sync loads.
 *
 *   node build.mjs <id> [--watch]
 *
 * The whole of the interesting part is what happens to two imports. An author
 * writes `import { useState } from "react"` and
 * `import { Button } from "@sync/extension-api"`, which is the point — an
 * extension should read like the application it extends. Neither can be bundled:
 *
 * - **React must be the window's.** Two copies in one document means the first
 *   hook an extension calls throws, because the copy holding the dispatcher is
 *   not the copy being called.
 * - **The surface must be the window's objects**, not a second implementation
 *   of them. A bundled copy of the component library would be a second set of
 *   portals, focus traps and scroll locks in one window, and "the same styles"
 *   would quietly become "the same as of the last time both were published".
 *
 * So both are replaced with shims that read what the host published on the
 * global before it fetched the module. The names are not invented here: React's
 * come from React itself, and the surface's from the list `api-publish.mjs`
 * derived from the declarations the extension type-checks against — so a shim
 * cannot claim an export the contract does not have.
 *
 * `lucide-react` is bundled rather than shimmed, and that is a deliberate
 * exception to "one copy". An icon is a pure SVG component with no identity to
 * preserve — no hooks, no context — so a second copy of the six an extension
 * uses costs a couple of kilobytes, where serving the library from the host
 * would mean the application bundling fifteen hundred icon modules so that an
 * extension can pick six.
 *
 * JSX is compiled in the classic style — `React.createElement` — rather than
 * the automatic one. Automatic JSX imports from `react/jsx-runtime`, which is a
 * second module the host would have to publish; classic needs only the React
 * the host already has.
 */

import { build, context } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const [id, ...flags] = process.argv.slice(2);
if (id === undefined) {
  process.stderr.write("usage: build.mjs <id> [--watch]\n");
  process.exit(2);
}

const folder = join(root, "extensions", id);
const manifest = JSON.parse(readFileSync(join(folder, "manifest.json"), "utf8"));
if (manifest.ui === undefined) {
  process.stderr.write(
    `${id} declares no ui, so there is nothing to build. Point Sync at the folder.\n`,
  );
  process.exit(0);
}

/** Where the host publishes its objects. Part of the contract, not a detail. */
const RUNTIME = "__syncExtensionHost__";

const contract = JSON.parse(
  readFileSync(join(root, "vendor/sync-extension-api.exports.json"), "utf8"),
);

/**
 * A module whose every export is a member of one object on the global.
 *
 * Read at evaluation rather than at call: the host writes the object before it
 * fetches the module, so by the time this runs it is there — and a value read
 * once cannot be a different value later, because it is written once and never
 * again.
 */
function shim(member, names, withDefault) {
  const lines = [
    `const host = globalThis.${RUNTIME};`,
    `if (host === undefined) {`,
    `  throw new Error("This module was loaded outside Sync, or before the host published its runtime.");`,
    `}`,
    `const bound = host.${member};`,
  ];
  if (withDefault) lines.push("export default bound;");
  for (const name of names) {
    if (name === "default") continue;
    lines.push(`export const ${name} = bound[${JSON.stringify(name)}];`);
  }
  return lines.join("\n");
}

/** Replaces the two imports that must be the window's, and only those two. */
const hostRuntime = {
  name: "sync-host-runtime",
  setup(builder) {
    const injected = /^(react|@sync\/extension-api)$/;

    builder.onResolve({ filter: injected }, (argument) => ({
      path: argument.path,
      namespace: "sync-host",
    }));

    builder.onLoad({ filter: /.*/, namespace: "sync-host" }, (argument) => ({
      contents:
        argument.path === "react"
          ? shim("React", Object.keys(require("react")), true)
          : shim("api", contract.values, false),
      loader: "js",
    }));
  },
};

const options = {
  entryPoints: [join(folder, "src/index.tsx")],
  outfile: join(folder, manifest.ui),
  bundle: true,
  format: "esm",
  target: "safari17",
  platform: "browser",
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  // Every module gets `React` in scope without importing it, which is what the
  // classic transform above needs and what an author should not have to write.
  inject: [join(root, "build/react.js")],
  // A module with no names of its own is what a host imports: it calls the
  // default export and nothing else.
  logLevel: "info",
  minify: !flags.includes("--watch"),
  sourcemap: false,
  plugins: [hostRuntime],
};

if (flags.includes("--watch")) {
  const watcher = await context(options);
  await watcher.watch();
  process.stdout.write(`watching ${id} — reload the extension in Sync to see a change\n`);
} else {
  await build(options);
  process.stdout.write(`built ${id} against contract ${contract.version}\n`);
}
