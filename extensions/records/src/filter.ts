"use client";

import {
  ATTENTION_STATES,
  PAGE_LIMIT,
  useCorpus,
  type Corpus,
} from "@sync-buzz/extension-api";
import type { MemorySelection } from "@sync-buzz/extension-api";

/**
 * What Records is, once the corpus is not its.
 *
 * Reading records, writing them, types, freshness and failures are the
 * project's own machinery and live in `use-corpus` — every extension needs
 * them and none of them is about this section in particular. What is left
 * here is the one thing that *is* this extension's: how a person cuts the
 * corpus while reading it, which is a kind or one of two views across kinds.
 *
 * That the remainder is this small is the answer rather than a sign the split
 * went wrong. An extension is thin because the window already does the work;
 * a thick one would mean the host had failed to offer something obvious.
 */

/**
 * What the navigator has selected.
 *
 * A kind, or one of the two views that cut across kinds. It is a shape rather
 * than a bare string so that a type named `all` — which the store is free to
 * hold — cannot collide with the view of everything.
 */
export type RecordsFilter =
  | { readonly view: "all" | "attention" }
  | {
      readonly kind: string;
      /**
       * One folder of that kind, and only what is filed directly in it.
       *
       * Directly, because that is what opening a folder means everywhere else:
       * Finder shows a directory's contents and not its descendants, and a
       * count that included the subtree would disagree with the rows under it.
       *
       * Absent is the whole type, which is not the same as `""` — that is the
       * root, the records of this type filed in no folder at all.
       */
      readonly folder?: string;
    };

/**
 * The Records column's data.
 *
 * One line of its own: translate the filter, and hand the rest to the corpus.
 */
export function useRecords(
  projectPath: string,
  filter: RecordsFilter,
  hidden: readonly string[] = [],
  active = true,
): Corpus {
  return useCorpus(projectPath, selection(filter), hidden, active);
}

/**
 * A filter, as the store is asked for it.
 *
 * The two views are not kinds and cannot be asked for as one: "everything" is
 * the absence of a kind, and "needs attention" is a freshness. Which is why the
 * filter is a shape and this function exists at all.
 */
function selection(filter: RecordsFilter): MemorySelection {
  if ("kind" in filter) {
    const kind = { kind: filter.kind, limit: PAGE_LIMIT };
    return filter.folder === undefined
      ? kind
      : { ...kind, folder: filter.folder };
  }
  if (filter.view === "attention") {
    return { freshness: [...ATTENTION_STATES], limit: PAGE_LIMIT };
  }
  return { limit: PAGE_LIMIT };
}
