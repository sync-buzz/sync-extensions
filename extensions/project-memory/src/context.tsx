"use client";

import { createContext, useContext } from "react";

import type {
  Corpus,
  Dependent,
  EntityLink,
  MemoryDocument,
  MemoryRecord,
  OpenDocument,
  OpenProject,
} from "@sync-buzz/extension-api";

import type { QuestionsFilter } from "./filter";

/**
 * What the three columns of this area share.
 *
 * They are three components because the window renders them into three
 * different places in its panel tree, and they have to agree about one
 * selection and one open question — three separate reads would be three
 * answers from three revisions.
 *
 * The context is here rather than beside the provider so that a column can
 * import it without importing the provider that renders the column.
 */
export interface AreaState {
  readonly project: OpenProject;
  readonly corpus: Corpus;
  readonly filter: QuestionsFilter;
  readonly select: (filter: QuestionsFilter) => void;

  /** The question the workspace has open, or `null` while it shows the list. */
  readonly openKey: string | null;
  readonly open: OpenDocument;
  readonly openQuestion: (key: string) => void;
  readonly close: () => void;

  /** What the open question is about, as far as the record says. */
  readonly about: About;

  /**
   * Take an option, or take it back.
   *
   * One option on a single-choice question replaces whatever was there; on a
   * multiple-choice one it is added to what is there. Written at once, by the
   * shell's rule for a discrete value.
   */
  readonly choose: (option: string) => void;
  /** Type into the prose answer. Written on a pause, because typing is typing. */
  readonly writeAnswer: (text: string) => void;
  /** Settle it: the status moves to answered and the record is archived. */
  readonly settle: () => void;
  /** Undo that — the question goes back to the lists, keeping what was said. */
  readonly reopen: () => void;

  readonly archive: (record: MemoryRecord) => void;
  /** Ask to delete one. The confirmation is the window's own sheet. */
  readonly askRemoval: (key: string | null) => void;

  /** Why the last command did not happen, and how to stop saying so. */
  readonly failure: string | null;
  readonly dismissFailure: () => void;
}

/**
 * What a question is about, assembled from the three places a record says so.
 *
 * This is the half of the area that exists for the person rather than for the
 * record: a question read on its own is answered from whatever the reader
 * happens to remember, and every one of these was written by somebody who had
 * the context in front of them and did not need it.
 */
export interface About {
  /**
   * The record the question points at, read whole.
   *
   * One rather than all of them, and the first `references` link rather than an
   * arbitrary one: a question is about something, and a screen that opened four
   * documents beside it would be a screen nobody reads. The rest are listed by
   * key, which is enough to go and find them.
   */
  readonly primary: MemoryDocument | null;
  readonly loading: boolean;
  /** Everything else the question points at, in the order it points. */
  readonly others: readonly EntityLink[];
  /**
   * What points *at* the question — the task waiting on it, the claim that
   * raised it. Free with the link the engine already holds, and it is the half
   * the asker most often forgets to write.
   */
  readonly incoming: readonly Dependent[];
}

export const Area = createContext<AreaState | null>(null);

export function useArea(): AreaState {
  const held = useContext(Area);
  if (held === null) {
    throw new Error("A Questions column was drawn outside its own provider.");
  }
  return held;
}
