"use client";

import { PAGE_LIMIT, useCorpus, type Corpus } from "@sync-buzz/extension-api";
import type { MemorySelection } from "@sync-buzz/extension-api";

import { KIND, ROW_FIELDS } from "./model";

/**
 * How a person cuts the register while reading it.
 *
 * One kind, so there is nothing to choose there — what is left is *where* the
 * work is filed and *what is waiting on somebody*, which are the two questions
 * a register is actually opened with.
 *
 * A shape rather than a bare string, for the reason Records gives: a folder
 * called `all` is one somebody is free to make, and it must not collide with
 * the view of everything.
 */
export type TasksFilter =
  | { readonly view: "all" | "waiting" }
  | {
      /**
       * One folder, and only the tasks filed directly in it.
       *
       * Directly, because that is what opening a folder means everywhere else:
       * Finder shows a directory's contents and not its descendants, and a
       * count that included the subtree would disagree with the rows under it.
       *
       * `""` is the root — the tasks in no folder at all — which is a different
       * question from the view of everything and is asked by dropping a task on
       * the top row of the tree.
       */
      readonly folder: string;
    };

/**
 * The register, as the store is asked for it.
 *
 * Every read names the three fields a row is drawn from. A listing carries what
 * it was asked for and nothing else, so a list that groups by status says so
 * here rather than opening two hundred records to find out.
 */
export function useTasks(
  projectPath: string,
  filter: TasksFilter,
  active = true,
): Corpus {
  return useCorpus(projectPath, selection(filter), undefined, active);
}

/**
 * A filter, as a selection.
 *
 * `waiting` is not one: the engine filters by kind, folder and freshness, and
 * *how far the work has got* is a field of this type rather than anything the
 * store sorts on. So the selection is the same as `all` and the view is a
 * filter over the page — which is exactly what the status groups already are,
 * and why the two cannot disagree.
 */
function selection(filter: TasksFilter): MemorySelection {
  const base = { kind: KIND, fields: [...ROW_FIELDS], limit: PAGE_LIMIT };
  return "folder" in filter ? { ...base, folder: filter.folder } : base;
}
