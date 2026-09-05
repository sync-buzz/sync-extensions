"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import { SplitSquareHorizontal, SplitSquareVertical } from "lucide-react";

import {
  Button,
  PanelHeader,
  PanelPlaceholder,
  PanelSurface,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@sync-buzz/extension-api";

import { useArea } from "./context";
import * as screens from "./screens";
import { type Divided, type Path, type Tile, shareAt, terminals } from "./tabs";
import { TerminalTile } from "./tile";

/**
 * How far past the hairline the pointer still finds it.
 *
 * A one-pixel target is not a target. The line stays one pixel because it is a
 * structural edge, and what is widened is where it can be grabbed — which is
 * what every split view on this system does and what nothing on screen says.
 */
const GRAB = 3;

/** What one press of an arrow key moves a divider, as the window's own edges do. */
const NUDGE = 0.05;

/**
 * The boundary between two tiles: a structural edge that happens to be
 * draggable, not a decorative divider.
 *
 * One hairline, no shadow, no radius, no inset — and under the pointer or in a
 * drag it changes which of two greys it is rather than taking a colour. Where
 * something can be grabbed is neither status nor destruction, and this window
 * keeps colour for those two.
 *
 * It is dragged with a pointer capture, and it must not leave the tree while it
 * holds one: removing a captured element mid-gesture throws `InvalidStateError`
 * — which is why nothing here closes a tile or divides one from inside the
 * drag. It is reachable from the keyboard for the same reason the window's own
 * panel edges are: a boundary only the pointer can move is a boundary half the
 * people using this cannot.
 */
function Divider({
  along,
  ratio,
  box,
  onMove,
}: {
  along: "row" | "column";
  ratio: number;
  box: RefObject<HTMLDivElement | null>;
  onMove: (ratio: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const measured = () => {
    const rect = box.current?.getBoundingClientRect();
    return rect ? { rect, size: along === "row" ? rect.width : rect.height } : null;
  };

  const nudge = (by: number) => {
    const found = measured();
    if (found) {
      onMove(shareAt((ratio + by) * found.size, found.size));
    }
  };

  return (
    <div
      role="separator"
      aria-orientation={along === "row" ? "vertical" : "horizontal"}
      aria-label="Boundary between two terminals"
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      className="group relative z-10 shrink-0 touch-none"
      style={along === "row" ? { width: 1 } : { height: 1 }}
      onPointerDown={(event) => {
        // Otherwise the gesture starts a text selection in the terminal it
        // began over, and the drag ends with half a screen highlighted.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const found = dragging ? measured() : null;
        if (found) {
          onMove(
            along === "row"
              ? shareAt(event.clientX - found.rect.left, found.size)
              : shareAt(event.clientY - found.rect.top, found.size),
          );
        }
      }}
      onPointerUp={(event) => {
        // Asked rather than assumed: releasing a capture that was already lost
        // — the pointer was cancelled, the window took it away — is a refusal,
        // not a no-op, and it would be thrown from inside a gesture that has
        // otherwise finished cleanly.
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setDragging(false);
      }}
      onPointerCancel={() => setDragging(false)}
      // The gesture the window's own panel edges answer with their default
      // width. Two terminals have no default other than the same share each.
      onDoubleClick={() => onMove(0.5)}
      onKeyDown={(event) => {
        const back = along === "row" ? "ArrowLeft" : "ArrowUp";
        const on = along === "row" ? "ArrowRight" : "ArrowDown";
        if (event.key === back || event.key === on) {
          event.preventDefault();
          nudge(event.key === back ? -NUDGE : NUDGE);
          return;
        }
        // The same thing the double-click does, for somebody who got here with
        // the keyboard. Nothing this divider can do is reachable one way only.
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onMove(0.5);
        }
      }}
    >
      {/* Where it is grabbed: wider than the line, drawn by nothing. */}
      <div
        className={cn("absolute", along === "row" ? "cursor-col-resize" : "cursor-row-resize")}
        style={
          along === "row"
            ? { top: 0, bottom: 0, left: -GRAB, right: -GRAB }
            : { left: 0, right: 0, top: -GRAB, bottom: -GRAB }
        }
      />
      {/* The line itself, which takes no events of its own. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-colors duration-(--motion-duration-fast) ease-shell",
          dragging ? "bg-separator-strong" : "bg-separator group-hover:bg-separator-strong",
        )}
      />
    </div>
  );
}

/** One tile, or two with a boundary between them, drawn at the share it holds. */
function Arrangement({ tile, path, share }: { tile: Tile; path: Path; share: number }) {
  if (tile.kind === "terminal") {
    return <TerminalTile name={tile.name} share={share} />;
  }
  return <Halves tile={tile} path={path} share={share} />;
}

/**
 * Two halves of a box, and the boundary they share.
 *
 * Nested flex containers with `flex-grow` set to each half's share, so the
 * arrangement is laid out by the browser and nothing here computes a rectangle.
 * The alternative — absolute positions from measured pixels — is the same
 * answer arrived at twice, and the second copy is the one that goes stale.
 */
function Halves({ tile, path, share }: { tile: Divided; path: Path; share: number }) {
  const box = useRef<HTMLDivElement>(null);
  const { setRatio } = useArea();

  return (
    <div
      ref={box}
      className={cn("flex min-h-0 min-w-0", tile.along === "row" ? "flex-row" : "flex-col")}
      style={{ flex: `${share} 1 0%` }}
    >
      <Arrangement tile={tile.first} path={[...path, "first"]} share={tile.ratio} />
      <Divider
        along={tile.along}
        ratio={tile.ratio}
        box={box}
        onMove={(ratio) => setRatio(path, ratio)}
      />
      <Arrangement tile={tile.second} path={[...path, "second"]} share={1 - tile.ratio} />
    </div>
  );
}

/**
 * The tab that is open, as the tiles it is divided into.
 *
 * The header names the tab and carries one kind of control — the command that
 * writes into the very thing the header is naming, which here is another
 * shell, in each of the two directions it can be written in.
 *
 * What the tab is *called* is not asked here. A name belongs to the row in the
 * list, so it is asked over that row, in the column that holds it — which is
 * what this window does with a question anywhere else.
 */
export function TerminalsWorkspace() {
  const { tabs, openTab, active, addTab, split } = useArea();
  const tab = tabs.find((held) => held.id === openTab) ?? null;

  /**
   * Measure again when this section is looked at.
   *
   * An area is mounted on first visit and never unmounted, so while somebody is
   * elsewhere these tiles are hidden — and a hidden box measures nothing. The
   * window can be resized in the meantime, which means what comes back is a
   * screen wrapped to a width that is gone until something else disturbs it.
   */
  useEffect(() => {
    if (!active || !tab) {
      return;
    }
    for (const name of terminals(tab.layout)) {
      const screen = screens.held(name);
      if (screen) {
        screens.fitTo(screen);
      }
    }
  }, [active, tab]);

  if (!tab) {
    return (
      <PanelSurface>
        {/* Named by nothing, because nothing is being shown. This band says
            what the column holds and the one beside it names the section, so
            repeating the section here would be two columns giving one answer —
            and what is open is exactly what a person cannot read off the
            navigator. The band and its hairline stay: it is one line across the
            slab, and a column that dropped it would break the line. */}
        <PanelHeader title="" />
        {/* The shell's placeholder is a bare block and centres nothing, so the
            column it is put in supplies both. The command sits beneath it
            rather than inside it: a placeholder that carried one would give
            every empty column in the window a slot for a button. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
          <PanelPlaceholder
            headline="No tab is open"
            detail="A tab holds one shell in this project's folder, and can be divided into more."
          />
          <Button variant="secondary" size="sm" onClick={addTab}>
            New tab
          </Button>
        </div>
      </PanelSurface>
    );
  }

  return (
    <PanelSurface>
      <PanelHeader title={tab.name}>
        {/* Both axes, because they are one command in its two forms and the
            header is where that command lives. One of them here and the other
            only in a menu would read as the second being the lesser of the two,
            which is not true of either — and it is what a person who wanted the
            other one would go looking for and not find.

            Each acts on whichever tile the person was last in: splitting "the
            terminal" has to mean the one they are looking at. One group, so the
            header's own spacing keeps the title at one edge and both controls
            at the other rather than spreading three things across the band. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Split the terminal to the right"
                onClick={() => split(tab.focus, "beside")}
              >
                <SplitSquareHorizontal />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Split right</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Split the terminal downwards"
                onClick={() => split(tab.focus, "below")}
              >
                <SplitSquareVertical />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Split down</TooltipContent>
          </Tooltip>
        </div>
      </PanelHeader>
      <div className="terminals-layout flex min-h-0 flex-1">
        <Arrangement tile={tab.layout} path={[]} share={1} />
      </div>
    </PanelSurface>
  );
}
