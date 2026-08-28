"use client";

import { PAGE_LIMIT, useCorpus, type Corpus } from "@sync-buzz/extension-api";
import type { MemorySelection } from "@sync-buzz/extension-api";

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
