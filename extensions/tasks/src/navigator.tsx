"use client";

import { useMemo } from "react";

import { Ellipsis, Folder, ListChecks, ListFilter, Plus } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
  foldersUnder,
  parentFolder,
  type MemoryFolder,
  type SourceTreeItem,
} from "@sync-buzz/extension-api";

import { useArea } from "./context";
import type { TasksFilter } from "./filter";
import { KIND, STATUSES } from "./model";

/**
 * The navigator lists where the work is filed, and never the work itself.
 *
 * That is the change this column exists to make. It used to list the tasks —
 * every one of them, grouped by status, in the narrowest column of the window
 * and the first one to give up its space. A task's title is an instruction with
 * a verb and an object, which is the one thing about it nobody can afford to
 * lose, and in that column it was lost: *Запретить прозу, …* is not a task
 * anybody can act on. The register belongs in the workspace, where the row is
 * as wide as the window and the title is never truncated, and what belongs
 * here is what a source list is for — the places, and how much is in each.
 *
 * So it is one tree: the whole register at the top, the folders under it,
 * exactly as Records draws a type and the folders under that. Grouping is the
 * project's own — an agent files a task where it belongs, and a person drags
 * one to move it — rather than a division this build invented and imposed.
 */
export function TasksNavigator() {
  const area = useArea();

  const rows = useMemo(
    () =>
      treeRows(
        area.folders.byKind.get(KIND) ?? [],
        area.corpus.counts.byKind[KIND] ?? 0,
        {
          onNewTask: area.createTask,
          onNewFolder: area.askNewFolder,
          onRenameFolder: area.askRenameFolder,
          onRemoveFolder: area.askRemoveFolder,
        },
      ),
    [
      area.folders.byKind,
      area.corpus.counts.byKind,
      area.createTask,
      area.askNewFolder,
      area.askRenameFolder,
      area.askRemoveFolder,
    ],
  );

  const folder = "folder" in area.filter ? area.filter.folder : null;

  return (
    <PanelSurface className="bg-panel">
      {/* The header band, at the one height every column in the slab shares, so
          its hairline reads as a single line crossing the window. This column
          names the section and carries no control: what this column lists is
          folders, `+` in the bar below adds one, and a task is written beside
          the list it joins — which is the workspace. */}
      <PanelHeader title="Tasks" />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {area.corpus.error !== null || area.folders.error !== null ? (
            <div className="px-2 pt-1">
              <PanelPlaceholder
                headline="This project's memory could not be read"
                detail={area.corpus.error ?? area.folders.error ?? undefined}
              />
            </div>
          ) : null}

          <SourceTree
            label="Tasks and the folders they are filed in"
            items={rows}
            rootId={TREE_ROOT}
            activeId={activeId(area.filter)}
            expanded={area.expanded}
            onExpandedChange={area.setExpanded}
            onSelect={(id) => area.select(filterOf(id))}
          />
        </div>
      </ScrollArea>

      {/* The bottom bar, where macOS keeps what acts on a source list — Mail,
          Reminders, Xcode's navigator. Everything in it acts on the list and
          nothing in it writes what the list contains: `+` adds a folder, the
          way `+` under a source list adds a mailbox, and the menu beside it
          acts on the folder that is selected. The view preference trails, on
          the edge a view preference goes on. */}
      <PanelFooter>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New folder"
              onClick={() => area.askNewFolder(folder ?? "")}
              className="text-fg-tertiary hover:text-fg"
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {folder === null ? "New folder" : `New folder in ${folderName(folder)}`}
          </TooltipContent>
        </Tooltip>

        <FolderActions
          folder={folder}
          onNewFolder={() => area.askNewFolder(folder ?? "")}
          onRenameFolder={() => folder !== null && area.askRenameFolder(folder)}
          onRemoveFolder={() => folder !== null && area.askRemoveFolder(folder)}
        />

        <div className="min-w-0 flex-1" />

        <StatusFilter />
      </PanelFooter>
    </PanelSurface>
  );
}

/**
 * The commands that act on the selected folder, where a keyboard can reach
 * them.
 *
 * The same three are under the secondary button, drawn by the system. This one
 * is the interface: nothing in this window may be reachable only from a context
 * menu, because a right-click is a shortcut to an interface rather than one.
 * Disabled while the selection is the whole register, which is not a folder and
 * cannot be renamed or deleted.
 */
function FolderActions({
  folder,
  onNewFolder,
  onRenameFolder,
  onRemoveFolder,
}: {
  folder: string | null;
  onNewFolder: () => void;
  onRenameFolder: () => void;
  onRemoveFolder: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={folder === null}
          aria-label={
            folder === null
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
              {folderName(folder)}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={onNewFolder}>New folder</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRenameFolder}>Rename folder</DropdownMenuItem>
            {/* Everything filed under it goes, whatever its type — so this asks
                before it acts, and the sheet is where the number is named. */}
            <DropdownMenuItem variant="destructive" onSelect={onRemoveFolder}>
              Delete folder
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Which statuses the register lists.
 *
 * A view preference over this section's own vocabulary, on this machine rather
 * than in the repository: what somebody is looking at is theirs, and a filter
 * that travelled with the project would hide a colleague's rows because of how
 * this window was left.
 */
function StatusFilter() {
  const area = useArea();
  const shown = STATUSES.length - area.hidden.length;
  const everything = area.hidden.length === 0;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              // Emphasised while it is doing something: a filter that is on and
              // looks off is a list that seems to be missing rows.
              data-active={!everything}
              // The state is in the name, not only in the surface — an
              // icon-only control has to say what it is doing to somebody who
              // cannot see that it is emphasised.
              aria-label={
                everything
                  ? "Statuses listed — all statuses"
                  : `Statuses listed — ${shown} of ${STATUSES.length}`
              }
              className="text-fg-tertiary hover:text-fg data-[active=true]:bg-selected data-[active=true]:text-fg"
            >
              <ListFilter />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {everything
            ? "All statuses are listed"
            : `${shown} of ${STATUSES.length} statuses are listed`}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Statuses listed</DropdownMenuLabel>
        {STATUSES.map((status) => (
          <DropdownMenuCheckboxItem
            key={status.id}
            checked={!area.hidden.includes(status.id)}
            // The menu stays open: hiding two statuses is one decision, not two
            // trips to the same button.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => area.toggleStatus(status.id)}
            className="gap-2"
          >
            <span className="truncate">{status.label}</span>
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={everything} onSelect={area.showAllStatuses}>
          Show all statuses
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The row every other row hangs from. Never drawn, and named so it cannot
 * collide with a folder: a folder path is normalised and cannot start with a
 * slash.
 */
const TREE_ROOT = "/root";

/** The whole register, which is the top of the hierarchy the folders are in. */
export const ALL_ROW = "/all";

/** One folder's row. Exported because the provider expands rows too. */
export const folderRow = (path: string) => `folder/${path}`;

/**
 * The row a folder hangs from: the folder above it, or the register itself when
 * the folder is at the top.
 */
export function parentRow(folder: string): string {
  const parent = parentFolder(folder);
  return parent === "" ? ALL_ROW : folderRow(parent);
}

/** What selecting a row means. The id carries it, so nothing has to look it up. */
function filterOf(id: string): TasksFilter {
  return id === ALL_ROW ? { view: "all" } : { folder: id.slice("folder/".length) };
}

/** Which row the current filter has selected. */
function activeId(filter: TasksFilter): string {
  return "folder" in filter ? folderRow(filter.folder) : ALL_ROW;
}

/**
 * Every row of the tree: the register, and the folders tasks are filed in.
 *
 * The register's own row is the top of the hierarchy, so dropping a task on it
 * files that task in no folder at all — which is the only way back out of one
 * by dragging, and the reason this row exists rather than the tree starting at
 * the folders.
 */
function treeRows(
  folders: readonly MemoryFolder[],
  total: number,
  commands: {
    onNewTask: () => void;
    onNewFolder: (parent: string) => void;
    onRenameFolder: (folder: string) => void;
    onRemoveFolder: (folder: string) => void;
  },
): ReadonlyMap<string, SourceTreeItem> {
  const rows = new Map<string, SourceTreeItem>();
  const children = new Map<string, string[]>();
  const top: string[] = [];

  // Sorted by path, so a folder appears where somebody expects to find it
  // rather than in whatever order the walk returned — and so that a folder is
  // always reached after the one it is inside.
  for (const folder of [...foldersUnder(folders, "")].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    const id = folderRow(folder.path);
    const parent = parentFolder(folder.path);
    const parentId = parent === "" ? null : folderRow(parent);

    const mine: string[] = [];
    children.set(id, mine);
    rows.set(id, {
      id,
      label: folderName(folder.path),
      icon: Folder,
      children: mine,
      // Dragged to move it, and dropped on to move something into it. The
      // payload says which of the two arrived; this row does not care.
      drag: { folder: { kind: KIND, path: folder.path } },
      drop: { folder: folder.path },
      // The tasks filed directly in it, counted by the engine and leaving out
      // the record that *is* the folder — the same number as the rows the
      // workspace will show.
      count: folder.records,
      // A directory nothing is filed in is drawn quieter rather than left out.
      muted: !folder.inRecords,
      tooltip: <span className="font-mono opacity-70">{folder.path}</span>,
      // Title case, because the system draws this one — that is the one
      // convention a native menu keeps.
      menu: () => [
        { label: "New Task", onSelect: commands.onNewTask },
        { label: "New Folder", onSelect: () => commands.onNewFolder(folder.path) },
        "separator",
        { label: "Rename Folder", onSelect: () => commands.onRenameFolder(folder.path) },
        {
          label: "Delete Folder",
          onSelect: () => commands.onRemoveFolder(folder.path),
        },
      ],
    });

    if (parentId === null) {
      top.push(id);
      continue;
    }
    const siblings = children.get(parentId);
    if (siblings) {
      siblings.push(id);
      continue;
    }
    // A folder whose parent is not in the answer is still drawn, at the top
    // rather than nowhere: a folder one level too high is a visible oddity, and
    // a folder that has vanished while its tasks are counted under it is not.
    top.push(id);
  }

  rows.set(ALL_ROW, {
    id: ALL_ROW,
    label: "All tasks",
    icon: ListChecks,
    count: total,
    children: top,
    drop: { folder: "" },
    menu: () => [
      { label: "New Task", onSelect: commands.onNewTask },
      { label: "New Folder", onSelect: () => commands.onNewFolder("") },
    ],
  });

  rows.set(TREE_ROOT, { id: TREE_ROOT, label: "", children: [ALL_ROW] });
  return rows;
}
