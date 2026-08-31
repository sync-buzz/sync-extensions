"use client";

import { PAGE_LIMIT, useCorpus, type Corpus } from "@sync-buzz/extension-api";

import {
  CHANNEL,
  CHANNEL_FIELDS,
  DRAFT,
  DRAFT_FIELDS,
  PUBLICATION,
  PUBLICATION_FIELDS,
} from "./model";

/**
 * The three halves of this section, which is one more than a half implies.
 *
 * Drafts and publications are two different kinds of thing rather than one list
 * with a flag: something that can still be changed, and something that has been
 * said. A single list with a *sent* mark on some rows was the first shape and is
 * wrong — it invites the same row to be edited before and after the one moment
 * that makes editing it a lie.
 *
 * Channels are the third because they are what the other two are *about*. A
 * person arriving at this section for the first time has nothing to publish
 * with, and the column has to have somewhere to send them.
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
  {
    id: "channels",
    label: "Channels",
    note: "The accounts this project publishes as.",
  },
] as const;

export type SliceId = (typeof SLICES)[number]["id"];

/**
 * All three lists, read together and in step.
 *
 * Three reads rather than one switched by the slice, because the column beside
 * them says how many are in each: a count only for the half being shown is a
 * navigator that answers a question about where you already are. And the draft
 * inspector needs the channels whichever slice is showing — a draft is chosen a
 * channel from a list that has to be there already.
 *
 * Every read names the fields its rows are drawn from. A listing carries what it
 * was asked for and nothing else.
 */
export function usePosts(
  projectPath: string,
  active: boolean,
): { drafts: Corpus; publications: Corpus; channels: Corpus } {
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
  const channels = useCorpus(
    projectPath,
    { kind: CHANNEL, fields: [...CHANNEL_FIELDS], limit: PAGE_LIMIT },
    undefined,
    active,
  );
  return { drafts, publications, channels };
}

/** What the surface is showing, in the words its header says it in. */
export function sliceName(slice: SliceId): string {
  return SLICES.find((entry) => entry.id === slice)?.label ?? slice;
}
