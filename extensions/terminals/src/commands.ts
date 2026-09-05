/**
 * What can be done to a tab or to a shell, said once and drawn three times.
 *
 * The system's menu on a tile, the system's menu on a row of the navigator and
 * the menu in the bar beneath that column all offer the same things, so they
 * are built from one list rather than written out three times. Two copies
 * drift, and the copy that drifts is the one nobody clicks — which is the
 * keyboard's.
 */

import type { NativeMenuEntry } from "@sync-buzz/extension-api";

import type { AreaState, Tab } from "./context";
import { moveLabel, seatOf } from "./tabs";

/** One command. */
export interface Command {
  readonly label: string;
  /** Ends a shell or a tab, and is drawn in the window's destructive tier. */
  readonly ends?: boolean;
  readonly run: () => void;
}

function tabCommands(area: AreaState, tab: Tab): readonly (Command | "separator")[] {
  return [
    // Both directions, and not one of them under a second name. A tab with a
    // single shell in it has no row of its own for that shell, so this is where
    // dividing it downwards has to be reachable — and a command called "New
    // Terminal" that silently meant *to the right* would be the same command
    // twice with the axis hidden in one of them.
    { label: "Split Right", run: () => area.split(tab.focus, "beside") },
    { label: "Split Down", run: () => area.split(tab.focus, "below") },
    "separator",
    { label: "Rename", run: () => area.askRename(tab.id) },
    // Nothing here moves the tab. The list it sits in is carried by dragging a
    // row or by the option key and an arrow, which the row says of itself —
    // a command repeating a gesture the control already offers would teach two
    // ways of doing one thing and keep neither.
    "separator",
    { label: "Close Tab", ends: true, run: () => area.closeTab(tab.id) },
  ];
}

function terminalCommands(
  area: AreaState,
  tab: Tab,
  name: string,
): readonly (Command | "separator")[] {
  const seat = seatOf(tab.layout, name);
  return [
    { label: "Split Right", run: () => area.split(name, "beside") },
    { label: "Split Down", run: () => area.split(name, "below") },
    // Absent rather than disabled in a tab that was never divided: a terminal
    // with no neighbour has nothing to exchange places with, and an item that
    // could never become available is an item that explains nothing.
    ...(seat
      ? ([
          "separator",
          { label: moveLabel(seat), run: () => area.moveTile(name) },
        ] as const)
      : []),
    "separator",
    { label: "Close Terminal", ends: true, run: () => area.closeTile(name) },
  ];
}

/** What can be done to one row: a tab, or one of the shells in it. */
export function commandsFor(
  area: AreaState,
  tab: Tab,
  row: string,
): readonly (Command | "separator")[] {
  return row === tab.id ? tabCommands(area, tab) : terminalCommands(area, tab, row);
}

/**
 * The same list as the system draws a menu from.
 *
 * Called when the menu is asked for rather than when the row is drawn: by then
 * the tab may have been divided again, and a menu built at render would act on
 * the arrangement that was on screen when it was drawn.
 */
export function menuOn(area: AreaState, tab: Tab, row: string): readonly NativeMenuEntry[] {
  return commandsFor(area, tab, row).map((command) =>
    command === "separator" ? "separator" : { label: command.label, onSelect: command.run },
  );
}
