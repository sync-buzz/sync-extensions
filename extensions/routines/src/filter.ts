"use client";

import { PAGE_LIMIT, useCorpus, type Corpus } from "@sync-buzz/extension-api";
import type { MemoryRecord, MemorySelection } from "@sync-buzz/extension-api";

import { KIND, ROW_FIELDS } from "./model";

/**
 * How a person cuts the list while reading it.
 *
 * One kind, so there is nothing to choose there. What is left is *where* a
 * routine is filed and *what has been put away*, which are the two questions
 * this column is opened with.
 *
 * A shape rather than a bare string, for the reason Records gives: a folder
 * called `all` is one somebody is free to make, and it must not collide with
 * the view of everything.
 */
export type RoutinesFilter =
  | { readonly view: "all" | "archived" }
  | {
      /**
       * One folder, and only the routines filed directly in it.
       *
       * Directly, because that is what opening a folder means everywhere else:
       * Finder shows a directory's contents and not its descendants, and a
       * count that included the subtree would disagree with the rows under it.
       *
       * `""` is the root — the routines in no folder at all — which is a
       * different question from the view of everything, and is asked by
       * dropping a routine on the top row of the tree.
       */
      readonly folder: string;
    };

/**
 * The list, as the store is asked for it.
 *
 * Every read names the three fields a row is drawn from. A listing carries what
 * it was asked for and nothing else, so a list that says whether a routine runs
 * says so here rather than opening every record to find out — which it could
 * not do anyway, the only read of a single record on this surface being a hook.
 */
export function useRoutines(
  projectPath: string,
  filter: RoutinesFilter,
  active = true,
): Corpus {
  return useCorpus(projectPath, selection(filter), undefined, active);
}

/**
 * One read, whatever the selection is, and the views are cuts of its page.
 *
 * The engine would filter by folder, and this deliberately does not ask it to.
 * Neither the archive flag nor *how many are archived* survives into the
 * counts this surface is handed, so a page narrowed to one folder could not
 * say how many routines are put away — and a navigator whose `Archived` row
 * disagreed with the list it opens is worse than one extra read.
 *
 * What that costs is a page: a project with more routines than [`PAGE_LIMIT`]
 * would not see the rest. That is a trade this type can afford and most cannot.
 * A routine spends an agent's tokens every time it runs, which is what keeps
 * their number in the tens rather than the hundreds — the same reason the
 * intervals are a closed set.
 */
function selection(_filter: RoutinesFilter): MemorySelection {
  return { kind: KIND, fields: [...ROW_FIELDS], limit: PAGE_LIMIT };
}

/**
 * The rows one view is asking for, out of the page the store answered with.
 *
 * **A pure function, and that is the point.** The selection lives in the
 * provider's state, so no static render can reach a folder's view — which is
 * how a list that never filtered by folder at all shipped: every view showed
 * every routine, and nothing that could be run without a window disagreed.
 * What decides a row is here, where it can be asked directly.
 *
 * Three rules, in order:
 *
 * - The record that *is* a folder is never a row. It is what the folder says,
 *   not something filed in it, which is the same reason the engine leaves it
 *   out of a listing.
 * - The archive is a place of its own. Everywhere else shows what is in play,
 *   and only `archived` shows what is not — `design-foundation.md` §510, where
 *   archiving means the record leaves the lists.
 * - A folder shows what is filed **directly** in it. That is what opening a
 *   folder means everywhere else: Finder shows a directory's contents and not
 *   its descendants, and a count over the subtree would disagree with the rows
 *   beneath it. `null` and `""` are one answer — the root — because the store
 *   spells "filed nowhere" as the first and this column asks with the second.
 */
export function visible(
  records: readonly MemoryRecord[],
  filter: RoutinesFilter,
): readonly MemoryRecord[] {
  const archived = "view" in filter && filter.view === "archived";
  return records.filter((record) => {
    if (record.isFolder) return false;
    if (record.archived !== archived) return false;
    if (!("folder" in filter)) return true;
    return (record.folder ?? "") === filter.folder;
  });
}

/**
 * How many routines are in play in each folder, counted from the same page the
 * rows are drawn from.
 *
 * Counted here rather than read from the engine's own `records`, and the reason
 * is that the two count different things: the engine counts every document
 * filed in a folder, archived ones included, while this column shows what is in
 * play. A folder holding two live routines and one put away would have said
 * three on its row and drawn two beneath it.
 */
export function liveByFolder(
  records: readonly MemoryRecord[],
): ReadonlyMap<string, number> {
  const counted = new Map<string, number>();
  for (const record of records) {
    if (record.isFolder || record.archived) continue;
    const at = record.folder ?? "";
    counted.set(at, (counted.get(at) ?? 0) + 1);
  }
  return counted;
}
