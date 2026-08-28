"use client";

import { PAGE_LIMIT, useCorpus, type Corpus } from "@sync-buzz/extension-api";

import { DRAFT, DRAFT_FIELDS, PUBLICATION, PUBLICATION_FIELDS } from "./model";

/**
 * The two halves of this section, and there is no third.
 *
 * Not a filter over one list but two different kinds of thing: something that
 * can still be changed, and something that has been said. A single list with a
 * *sent* flag on some rows was the first shape and is wrong — it invites the
 * same row to be edited before and after the one moment that makes editing it
 * a lie.
 */
export const SLICES = [
  {
    id: "drafts",
    label: "Drafts",
    note: "Written here, not sent anywhere.",
  },
  {
    id: "published",
    label: "Published",
    note: "The text of what went out, as it went.",
  },
] as const;

export type SliceId = (typeof SLICES)[number]["id"];

/**
 * Both lists, read together and in step.
 *
 * Two reads rather than one switched by the slice, because the column beside
 * them says how many are in each: a count only for the half being shown is a
 * navigator that answers a question about where you already are. They cost one
 * listing each and are asked for by kind, so neither brings the other's rows.
 *
 * Every read names the fields its rows are drawn from. A listing carries what
 * it was asked for and nothing else — a row that says who could read a post
 * says so because the field was named here.
 */
export function usePosts(
  projectPath: string,
  active: boolean,
): { drafts: Corpus; publications: Corpus } {
  const drafts = useCorpus(
    projectPath,
    { kind: DRAFT, fields: [...DRAFT_FIELDS], limit: PAGE_LIMIT },
    undefined,
    active,
  );
  const publications = useCorpus(
    projectPath,
    { kind: PUBLICATION, fields: [...PUBLICATION_FIELDS], limit: PAGE_LIMIT },
    undefined,
    active,
  );
  return { drafts, publications };
}

/** What the surface is showing, in the words its header says it in. */
export function sliceName(slice: SliceId): string {
  return SLICES.find((entry) => entry.id === slice)?.label ?? slice;
}
