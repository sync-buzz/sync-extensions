"use client";

import { createContext, useContext } from "react";

import type { OpenProject } from "@sync-buzz/extension-api";

import type { Path, Tile } from "./tabs";

/** One tab: a name a person chose, and how it is divided. */
export interface Tab {
  readonly id: string;
  readonly name: string;
  /** Ordinary React state, so a rearrangement is a render like any other. */
  readonly layout: Tile;
  /**
   * The terminal last worked in, which is the one "the terminal" means.
   *
   * Kept here rather than read off the document's focus, because a shell is
   * typed into and a divider is dragged with the pointer: after a drag the
   * focused element is the divider, and the command in the header would then
   * divide whichever tile happened to be first.
   */
  readonly focus: string;
}

/**
 * What the two columns of this area share.
 *
 * They are two components because the window renders them into two different
 * places in its panel tree, and they have to agree about which tab is open —
 * two reads would be two answers.
 */
export interface AreaState {
  readonly project: OpenProject;
  readonly tabs: readonly Tab[];
  readonly openTab: string | null;
  readonly select: (id: string) => void;
  /** Write a tab, with one shell in it, and open it. */
  readonly addTab: () => void;
  readonly renameTab: (id: string, name: string) => void;
  /**
   * The tab whose name is waiting to be typed, or `null`.
   *
   * Asked for in the column that lists the tabs and answered in the one that
   * shows the open tab's name, which is the same rule a record follows: it is
   * edited where it is read, and the name is read largest in the header.
   */
  readonly renaming: string | null;
  readonly askRename: (id: string | null) => void;
  /** End a tab and every shell in it. */
  readonly closeTab: (id: string) => void;
  /** Divide the tile a terminal is in, and raise a shell in the new half. */
  readonly split: (tile: string, along: "beside" | "below") => void;
  /** End one shell. Its space goes back to whatever it was divided from. */
  readonly closeTile: (tile: string) => void;
  /** Say which terminal is being worked in, so that "the terminal" has a referent. */
  readonly focusTile: (tile: string) => void;
  /** Exchange one terminal with the neighbour it shares a division with. */
  readonly moveTile: (tile: string) => void;
  /** Give one division of the open tab a new share of its space. */
  readonly setRatio: (path: Path, ratio: number) => void;
  /** How many shells are open in one tab. */
  readonly countIn: (id: string) => number;
  /** The rows were put in this order by the person reading them. */
  readonly reorder: (ids: readonly string[]) => void;
  /** False while this area is mounted but not the selected one. */
  readonly active: boolean;
}

const Area = createContext<AreaState | null>(null);

export const AreaProvider = Area.Provider;

export function useArea(): AreaState {
  const state = useContext(Area);
  if (!state) {
    throw new Error("A column of Terminals was rendered outside its area.");
  }
  return state;
}
