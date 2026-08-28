"use client";

import { PAGE_LIMIT, useCorpus, type Corpus } from "@sync-buzz/extension-api";

import { KIND, ROW_FIELDS } from "./model";

/**
 * How a person cuts the questions while reading them.
 *
 * One kind, no folders, and two states — so what is left to choose is which of
 * the two a person is looking at, and *everything* for the reader who wants the
 * lot in one column.
 *
 * Folders are deliberately absent. A question is open for days and then it is
 * answered; filing one is arranging something that is about to stop needing an
 * arrangement, and the record it is *about* is already where the grouping
 * lives.
 *
 * A shape rather than a bare string, for the reason Records gives: it leaves
 * room for a cut that is not a view without every reader of this type having to
 * change.
 */
export type QuestionsFilter = { readonly view: "open" | "answered" | "all" };

/**
 * Every question in the project, read once.
 *
 * The three views are not three reads. `status` is a field of this type rather
 * than anything the engine sorts on, so the selection is the same for all three
 * and the view is a filter over the page — which is what makes the counts in
 * the navigator and the rows in the workspace incapable of disagreeing.
 *
 * The read names the fields a row is drawn from. A listing carries what it was
 * asked for and nothing else, so a list that groups by state says so here
 * rather than opening every record to find out.
 */
export function useQuestions(projectPath: string, active = true): Corpus {
  return useCorpus(
    projectPath,
    { kind: KIND, fields: [...ROW_FIELDS], limit: PAGE_LIMIT },
    undefined,
    active,
  );
}
