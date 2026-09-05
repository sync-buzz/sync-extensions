/**
 * The door this package was handed when it started.
 *
 * A module-level value rather than something passed down the tree, because
 * `activate` is the only place it exists and the components the host renders
 * are not given it. One value per loaded module, and a module is loaded once
 * per window — which is once per project, so there is nothing here that could
 * belong to a project other than this one.
 */

import type { ExtensionTerminal } from "@sync-buzz/extension-api";

let handed: ExtensionTerminal | null = null;

export function remember(terminal: ExtensionTerminal): void {
  handed = terminal;
}

/**
 * What was handed over, or a refusal that says which of the two things went
 * wrong — because the alternative is `undefined.open is not a function` from
 * inside a click handler, three screens away from the cause.
 */
export function door(): ExtensionTerminal {
  if (!handed) {
    throw new Error("Terminals was asked for a shell before it was activated.");
  }
  return handed;
}
