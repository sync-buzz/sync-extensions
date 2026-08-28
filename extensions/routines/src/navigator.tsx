"use client";

import { useMemo } from "react";

import { Archive, Ellipsis, Folder, FolderPlus, Plus } from "lucide-react";

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
  type MemoryRecord,
  type NativeMenuEntry,
  type SourceTreeItem,
} from "@sync-buzz/extension-api";

import {
  ARCHIVED,
  ROOT_ROW,
  TREE_ROOT,
  agentOf,
  enabledOf,
  everyLabel,
  everyOf,
  folderRow,
  nameOf,
  parentOf,
  routineRow,
  rowSubject,
} from "./model";
import { useArea } from "./area";

/**
 * The routines this project holds, in the groups somebody put them in.
 *
 * **One tree, not a list with folders bolted above it.** A folder and the
 * routines in it are one hierarchy, so they are one control: a single tab stop,
 * one set of arrow keys, and no seam to fall into between a group and what is
 * in it. It is the same arrangement Records draws over the project's types, and
 * a person moving between the two sections should not be able to say which
 * control they are in.
 *
 * Folders lead and the ungrouped routines follow. A folder is a decision
 * somebody made about this list, and the routines under no folder are what is
 * left of it — putting them first would bury the structure under whatever has
 * not been filed yet.
 *
 * **A row says whether it runs.** That is the change this column most needed:
 * every row was one word and one glyph, so *what is running in this project*
 * could not be answered without opening each of them in turn. The mark carries
 * it — a clock, or a clock struck through — with the quieter tier behind it, so
 * the answer survives the greyscale test on shape alone and the column does not
 * spend colour on it.
 */
export function RoutinesNavigator() {
  const area = useArea();

  const { items, empty } = useMemo(
    () => rows(area),
    // Rebuilt when anything a row draws from moves. The menus close over the
    // area, which is held to one identity while nothing it holds has changed.
    [area],
  );

  return (
    <PanelSurface className="bg-panel">
      {/* The header names the section and carries the one kind of control a
          header may carry: the command that writes into the very thing it is
          naming. This column *is* the list of routines, so `+` writes one
          here — and not in the bottom bar below, where `+` adds a mailbox
          rather than a letter. It was in that bar until now, which is the one
          place macOS never puts it. */}
      <PanelHeader title="Routines">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New routine"
              onClick={() => area.createRoutine(area.folderInView)}
              className="text-fg-tertiary hover:text-fg"
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {area.folderInView === ""
              ? "New routine"
              : `New routine in ${nameOf(area.folderInView)}`}
          </TooltipContent>
        </Tooltip>
      </PanelHeader>

      {/* One scroller for whatever this column has to show, so the tree and the
          silence that replaces it start at the same place — and so the bottom
          bar keeps the line it shares with the sidebar's foot however many
          routines there are. */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {area.corpus.error !== null ? (
            <div className="px-2 pt-1">
              <PanelPlaceholder
                headline="This project's memory could not be read"
                detail={area.corpus.error}
              />
            </div>
          ) : empty && !area.corpus.isLoading ? (
            <div className="px-2 pt-1">
              {/* Two different silences, and which one this is costs a
                  sentence: a project with no routines and a column filtered
                  down to nothing look identical, and only one of them is worth
                  writing a routine about. */}
              <PanelPlaceholder
                headline="No routines yet"
                detail="A routine is one instruction an agent carries out on a clock."
              />
            </div>
          ) : (
            <SourceTree
              label="Routines and their folders"
              items={items}
              rootId={TREE_ROOT}
              activeId={area.selected}
              expanded={area.expanded}
              onSelect={(id) => {
                if (rowSubject(id) !== null) area.select(id);
              }}
              onExpandedChange={area.setExpanded}
            />
          )}
        </div>
      </ScrollArea>

      {/* The bottom bar, where macOS keeps what acts on a source list — Mail,
          Reminders, Xcode's navigator. Everything in it acts on the list
          itself: `+` adds a folder, which is how this list is arranged, and the
          menu beside it carries what can be done to whatever is selected. The
          view preference trails, on the edge a view preference goes on.

          Two `+` in one column is not a duplication. Each sits beside a
          different list and adds to the one it sits beside: the header's writes
          a routine, which is what the column lists, and this one adds a folder,
          which is how the column is organised. */}
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
              : `New folder in ${nameOf(area.folderInView)}`}
          </TooltipContent>
        </Tooltip>

        <SelectionActions />

        <div className="min-w-0 flex-1" />
      </PanelFooter>
    </PanelSurface>
  );
}

/**
 * What can be done to the selected row, where a keyboard can reach it.
 *
 * The same commands are under the secondary button, drawn by the system. This
 * one is the interface: nothing in this window may be reachable only from a
 * menu that opens under the pointer, because such a menu is invisible to
 * anybody not using one. It is the shell's own menu rather than a native one
 * because its neighbours in this bar already are — one bar, one kind of menu.
 */
function SelectionActions() {
  const area = useArea();
  const subject = area.subject;
  const routine =
    subject !== null && "routine" in subject
      ? (area.byKey.get(subject.routine) ?? null)
      : null;
  const folder = subject !== null && "folder" in subject ? subject.folder : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={subject === null}
          aria-label={
            routine
              ? `Actions for ${label(routine)}`
              : folder !== null
                ? `Actions for ${nameOf(folder)}`
                : "Actions for the selected routine"
          }
          className="text-fg-tertiary hover:text-fg aria-expanded:bg-selected aria-expanded:text-fg"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        {routine ? (
          <>
            <DropdownMenuLabel className="truncate">
              {label(routine)}
            </DropdownMenuLabel>
            <DropdownMenuItem
              disabled={area.running}
              onSelect={() => area.runNow(routine.key)}
            >
              Run now
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => area.toggle(routine)}>
              {enabledOf(routine.fields) ? "Switch off" : "Switch on"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={routine.folder === null}
              onSelect={() => area.moveTo(routine.key, "")}
            >
              Move out of folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => area.archive(routine)}>
              {routine.archived ? "Bring back" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => area.askRemoval(routine.key)}
            >
              Delete
            </DropdownMenuItem>
          </>
        ) : folder !== null ? (
          <>
            <DropdownMenuLabel className="truncate">
              {isRoot(folder) ? "All routines" : nameOf(folder)}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => area.createRoutine(folder)}>
              New routine
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => area.askNewFolder(folder)}>
              New folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* The top is a folder everywhere else in this column, and it is
                not one here: there is nothing above it to rename it into and
                deleting it would mean deleting the list. Drawn and refused
                rather than left out — a menu missing an item explains
                nothing. */}
            <DropdownMenuItem
              disabled={isRoot(folder)}
              onSelect={() => area.askRenameFolder(folder)}
            >
              Rename folder
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={isRoot(folder)}
              onSelect={() => area.askRemoveFolder(folder)}
            >
              Delete folder
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** What a routine is listed as. A record with no title is still a record. */
function label(record: MemoryRecord): string {
  return record.title.trim().length > 0 ? record.title : "Untitled routine";
}

/**
 * Every row of the tree: the folders, and the routines under each.
 *
 * The folders come from the engine rather than from the records, which is what
 * makes an empty group survive: a folder somebody made and has not filed
 * anything in yet is a real place, and one derived from the rows in it would
 * vanish the moment it was emptied.
 *
 * A path already says who its parent is, so nothing is walked twice. Sorted, so
 * a row appears where somebody expects to find it rather than in whatever order
 * the store answered in.
 */
function rows(area: ReturnType<typeof useArea>): {
  items: ReadonlyMap<string, SourceTreeItem>;
  empty: boolean;
} {
  const items = new Map<string, SourceTreeItem>();
  const { archived } = area;

  // The routines of each folder, and of no folder. Gathered in one pass: the
  // records arrive flat and each names where it is filed.
  const filed = new Map<string, MemoryRecord[]>();
  for (const record of area.routines) {
    const where = record.folder ?? "";
    const held = filed.get(where);
    if (held === undefined) filed.set(where, [record]);
    else held.push(record);
  }

  // Sorted once, and every pass below reads this order. A path already says who
  // its parent is, so a parent is always reached before its children — which is
  // what lets the tree be built without walking anything twice.
  //
  // **The root is not among them.** Every answer the engine gives carries an
  // entry for `""` — the records filed nowhere — and it is not a folder row:
  // it is this tree's own root, and the routines in it are the ungrouped ones
  // drawn at the end. Taken as an ordinary folder it became its own parent,
  // because the folder above `""` is `""`, and every top-level folder was then
  // hung under a row nothing reaches from the root. Folders were created, were
  // returned by the engine, and were drawn nowhere.
  const sorted = [...area.folders]
    .filter((entry) => entry.path !== "")
    .sort((a, b) => a.path.localeCompare(b.path));
  // The array each folder's row holds, filled after every row exists.
  const kids = new Map<string, string[]>();
  // The folders directly inside each folder, in the order they were read.
  const subs = new Map<string, string[]>();
  const topFolders: string[] = [];

  for (const folder of sorted) {
    const mine: string[] = [];
    kids.set(folder.path, mine);
    subs.set(folder.path, []);
    items.set(folderRow(folder.path), {
      id: folderRow(folder.path),
      label: nameOf(folder.path),
      icon: Folder,
      children: mine,
      // The routines filed directly in it — not what is in the folders below,
      // so it is the same number as the rows that appear when it is opened.
      count: (filed.get(folder.path) ?? []).length,
      // Dragged to move it, and dropped on to file something in it. What a
      // payload means is decided where the drop is handled; this row only says
      // what it is.
      drag: { folder: folder.path },
      drop: { folder: folder.path },
      menu: () => folderMenu(area, folder.path),
    });
  }

  // Where each folder hangs. Appended rather than inserted, which is the whole
  // of why this is a pass of its own: filling a parent's children while its
  // siblings were still being read put them in the reverse of the order they
  // were sorted into, so `a/c` was drawn above `a/b`.
  for (const folder of sorted) {
    const above = subs.get(parentOf(folder.path));
    // A folder whose parent is missing from the answer is drawn at the top
    // rather than dropped: a row nobody can reach is worse than one indented
    // less than it should be.
    if (above === undefined) topFolders.push(folderRow(folder.path));
    else above.push(folderRow(folder.path));
  }

  // What is in each folder: the folders under it, then the routines in it. A
  // place before the things in it, which is the order Finder reads in.
  for (const folder of sorted) {
    const mine = kids.get(folder.path);
    const under = subs.get(folder.path);
    if (mine === undefined || under === undefined) continue;
    mine.push(...under);
    for (const record of [...(filed.get(folder.path) ?? [])].sort(byName)) {
      items.set(routineRow(record.key), routineItem(area, record));
      mine.push(routineRow(record.key));
    }
  }

  // The ungrouped, after the groups: a folder is a decision somebody made about
  // this list, and what has not been filed is what is left of it.
  const loose: string[] = [];
  for (const record of [...(filed.get("") ?? [])].sort(byName)) {
    items.set(routineRow(record.key), routineItem(area, record));
    loose.push(routineRow(record.key));
  }

  // **The row that stands for no folder at all.**
  //
  // It carries the drop that takes a routine back out of a group, which is the
  // gesture this column was missing: folders took drops and nothing stood for
  // the top, so a routine dragged into a group could only be got out again
  // through a menu. It is also where a new routine or folder goes when nothing
  // else is selected, and it is what the folders hang from.
  items.set(ROOT_ROW, {
    id: ROOT_ROW,
    label: "All routines",
    icon: area.kindIcon,
    count: area.routines.length,
    children: [...topFolders, ...loose],
    drop: { folder: "" },
    menu: () => [
      { label: "New Routine", onSelect: () => area.createRoutine("") },
      { label: "New Folder", onSelect: () => area.askNewFolder("") },
    ],
  });

  const top = [ROOT_ROW];

  // **Archived routines are a place, not a filter.** They left the lists when
  // somebody archived them — that is what `design-foundation.md` §510 makes
  // archiving mean — and this is where they went, the way an archived message
  // is in a mailbox rather than behind a preference over the inbox. Behind a
  // toggle they came back into the live list as rows nothing told apart, which
  // is the complaint that put this here.
  //
  // Last, and drawn only while it holds something: a standing heading over
  // nothing names a state instead of showing one. It carries no folders — what
  // is archived is out of play, and where it used to be filed is a fact about
  // when it comes back rather than something to navigate.
  if (archived.length > 0) {
    for (const record of [...archived].sort(byName)) {
      items.set(routineRow(record.key), routineItem(area, record));
    }
    items.set(ARCHIVED, {
      id: ARCHIVED,
      label: "Archived",
      icon: Archive,
      count: archived.length,
      children: [...archived].sort(byName).map((record) => routineRow(record.key)),
    });
    top.push(ARCHIVED);
  }

  items.set(TREE_ROOT, { id: TREE_ROOT, label: "Routines", children: top });
  // Empty is about what the project holds, not about how many rows this built:
  // the row that stands for the top is always one of them.
  return { items, empty: area.routines.length === 0 && archived.length === 0 };
}

/** One routine, as a row: what it is called, and whether it runs. */
function routineItem(
  area: ReturnType<typeof useArea>,
  record: MemoryRecord,
): SourceTreeItem {
  const on = enabledOf(record.fields);
  const every = everyOf(record.fields);

  return {
    id: routineRow(record.key),
    label: label(record),
    // **The kind's own glyph, always.** `design-foundation.md` §284 divides
    // these: a kind is a glyph and a state is a mark of its own, and one thing
    // saying both is what this row did — a clock struck through, which reads as
    // *this alarm is silenced* rather than *this automation is not running*,
    // and which quietly claimed a routine was a different kind of thing when
    // somebody switched it off. The type names its mark; this draws it.
    icon: area.kindIcon,
    // Dimmed while it is not running, which is the one thing this row still
    // says about state and the one device on this system that says it — the
    // same reading Finder gives a file that is there and not in play. It means
    // exactly one thing now: the archived are not in this list at all.
    muted: !on,
    tooltip: (
      <span>
        {on ? `Runs ${everyLabel(every)}` : `Off — would run ${everyLabel(every)}`}
        {" · "}
        {area.agentName(agentOf(record.fields))}
        {record.archived ? " · archived" : null}
      </span>
    ),
    // Filed by dragging, and only while it is in play. An archived routine
    // dragged onto a folder would move and stay exactly where it is drawn —
    // under `Archived`, which is not a folder — so the gesture would look like
    // it had failed. Bringing it back is what comes first, and the menu says so.
    drag: record.archived ? undefined : { record: record.key },
    menu: () => routineMenu(area, record),
  };
}

/**
 * What the secondary button offers on a routine.
 *
 * Everything here is reachable without it — the bar below carries the same
 * commands, and opening a routine is what a click already does — because a menu
 * under the pointer is invisible to the keyboard. Title case, because the
 * system draws this one and that is the one convention a native menu keeps.
 *
 * `Run Now` leads: it is the command somebody came to this row for, and until
 * now it could only be reached by opening the routine first.
 */
function routineMenu(
  area: ReturnType<typeof useArea>,
  record: MemoryRecord,
): readonly NativeMenuEntry[] {
  return [
    {
      label: "Run Now",
      enabled: !area.running,
      onSelect: () => area.runNow(record.key),
    },
    {
      label: enabledOf(record.fields) ? "Switch Off" : "Switch On",
      onSelect: () => area.toggle(record),
    },
    "separator",
    {
      label: "Move Out of Folder",
      enabled: record.folder !== null,
      onSelect: () => area.moveTo(record.key, ""),
    },
    "separator",
    {
      label: record.archived ? "Bring Back" : "Archive",
      onSelect: () => area.archive(record),
    },
    {
      label: "Delete",
      onSelect: () => area.askRemoval(record.key),
    },
  ];
}

/** What the secondary button offers on a folder. */
function folderMenu(
  area: ReturnType<typeof useArea>,
  folder: string,
): readonly NativeMenuEntry[] {
  return [
    { label: "New Routine", onSelect: () => area.createRoutine(folder) },
    { label: "New Folder", onSelect: () => area.askNewFolder(folder) },
    "separator",
    { label: "Rename Folder", onSelect: () => area.askRenameFolder(folder) },
    { label: "Delete Folder", onSelect: () => area.askRemoveFolder(folder) },
  ];
}

/** Whether a folder is the top, which two of the four commands may not touch. */
const isRoot = (folder: string) => folder === "";

/**
 * The order routines are read in: by name, and by key for the ones with none.
 *
 * Not by whether they run. A list that reordered itself when somebody flicked a
 * switch would move the row out from under the pointer that flicked it.
 */
function byName(a: MemoryRecord, b: MemoryRecord): number {
  return label(a).localeCompare(label(b)) || a.key.localeCompare(b.key);
}
