"use client";

import { useEffect, useRef } from "react";

import { showNativeContextMenu } from "@sync-buzz/extension-api";

import { menuOn } from "./commands";
import { useArea } from "./context";
import * as screens from "./screens";

/**
 * One tile: an empty box a terminal is put into.
 *
 * It draws nothing of the terminal and owns none of it. The element it appends
 * was made when the shell was raised and outlives every tile that ever showed
 * it, which is what lets the arrangement change under a running build without
 * the build noticing.
 */
export function TerminalTile({ name, share }: { name: string; share: number }) {
  const box = useRef<HTMLDivElement>(null);
  const area = useArea();
  const { focusTile } = area;

  useEffect(() => {
    const screen = screens.held(name);
    if (!box.current || !screen) {
      return;
    }
    screens.attach(screen, box.current);
  }, [name]);

  /**
   * The emulator is told in cells, so something has to measure the box.
   *
   * Watched rather than subscribed to, because the rectangle changes for four
   * unrelated reasons — the window, the columns beside it, a divider being
   * dragged, a neighbouring tile being closed — and only one of those is an
   * event anything here could listen for. A `resize` handler on the window
   * would miss the other three, which are most of them.
   */
  useEffect(() => {
    const watched = box.current;
    if (!watched) {
      return;
    }
    const measuring = new ResizeObserver(() => {
      const screen = screens.held(name);
      if (screen) {
        screens.fitTo(screen);
      }
    });
    measuring.observe(watched);
    return () => measuring.disconnect();
  }, [name]);

  return (
    <div
      ref={box}
      // `clip` and never `hidden`: a hidden box is still a scrollport that has
      // lost its bar, so the browser goes on scrolling it to reach whatever was
      // focused and leaves the screen shifted with its foot over nothing.
      className="relative min-h-0 min-w-0 overflow-clip bg-workspace"
      style={{ flex: `${share} 1 0%` }}
      // Which tile the person is in. Three things read it: the command in the
      // header that divides "the terminal", the row drawn selected in the
      // column beside it, and the menu in that column's bottom bar. Taken on
      // the way down, so that it is already true by the time the emulator has
      // decided what the click means.
      onPointerDownCapture={() => focusTile(name)}
      onContextMenu={(event) => {
        const tab = area.tabs.find((held) => held.id === area.openTab);
        if (tab) {
          showNativeContextMenu(event, menuOn(area, tab, name));
        }
      }}
    />
  );
}
