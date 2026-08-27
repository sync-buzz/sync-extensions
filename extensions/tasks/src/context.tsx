"use client";

import { createContext, useContext } from "react";

import type {
  Corpus,
  Folders,
  MemoryRecord,
  OpenDocument,
  OpenProject,
} from "@sync-buzz/extension-api";

import type { TasksFilter } from "./filter";
import type { StatusId } from "./model";

/**
 * What the three columns of this area share.
 *
 * They are three components because the window renders them into three
 * different places in its panel tree, and they have to agree about one
 * selection, one page of the register and one open task — three separate reads
 * would be three answers from three revisions.
 *
 * The context is here rather than beside the provider so that a column can
 * import it without importing the provider that renders the column.
 */
export interface AreaState {
  readonly project: OpenProject;
  readonly corpus: Corpus;
  /** The folders tasks are filed in, read beside the corpus and in step with it. */
  readonly folders: Folders;
  readonly filter: TasksFilter;
  readonly select: (filter: TasksFilter) => void;
  /** The task the workspace has open, or `null` while it is showing the list. */
  readonly openKey: string | null;
  readonly open: OpenDocument;
  readonly openTask: (key: string) => void;
  readonly closeTask: () => void;
  /** The task written a moment ago, whose title is waiting to be typed. */
  readonly justCreated: string | null;
  /** Which rows of the tree are open. Held here because it outlives the column. */
  readonly expanded: readonly string[];
  readonly setExpanded: (expanded: readonly string[]) => void;

  /** Write a task, in the folder the person is standing in, and open it. */
  readonly createTask: () => void;
  /** Archive one task, or bring it back. */
  readonly archive: (record: MemoryRecord) => void;
  /** Ask to delete one task. The confirmation is the window's own sheet. */
  readonly askRemoval: (key: string | null) => void;

  /** Ask for a folder inside `parent`. */
  readonly askNewFolder: (parent: string) => void;
  readonly askRenameFolder: (folder: string) => void;
  readonly askRemoveFolder: (folder: string | null) => void;
  /** Open what a folder says about itself, writing it if it has said nothing. */
  readonly describeFolder: (folder: string) => void;
  /** The folder the selection is on, when it is on one. */
  readonly selectedFolder: SelectedFolder | null;
  /** What that folder says about itself, or nothing while it says nothing. */
  readonly folderNote: OpenDocument;
  /** Something was dragged onto a row that takes drops. */
  readonly dropOn: (target: unknown, payload: unknown) => void;

  /** Statuses this window is not listing. A preference of this machine's. */
  readonly hidden: readonly StatusId[];
  readonly toggleStatus: (status: StatusId) => void;
  readonly showAllStatuses: () => void;

  /** Hand the open task to an agent, as a conversation in Chat. */
  readonly send: () => void;
  readonly sent: Sent | null;
  readonly sending: boolean;
  /**
   * The conversation a task was handed to, while this window still has it.
   *
   * Held because the answer *it is in Chat somewhere* is not an answer: a
   * person who hands over three tasks has three conversations and no way to
   * tell which is which. What can be said without the window learning to
   * navigate for them is the conversation's own name and what it is doing,
   * beside the task it came from.
   */
  readonly conversationOf: (task: string) => Conversation | null;

  /** Why the last command did not happen, and how to stop saying so. */
  readonly failure: string | null;
  readonly dismissFailure: () => void;
}

/** The folder the navigator has selected, as the tree answered for it. */
export interface SelectedFolder {
  readonly path: string;
  /** The key of the record that *is* this folder, when one has been written. */
  readonly describedBy: string | null;
}

/** A conversation this window opened for a task, as it stands now. */
export interface Conversation {
  readonly key: string;
  /** What Chat lists it as: the task's own title, set when it was opened. */
  readonly title: string;
  /** What the agent is doing, or `null` once the conversation is not running. */
  readonly status: string | null;
}

/**
 * What sending a task to an agent answered with, and which kind of answer.
 *
 * Two members rather than a string, because the string alone cannot be drawn
 * correctly: *started* and *did not start* are opposite news, and a refusal in
 * the same tertiary grey as a success reads as a success.
 */
export interface Sent {
  readonly said: string;
  readonly failed: boolean;
}

export const Area = createContext<AreaState | null>(null);

export function useArea(): AreaState {
  const held = useContext(Area);
  if (held === null) {
    throw new Error("A Tasks column was drawn outside its own provider.");
  }
  return held;
}
