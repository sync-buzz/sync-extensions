"use client";

import { useMemo } from "react";

import { Archive, Ellipsis, Folder, FolderPlus } from "lucide-react";

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
  SourceTree,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  folderName,
  parentFolder,
  type MemoryFolder,
  type NativeMenuEntry,
  type SourceTreeItem,
} from "@sync-buzz/extension-api";
import type { LucideIcon } from "lucide-react";

import { useArea } from "./area";
import type { RoutinesFilter } from "./filter";

/**
 * The row every other row hangs from. Never drawn: a source list shows its
 * contents, not a row standing for the list itself. Named so it cannot collide
 * with a folder — a folder path is normalised and cannot start with a slash.
 */
const TREE_ROOT = "/root";

/** The whole list, which is the top of the hierarchy the folders are in. */
export const ALL_ROW = "/all";

/** What has been put away. A view, and never a folder. */
export const ARCHIVED_ROW = "/archived";

/** One folder's row. Exported because the provider expands rows too. */
export const folderRow = (path: string) => `folder/${path}`;

/**
 * The row a folder hangs from: the folder above it, or the list itself when the
 * folder is at the top.
 */
export function parentRow(folder: string): string {
  const parent = parentFolder(folder);
  return parent === "" ? ALL_ROW : folderRow(parent);
}

/** What selecting a row means. The id carries it, so nothing looks it up. */
function filterOf(id: string): RoutinesFilter {
  if (id === ALL_ROW) return { view: "all" };
  if (id === ARCHIVED_ROW) return { view: "archived" };
  return { folder: id.slice("folder/".length) };
}

/** Which row the current filter has selected. */
function activeId(filter: RoutinesFilter): string {
  if ("folder" in filter) return folderRow(filter.folder);
  return filter.view === "archived" ? ARCHIVED_ROW : ALL_ROW;
}

/**
 * The navigator lists the structure, and never the routines.
 *
 * That division is `Records`' and `Tasks`' alike, and getting it wrong is what
 * made this column a list you could fold shut: with the routines *inside* the
 * row that stands for the whole list, one triangle hid everything. A navigator
 * says where you are; the surface beside it says what is there.
 *
 * So there are three kinds of row and no others — the list itself, the folders
 * somebody made, and what has been archived — and every one of them is a place
 * to stand rather than a thing to read.
 */
export function RoutinesNavigator() {
  const area = useArea();

  const items = useMemo(
    () => rows(area.folders, area.counts, area.kindIcon, area),
    [area],
  );

  return (
    <PanelSurface className="bg-panel">
      {/* The header names the section and carries no control. Writing a routine
          belongs beside the list it joins, which is the surface next door —
          `design-foundation.md` §541, and the same place Tasks keeps it. */}
      <PanelHeader title="Routines" />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {area.corpus.error !== null ? (
            <div className="px-2 pt-1">
              <PanelPlaceholder
                headline="This project's memory could not be read"
                detail={area.corpus.error}
              />
            </div>
          ) : (
            <SourceTree
              label="Routines and their folders"
              items={items}
              rootId={TREE_ROOT}
              activeId={activeId(area.filter)}
              expanded={area.expanded}
              onExpandedChange={area.setExpanded}
              onSelect={(id) => area.select(filterOf(id))}
            />
          )}
        </div>
      </ScrollArea>

      {/* The bottom bar, where macOS keeps what acts on a source list — Mail,
          Reminders, Xcode's navigator. Everything in it acts on the list itself
          and nothing in it writes what the list contains: `+` adds a folder,
          which is how this column is arranged, and the menu beside it carries
          what can be done to the folder that is selected. */}
      <PanelFooter>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New folder"
              onClick={() => area.askNewFolder(area.folderInView)}
              className="text-fg-tertiary hover:text-fg"
            >
              <FolderPlus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {area.folderInView === ""
              ? "New folder"
              : `New folder in ${folderName(area.folderInView)}`}
          </TooltipContent>
        </Tooltip>

        <FolderActions />
      </PanelFooter>
    </PanelSurface>
  );
}

/**
 * What can be done to the selected folder, where a keyboard can reach it.
 *
 * The same commands are under the secondary button, drawn by the system. This
 * one is the interface: nothing in this window may be reachable only from a
 * menu that opens under the pointer, because such a menu is invisible to
 * anybody not using one.
 */
function FolderActions() {
  const area = useArea();
  const folder = "folder" in area.filter ? area.filter.folder : null;
  const top = folder === "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={folder === null}
          aria-label={
            folder === null || top
              ? "Actions for the selected folder"
              : `Actions for ${folderName(folder)}`
          }
          className="text-fg-tertiary hover:text-fg aria-expanded:bg-selected aria-expanded:text-fg"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        {folder === null ? null : (
          <>
            <DropdownMenuLabel className="truncate">
              {top ? "All routines" : folderName(folder)}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => area.askNewFolder(folder)}>
              New folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* The top is a folder everywhere else in this column and is not
                one here: there is nothing above it to rename it into, and
                deleting it would mean deleting the list. Drawn and refused
                rather than left out — a menu missing an item explains nothing. */}
            <DropdownMenuItem
              disabled={top}
              onSelect={() => area.askRenameFolder(folder)}
            >
              Rename folder
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={top}
              onSelect={() => area.askRemoveFolder(folder)}
            >
              Delete folder
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Every row of the tree: the list, the folders under it, and the archive.
 *
 * The root the engine always answers with is not among them. It is this tree's
 * own top — the row below — and taken for an ordinary folder it became its own
 * parent, because the folder above `""` is `""`; every folder was then hung
 * under a row nothing reaches, and none of them was drawn at all.
 */
function rows(
  folders: readonly MemoryFolder[],
  counts: { readonly live: number; readonly archived: number },
  /** The mark the project's own type names for a routine. */
  mark: LucideIcon,
  commands: {
    readonly createRoutine: (folder: string) => void;
    readonly askNewFolder: (parent: string) => void;
    readonly askRenameFolder: (folder: string) => void;
    readonly askRemoveFolder: (folder: string) => void;
  },
): ReadonlyMap<string, SourceTreeItem> {
  const items = new Map<string, SourceTreeItem>();
  const children = new Map<string, string[]>();
  const top: string[] = [];

  const sorted = [...folders]
    .filter((entry) => entry.path !== "")
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const folder of sorted) {
    const id = folderRow(folder.path);
    const mine: string[] = [];
    children.set(id, mine);
    items.set(id, {
      id,
      label: folderName(folder.path),
      icon: Folder,
      // The routines filed directly in it — not the subtree — so it is the same
      // number as the rows the surface then shows.
      count: folder.records,
      children: mine,
      // Dragged to move it, and dropped on to file something in it.
      drag: { folder: folder.path },
      drop: { folder: folder.path },
      menu: () => folderMenu(folder.path, commands),
    });
  }

  // Placed after every row exists, so a parent is never filled while its
  // siblings are still being read: doing both in one pass put `a/c` above `a/b`.
  for (const folder of sorted) {
    const id = folderRow(folder.path);
    const above = children.get(parentRow(folder.path));
    // A folder whose parent is not in the answer is still drawn, at the top
    // rather than nowhere: one level too high is a visible oddity, and one that
    // has vanished while its routines are counted under it is not.
    if (above === undefined) top.push(id);
    else above.push(id);
  }

  // **The row that stands for no folder at all**, and the one thing that makes
  // filing reversible: every folder takes drops, and without this the gesture
  // worked in one direction only. It is what Records gives each of its types
  // and Tasks gives its register.
  items.set(ALL_ROW, {
    id: ALL_ROW,
    label: "All routines",
    // The kind's own mark, not a folder's: this row is the whole list, and the
    // folders under it are the only folders here.
    icon: mark,
    count: counts.live,
    children: top,
    drop: { folder: "" },
    menu: () => [
      { label: "New Routine", onSelect: () => commands.createRoutine("") },
      { label: "New Folder", onSelect: () => commands.askNewFolder("") },
    ],
  });

  const roots = [ALL_ROW];

  // **Archived routines are a place, not a filter.** They left the lists when
  // somebody archived them — that is what `design-foundation.md` §510 makes
  // archiving mean — and this is where they went, the way an archived message
  // is in a mailbox. Drawn only while it holds something: a standing heading
  // over nothing names a state instead of showing one.
  //
  // A sibling of the list rather than a row inside it, because what is archived
  // is not among *all routines*, and it takes no drops: filing something that
  // is out of play is not a thing to do to it.
  if (counts.archived > 0) {
    items.set(ARCHIVED_ROW, {
      id: ARCHIVED_ROW,
      label: "Archived",
      icon: Archive,
      count: counts.archived,
    });
    roots.push(ARCHIVED_ROW);
  }

  items.set(TREE_ROOT, { id: TREE_ROOT, label: "", children: roots });
  return items;
}

function folderMenu(
  folder: string,
  commands: {
    readonly createRoutine: (folder: string) => void;
    readonly askNewFolder: (parent: string) => void;
    readonly askRenameFolder: (folder: string) => void;
    readonly askRemoveFolder: (folder: string) => void;
  },
): readonly NativeMenuEntry[] {
  return [
    { label: "New Routine", onSelect: () => commands.createRoutine(folder) },
    { label: "New Folder", onSelect: () => commands.askNewFolder(folder) },
    "separator",
    { label: "Rename Folder", onSelect: () => commands.askRenameFolder(folder) },
    { label: "Delete Folder", onSelect: () => commands.askRemoveFolder(folder) },
  ];
}
