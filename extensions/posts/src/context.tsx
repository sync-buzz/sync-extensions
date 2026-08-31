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
 * one page and one open record — three separate reads would be three answers
 * from three revisions.
 *
 * The context is here rather than beside the provider so that a column can
 * import it without importing the provider that renders the column.
 */
export interface AreaState {
  readonly project: OpenProject;
  readonly slice: SliceId;
  readonly select: (slice: SliceId) => void;
  readonly drafts: Corpus;
  readonly publications: Corpus;
  /** The accounts this project publishes as. Read whichever slice is showing. */
  readonly channels: Corpus;
  /** The list the slice is showing, which is one of the three above. */
  readonly corpus: Corpus;

  /** What the workspace has open, or `null` while it is showing a list. */
  readonly openKey: string | null;
  readonly open: OpenDocument;
  readonly openPost: (key: string) => void;
  readonly closePost: () => void;
  /** Whether what is open is something already sent, and so not editable. */
  readonly openIsPublication: boolean;
  /** Whether what is open is a channel, which is edited in the inspector. */
  readonly openIsChannel: boolean;
  /** The record written a moment ago, whose first words are waiting to be typed. */
  readonly justCreated: string | null;

  readonly createDraft: () => void;
  /** Write a channel for one network, and open it to be connected. */
  readonly createChannel: (network: string) => void;
  readonly archive: (record: MemoryRecord) => void;
  /** Ask to delete one record. The confirmation is the window's own sheet. */
  readonly askRemoval: (key: string | null) => void;

  /**
   * Give the open channel what its network asks for.
   *
   * The credential is checked against the network before it is stored — one
   * that will not answer is one that would have failed at the moment somebody
   * published — and what comes back, the account and the author, is written
   * into the record. The value itself goes to the vault and nowhere else.
   *
   * `identity` is the second value some networks need: a handle to sign in
   * with, a chat to post into. An empty `secret` means *the one this machine
   * already has*, which is what lets somebody change the chat a bot posts into
   * without going to find the token again — a token nothing in this window can
   * show them.
   */
  readonly connect: (secret: string, identity: string) => void;
  readonly connecting: boolean;
  /** Whether the open channel has a token on this machine. `null` while asking. */
  readonly hasSecret: boolean | null;
  /** Take the token away, leaving the channel and everything sent through it. */
  readonly disconnect: () => void;

  /**
   * Publish the open draft.
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
 * What a command answered with, and which kind of answer.
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
