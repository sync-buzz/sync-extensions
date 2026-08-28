"use client";

import { createContext, useContext } from "react";

import type {
  Corpus,
  MemoryRecord,
  OpenDocument,
  OpenProject,
} from "@sync-buzz/extension-api";

import type { SliceId } from "./filter";

/**
 * What the three columns of this area share.
 *
 * They are three components because the window renders them into three
 * different places in its panel tree, and they have to agree about one slice,
 * one page and one open post — three separate reads would be three answers
 * from three revisions.
 *
 * The context is here rather than beside the provider so that a column can
 * import it without importing the provider that renders the column.
 */
export interface AreaState {
  readonly project: OpenProject;
  readonly slice: SliceId;
  readonly select: (slice: SliceId) => void;
  /** Both lists, whichever is being shown. The navigator counts both. */
  readonly drafts: Corpus;
  readonly publications: Corpus;
  /** The list the slice is showing, which is one of the two above. */
  readonly corpus: Corpus;

  /** The post the workspace has open, or `null` while it is showing the list. */
  readonly openKey: string | null;
  readonly open: OpenDocument;
  readonly openPost: (key: string) => void;
  readonly closePost: () => void;
  /** Whether what is open is something already sent, and so not editable. */
  readonly openIsPublication: boolean;
  /** The draft written a moment ago, whose first words are waiting to be typed. */
  readonly justCreated: string | null;

  readonly createDraft: () => void;
  readonly archive: (record: MemoryRecord) => void;
  /** Ask to delete one record. The confirmation is the window's own sheet. */
  readonly askRemoval: (key: string | null) => void;

  /**
   * Send the open draft.
   *
   * The one command in this package that leaves the window, and it is a
   * person's: there is no clock behind it and no handler that could reach it.
   */
  readonly send: () => void;
  readonly sending: boolean;
  readonly sent: Sent | null;
  readonly dismissSent: () => void;

  /** Why the last write did not happen, and how to stop saying so. */
  readonly failure: string | null;
  readonly dismissFailure: () => void;
}

/**
 * What sending answered with, and which kind of answer.
 *
 * Two members rather than a string, because the string alone cannot be drawn
 * correctly: *it went* and *it did not go* are opposite news, and a refusal in
 * the same quiet grey as a success reads as a success.
 */
export interface Sent {
  readonly said: string;
  readonly failed: boolean;
}

export const Area = createContext<AreaState | null>(null);

export function useArea(): AreaState {
  const held = useContext(Area);
  if (held === null) {
    throw new Error("A Posts column was drawn outside its own provider.");
  }
  return held;
}
