"use client";

import { useMemo, useState } from "react";

import { Ellipsis, Plus, SquareTerminal } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PanelFooter,
  PanelHeader,
  PanelPlaceholder,
  PanelSurface,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SourceList,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type SourceListItem,
} from "@sync-buzz/extension-api";

import { commandsFor, menuOn } from "./commands";
import { type AreaState, useArea } from "./context";
import { terminals } from "./tabs";

/**
 * The tabs, and nothing about what is in one.
 *
 * A source list rather than rows of this package's own, because what this
 * column is, is the question a source list answers: where am I. Everything that
 * comes with it is the system's — focus follows selection, the arrow keys move
 * it, a row is carried by dragging it or with the option key and an arrow — and
 * none of it would be got right twice.
 *
 * The figure on a row is how many shells the tab holds. A figure and not a dot:
 * it is as true when nobody is looking, and a dot on this system means
 * something happened.
 */
export function TerminalsNavigator() {
  const area = useArea();
  const { tabs, openTab, select, addTab, reorder, renaming, askRename, renameTab } = area;

  const items = useMemo<SourceListItem[]>(
    () =>
      tabs.map((tab) => {
        const open = terminals(tab.layout).length;
        return {
          id: tab.id,
          label: tab.name,
          icon: SquareTerminal,
          // Only once there is more than one. A figure that reads "1" beside
          // every row says nothing anybody could act on, and this column is
          // narrow enough that saying nothing is worth the space.
          badge: open > 1 ? ({ kind: "count", value: open } as const) : undefined,
          menu: () => menuOn(area, tab, tab.id),
        };
      }),
    [area, tabs],
  );

  const selected = tabs.find((tab) => tab.id === openTab) ?? null;
  const renamed = tabs.find((tab) => tab.id === renaming) ?? null;

  return (
    <PanelSurface>
      <PanelHeader title="Terminals" />
      {/* The scroller is here whether or not there is anything in it, because
          it is the one thing between the header and the bottom bar that grows:
          without it an empty column stacks all three against the top and the
          bar floats in the middle of the panel, which reads as a list that
          failed to draw rather than as a list with nothing in it. */}
      <ScrollArea className="min-h-0 flex-1">
        {tabs.length === 0 ? (
          // The inset the rows would have had. `PanelPlaceholder` is a bare
          // block and takes none of its own, so text put straight into a column
          // stands against the edge it is meant to be indented from — and it is
          // the rows this lines up with, not the panel.
          <div className="px-2 pt-1">
            <PanelPlaceholder
              headline="No terminals"
              detail="A tab holds one shell to begin with, in this project's folder."
            />
          </div>
        ) : (
          <SourceList
            label="Terminal tabs"
            items={items}
            activeId={openTab ?? ""}
            onSelect={select}
            onReorder={reorder}
          />
        )}
      </ScrollArea>
      <PanelFooter>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={addTab} aria-label="New tab">
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New tab</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!selected}
              aria-label={
                selected ? `Actions for ${selected.name}` : "Actions for the selected tab"
              }
              className="text-fg-tertiary hover:text-fg aria-expanded:bg-selected aria-expanded:text-fg"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>

          {/* The same commands the row's own secondary click offers. A menu
              that opens under the pointer is invisible to the keyboard: a
              right-click is a shortcut to an interface, and this bar is the
              interface. */}
          <DropdownMenuContent align="start" className="w-60">
            {selected === null ? null : (
              <DropdownMenuLabel className="truncate">{selected.name}</DropdownMenuLabel>
            )}
            {tabCommands(area)}
          </DropdownMenuContent>
        </DropdownMenu>
      </PanelFooter>

      {/* A row of this list is a row of the window's own list and not a form,
          so the question is asked over it rather than unfolded inside it —
          which is what this window does with a question anywhere else, and
          what the column beside this one does with a folder. */}
      <Sheet
        open={renaming !== null}
        onOpenChange={(open: boolean) => !open && askRename(null)}
      >
        <SheetContent>
          {/* Mounted only while it is open, so the field holds the name of the
              tab being renamed rather than of the one renamed before it. */}
          {renamed === null ? null : (
            <Renaming
              name={renamed.name}
              onClose={() => askRename(null)}
              onSettle={(said) => renameTab(renamed.id, said)}
            />
          )}
        </SheetContent>
      </Sheet>
    </PanelSurface>
  );
}

/** Asking what a tab is called. */
function Renaming({
  name,
  onClose,
  onSettle,
}: {
  name: string;
  onClose: () => void;
  onSettle: (name: string) => void;
}) {
  const [text, setText] = useState(name);

  const settle = () => {
    const said = text.trim();
    onClose();
    // An empty field leaves the name it had. A tab with no name at all is a row
    // that cannot be told from its neighbours, and this window does not offer
    // a state somebody has to undo.
    if (said !== "" && said !== name) {
      onSettle(said);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>Rename tab</SheetTitle>
      </SheetHeader>
      <div className="flex flex-col gap-3 px-4 py-3">
        <SheetDescription>
          What this tab is called in the list. The shells in it are not touched.
        </SheetDescription>
        <input
          autoFocus
          value={text}
          placeholder={name}
          aria-label="Tab name"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") settle();
            if (event.key === "Escape") onClose();
          }}
          className="h-(--control-height-lg) w-full rounded-(--radius-control) border border-separator bg-input px-2 text-base text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <SheetFooter>
        <div className="min-w-0 flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={settle}>
          Rename
        </Button>
      </SheetFooter>
    </>
  );
}

/** The selected tab's commands, drawn as the shell's own menu rather than the system's. */
function tabCommands(area: AreaState) {
  const tab = area.tabs.find((held) => held.id === area.openTab);
  if (!tab) {
    return null;
  }
  return commandsFor(area, tab, tab.id).map((command, at) =>
    command === "separator" ? (
      <DropdownMenuSeparator key={`rule-${at}`} />
    ) : (
      <DropdownMenuItem
        key={command.label}
        variant={command.ends ? "destructive" : undefined}
        onSelect={command.run}
      >
        {command.label}
      </DropdownMenuItem>
    ),
  );
}
