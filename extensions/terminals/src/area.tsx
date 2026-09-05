"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AreaProviderProps } from "@sync-buzz/extension-api";
import { useBadge } from "@sync-buzz/extension-api";

import { AreaProvider, type Tab } from "./context";
import { door } from "./host";
import * as screens from "./screens";
import {
  type Path,
  one,
  remove,
  seatOf,
  setRatio,
  split,
  swap,
  terminals,
  unusedName,
} from "./tabs";

/**
 * The tabs with one of them rewritten, or the very list that was passed in.
 *
 * Answering with the same list when nothing moved is what keeps a click inside
 * a terminal from being a render: the pointer says which tile is being worked
 * in on every press, and almost every press says what was already true.
 */
function rewriting(existing: readonly Tab[], change: (tab: Tab) => Tab): readonly Tab[] {
  const next = existing.map(change);
  return next.every((tab, at) => tab === existing[at]) ? existing : next;
}

/**
 * Everything this area holds, and the one place a shell is raised or ended.
 *
 * The columns ask for things to happen; nothing about a terminal is decided in
 * either of them. That is not tidiness — a tile that closed its own shell would
 * be a component deciding the fate of a process that outlives it.
 */
export function TerminalsProvider({ project, active, children }: AreaProviderProps) {
  const [tabs, setTabs] = useState<readonly Tab[]>([]);
  const [openTab, setOpenTab] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const named = useRef(0);

  /**
   * What the tabs are by the time a callback that had to wait comes back.
   *
   * Raising a shell is a round trip to the far end. An arrangement decided from
   * the tabs the callback closed over would be written back one change out of
   * date, taking with it whatever landed while it waited — and what lands while
   * a shell is being raised is another shell.
   */
  const held = useRef<readonly Tab[]>(tabs);
  held.current = tabs;

  const addTab = useCallback(() => {
    void (async () => {
      const screen = await screens.open(project.path, project.path);
      named.current += 1;
      const id = `tab-${named.current}`;
      setTabs((existing) => [
        ...existing,
        {
          id,
          name: unusedName(existing.map((tab) => tab.name)),
          layout: one(screen.name),
          focus: screen.name,
        },
      ]);
      setOpenTab(id);
      screens.focusOn(screen.name);
    })();
  }, [project.path]);

  const renameTab = useCallback((id: string, name: string) => {
    setTabs((existing) => existing.map((tab) => (tab.id === id ? { ...tab, name } : tab)));
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((existing) => {
      const going = existing.find((tab) => tab.id === id);
      if (going) {
        for (const tile of terminals(going.layout)) {
          screens.close(tile);
        }
      }
      const left = existing.filter((tab) => tab.id !== id);
      // Whichever tab took its place, or the one before it when it was last.
      // Selecting nothing would leave the workspace empty with tabs still in
      // the column beside it, which reads as a failure rather than a choice.
      setOpenTab((open) => {
        if (open !== id) {
          return open;
        }
        const was = existing.findIndex((tab) => tab.id === id);
        return left[Math.min(was, left.length - 1)]?.id ?? null;
      });
      return left;
    });
  }, []);

  const splitTile = useCallback(
    (tile: string, along: "beside" | "below") => {
      const axis = along === "beside" ? "row" : "column";
      void (async () => {
        const screen = await screens.open(project.path, project.path);
        const tab = held.current.find((candidate) => candidate.id === openTab);
        const divided = tab && split(tab.layout, tile, screen.name, axis);
        // The tile went while the shell was being raised — the tab was closed,
        // or that terminal was. There is nowhere to draw the shell now, and a
        // process nothing draws is a process nobody can end.
        if (!tab || !divided || divided === tab.layout) {
          screens.close(screen.name);
          return;
        }
        setTabs((existing) =>
          existing.map((candidate) =>
            candidate.id === tab.id
              ? { ...candidate, layout: divided, focus: screen.name }
              : candidate,
          ),
        );
        screens.focusOn(screen.name);
      })();
    },
    [openTab, project.path],
  );

  const closeTile = useCallback(
    (tile: string) => {
      const tab = held.current.find((candidate) => candidate.id === openTab);
      if (!tab) {
        return;
      }
      const left = remove(tab.layout, tile);
      // The last tile of a tab is the tab: a tab with no shells in it is a row
      // that opens onto nothing, and leaving one behind makes closing the last
      // terminal look like it failed.
      if (left === null) {
        closeTab(tab.id);
        return;
      }
      if (left === tab.layout) {
        return;
      }
      screens.close(tile);
      const carrying =
        tab.focus === tile ? (terminals(left)[0] ?? tab.focus) : tab.focus;
      setTabs((existing) =>
        existing.map((candidate) =>
          candidate.id === tab.id ? { ...candidate, layout: left, focus: carrying } : candidate,
        ),
      );
      // The shell that took the space is the one the work carries on in.
      screens.focusOn(carrying);
    },
    [closeTab, openTab],
  );

  const focusTile = useCallback((tile: string) => {
    setTabs((existing) =>
      rewriting(existing, (tab) =>
        tab.focus !== tile && terminals(tab.layout).includes(tile)
          ? { ...tab, focus: tile }
          : tab,
      ),
    );
  }, []);

  const moveTile = useCallback((tile: string) => {
    setTabs((existing) =>
      rewriting(existing, (tab) => {
        const seat = seatOf(tab.layout, tile);
        if (!seat) {
          return tab;
        }
        return { ...tab, layout: swap(tab.layout, seat.path) };
      }),
    );
  }, []);

  const resize = useCallback(
    (path: Path, ratio: number) => {
      setTabs((existing) =>
        rewriting(existing, (tab) => {
          if (tab.id !== openTab) {
            return tab;
          }
          const layout = setRatio(tab.layout, path, ratio);
          return layout === tab.layout ? tab : { ...tab, layout };
        }),
      );
    },
    [openTab],
  );

  const reorder = useCallback((ids: readonly string[]) => {
    setTabs((existing) => {
      const byId = new Map(existing.map((tab) => [tab.id, tab]));
      return ids.map((id) => byId.get(id)).filter((tab): tab is Tab => tab !== undefined);
    });
  }, []);

  const countIn = useCallback(
    (id: string) => {
      const tab = tabs.find((held) => held.id === id);
      return tab ? terminals(tab.layout).length : 0;
    },
    [tabs],
  );

  const open = useMemo(
    () => tabs.reduce((total, tab) => total + terminals(tab.layout).length, 0),
    [tabs],
  );

  // How many shells are running, which is a standing figure rather than news:
  // it is as true when nobody is looking, so it is a number and never a dot.
  // Nothing is reported while the section has never been opened, because
  // nothing has been raised — there is no earlier count this could be hiding.
  useBadge(open > 0 ? open : null);

  /**
   * Closing this window ends what it raised.
   *
   * The shells are held by the application rather than by the window, which is
   * what lets one survive a reload — and is also why nothing would end them
   * when a project window is closed for good. This is the only place that knows
   * the difference has arrived.
   */
  useEffect(() => {
    const ending = () => {
      void door().closeProject(project.path);
    };
    window.addEventListener("beforeunload", ending);
    return () => window.removeEventListener("beforeunload", ending);
  }, [project.path]);

  const state = useMemo(
    () => ({
      project,
      tabs,
      openTab,
      select: setOpenTab,
      addTab,
      renameTab,
      renaming,
      askRename: setRenaming,
      closeTab,
      split: splitTile,
      closeTile,
      focusTile,
      moveTile,
      setRatio: resize,
      countIn,
      reorder,
      active,
    }),
    [
      active,
      addTab,
      closeTab,
      closeTile,
      countIn,
      focusTile,
      moveTile,
      openTab,
      project,
      renameTab,
      renaming,
      reorder,
      resize,
      splitTile,
      tabs,
    ],
  );

  return <AreaProvider value={state}>{children}</AreaProvider>;
}
