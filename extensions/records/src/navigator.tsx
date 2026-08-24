"use client";

import { useMemo } from "react";
import {
  CircleAlert,
  Ellipsis,
  Folder,
  FolderOpen,
  Layers,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { TypeFilter } from "@sync-buzz/extension-api";
import { kindIcon } from "@sync-buzz/extension-api";
import {
  PanelFooter,
  PanelHeader,
  PanelPlaceholder,
  PanelSurface,
} from "@sync-buzz/extension-api";

import { Button } from "@sync-buzz/extension-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sync-buzz/extension-api";
import { ScrollArea } from "@sync-buzz/extension-api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@sync-buzz/extension-api";
import { isAttachedType, type MemoryType } from "@sync-buzz/extension-api";
import {
  SourceTree,
  foldersUnder,
  folderName,
  parentFolder,
  type MemoryFolder,
  type SourceTreeItem,
} from "@sync-buzz/extension-api";
import { ATTENTION_STATES, type Corpus } from "@sync-buzz/extension-api";
import type { RecordsFilter } from "./filter";
import {
  showNativeContextMenu,
  type NativeMenuEntry,
} from "@sync-buzz/extension-api";
import type { ProjectViewState } from "@sync-buzz/extension-api";

/** Each type's folders, by kind. See `useFolders`. */
type FoldersByKind = ReadonlyMap<string, readonly MemoryFolder[]>;

/**
 * The navigator lists what belongs to the selected section.
 *
 * For Records that means the types themselves: one store, many kinds, so
 * the kinds are how you navigate it. They are the project's own types, read
 * from its memory rather than declared here — a project whose corpus was
 * written by another version of Sync holds a different list, and this column is
 * where that has to be visible.
 *
 * "Needs attention" sits above them because a claim that stopped matching the
 * code is the one thing worth interrupting for, and it is a view no
 * documents-only tool can build.
 *
 * A type can be named, redefined and removed from here, because this is where
 * the project's types are. Naming one belongs to the column and lives in its
 * bottom bar; the other two belong to a type, so they are offered twice — under
 * the pointer's secondary button, where the system draws the menu itself, and
 * in that same bar, where the keyboard can reach them. A right-click is not an
 * interface; it is a shortcut to one.
 *
 * **A record is not made from this bar.** The bottom bar of a source list is
 * where macOS keeps what acts on the list itself — a mailbox in Mail, a folder
 * in Notes, a list in Reminders — and never what the list contains. Writing a
 * record belongs to the surface that lists records: it is in File under `⌘N`
 * and beside the workspace's own title, and it is offered here only on the row
 * of the kind it would be written as, which is a shortcut to the same thing
 * rather than its home.
 */
export function ContextNavigator({
  title,
  corpus,
  folders,
  filter,
  view,
  expanded,
  onExpandedChange,
  onSelect,
  onNewFolder,
  onRenameFolder,
  onRemoveFolder,
  onNewType,
  onEditType,
  onRemoveType,
  onCreateRecord,
}: {
  /**
   * What the column is called. The area names itself rather than reading it
   * from the window's list of areas: the label belongs to whoever draws the
   * column, and asking the shell for it would be an extension depending on
   * being registered in order to render.
   */
  title: string;
  corpus: Corpus;
  /**
   * The project's folders, read live. Handed in rather than read here: this
   * column is drawn and thrown away as the window's panels come and go, and a
   * read that went with it would walk the working tree every time somebody
   * collapsed the navigator.
   */
  folders: FoldersByKind;
  filter: RecordsFilter;
  view: ProjectViewState;
  /**
   * Which rows are open, and how to say one changed. The area holds it, because
   * it outlives this column: collapsing a folder and coming back to Records
   * should find it collapsed.
   */
  expanded: readonly string[];
  onExpandedChange: (expanded: readonly string[]) => void;
  onSelect: (filter: RecordsFilter) => void;
  /** Make a folder inside `parent`, under the type named by `kind`. */
  onNewFolder: (kind: string, parent: string) => void;
  /** Ask for a new name for one folder. */
  onRenameFolder: (kind: string, folder: string) => void;
  /** Ask to delete one folder, and everything filed under it. */
  onRemoveFolder: (folder: string) => void;
  /**
   * The three commands that act on the project's types. The sheets they open
   * are the window's — this column can be collapsed out of the window, and a
   * sheet that went with it would be a modal owned by something that is not on
   * screen — so the column asks for them rather than holding them.
   */
  onNewType: () => void;
  onEditType: (type: MemoryType) => void;
  onRemoveType: (type: MemoryType) => void;
  /**
   * Create a record of one kind and open it. It belongs to whoever owns the
   * selection: the new record is what the workspace shows next.
   */
  onCreateRecord: (kind: string) => void;
}) {
  const selected =
    "kind" in filter
      ? corpus.types.find((type) => type.kind === filter.kind)
      : undefined;
  const selectedFolder =
    "kind" in filter && filter.folder !== undefined ? filter.folder : null;

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title={title} />
      <KindList
        corpus={corpus}
        folders={folders}
        filter={filter}
        view={view}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        onSelect={onSelect}
        onCreateRecord={onCreateRecord}
        onNewFolder={onNewFolder}
        onRenameFolder={onRenameFolder}
        onRemoveFolder={onRemoveFolder}
        onEdit={onEditType}
        onRemove={onRemoveType}
      />

      {/* The bottom bar: where macOS keeps the controls that act on a source
          list, and the one part of this column that does not scroll away with
          the list they act on. The two that change the project lead; the one
          that only changes what this window shows trails.

          Everything in it is about the types themselves, because the types are
          what this column lists. `+` adds one, exactly as `+` under a source
          list adds a mailbox or a folder, and the menu beside it acts on the
          one selected. */}
      <PanelFooter>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New type"
              onClick={onNewType}
              className="text-fg-tertiary hover:text-fg"
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New type</TooltipContent>
        </Tooltip>

        <TypeActions
          type={selected}
          folder={selectedFolder}
          onNewFolder={() =>
            selected && onNewFolder(selected.kind, selectedFolder ?? rootOf(selected))
          }
          onRenameFolder={() =>
            selected && selectedFolder && onRenameFolder(selected.kind, selectedFolder)
          }
          onRemoveFolder={() => selectedFolder && onRemoveFolder(selectedFolder)}
          onEdit={() => selected && onEditType(selected)}
          onRemove={() => selected && onRemoveType(selected)}
        />

        <div className="min-w-0 flex-1" />

        <TypeFilter
          types={corpus.types}
          counts={corpus.counts.byKind}
          view={view}
        />
      </PanelFooter>
    </PanelSurface>
  );
}

/**
 * The two commands that act on the type the column is listing, where a keyboard
 * can reach them.
 *
 * The same two are under the secondary button, drawn by the system. This one is
 * the interface: a control in the bar that acts on the source list, disabled
 * while the selection is not a type, the way a native application's bottom bar
 * behaves. It is a menu of the shell's own rather than a native one because its
 * neighbour in this bar already is — one bar, one kind of menu.
 */
function TypeActions({
  type,
  folder,
  onNewFolder,
  onRenameFolder,
  onRemoveFolder,
  onEdit,
  onRemove,
}: {
  type: MemoryType | undefined;
  /**
   * The folder the selection is on, when it is on one.
   *
   * The folder commands are here as well as under the secondary button, because
   * nothing in this window may be reachable only from a context menu. A
   * right-click is a shortcut to an interface; this bar is the interface.
   */
  folder: string | null;
  onNewFolder: () => void;
  onRenameFolder: () => void;
  onRemoveFolder: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={type === undefined}
          aria-label={
            type ? `Actions for ${type.title}` : "Actions for the selected type"
          }
          className="text-fg-tertiary hover:text-fg aria-expanded:bg-selected aria-expanded:text-fg"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        {type ? (
          <>
            <DropdownMenuLabel className="truncate">
              {folder ?? type.title}
            </DropdownMenuLabel>
            {/* A folder inside the selected one, or at the top of the type
                when the selection is the type itself — the same rule the row's
                own menu follows, because it is the same command. */}
            <DropdownMenuItem
              disabled={type.own || !type.writable}
              onSelect={onNewFolder}
            >
              New folder
            </DropdownMenuItem>
            {folder ? (
              <>
                <DropdownMenuItem
                  disabled={!type.writable}
                  onSelect={onRenameFolder}
                >
                  Rename folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!type.writable}
                  onSelect={onRemoveFolder}
                >
                  Delete folder
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            {/* No ellipsis on a command, here or anywhere: the owner's
                decision. The convention distinguishes a command that asks for
                something from one that just happens, and this window would be
                spending punctuation on a distinction its sheets already make
                by opening. */}
            <DropdownMenuItem disabled={type.own} onSelect={onEdit}>
              Edit type
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Named for what it does to the project. A type over a folder is
                detached: what goes is the records and the attachment, and the
                team's files stay. One word for both would promise the wrong
                one of the two. */}
            <DropdownMenuItem
              variant="destructive"
              disabled={type.own}
              onSelect={onRemove}
            >
              {isAttachedType(type) ? "Detach folder" : "Delete type"}
            </DropdownMenuItem>
            {/* A disabled pair with no reason beside it is a window refusing
                without saying why. */}
            {type.own ? (
              <DropdownMenuLabel className="font-normal text-wrap text-fg-tertiary">
                Sync&rsquo;s own type. It is republished whenever a project
                lacks it, and the record naming the project has its kind.
              </DropdownMenuLabel>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The row every other row hangs from. Never drawn, and named so it cannot
 * collide with a kind: a kind is an identifier and cannot hold a slash.
 */
const TREE_ROOT = "/root";

/**
 * A type's row, and a folder's row under it.
 *
 * Exported because the area expands rows too — a folder just made is opened,
 * and a folder renamed carries its open branches to the new path — and an id
 * spelled in two places is two spellings that drift. They did: the area
 * compared a bare path against these, which never matches, and built a folder
 * row's id for a parent that was the type itself.
 */
export const typeRow = (kind: string) => `kind/${kind}`;
export const folderRow = (kind: string, path: string) =>
  `folder/${kind}/${path}`;

/**
 * The row a folder hangs from: the folder above it, or the type when that
 * folder is where the type's hierarchy starts.
 *
 * `root` is the type's own starting point — its directory, or `""` for a type
 * whose documents are its records — and a folder directly inside it is drawn
 * under the type's row rather than under a row for the root itself, because
 * there is no such row.
 */
export function parentRow(kind: string, folder: string, root: string): string {
  const parent = parentFolder(folder);
  return parent === root ? typeRow(kind) : folderRow(kind, parent);
}

/**
 * What selecting a row means.
 *
 * The id carries it rather than a parallel lookup: a row is selected by id, and
 * a second structure translating ids back to filters is a second place for the
 * two to disagree.
 */
function filterOf(id: string): RecordsFilter {
  const folder = id.match(/^folder\/([^/]+)\/(.*)$/);
  if (folder) return { kind: folder[1], folder: folder[2] };
  return { kind: id.slice("kind/".length) };
}

/** Which row the current filter has selected, if it is one of these. */
function activeId(filter: RecordsFilter): string | null {
  if (!("kind" in filter)) return null;
  return filter.folder === undefined
    ? typeRow(filter.kind)
    : folderRow(filter.kind, filter.folder);
}

function KindList({
  corpus,
  folders,
  filter,
  view,
  expanded,
  onExpandedChange,
  onSelect,
  onCreateRecord,
  onNewFolder,
  onRenameFolder,
  onRemoveFolder,
  onEdit,
  onRemove,
}: {
  corpus: Corpus;
  folders: FoldersByKind;
  filter: RecordsFilter;
  view: ProjectViewState;
  expanded: readonly string[];
  onExpandedChange: (expanded: readonly string[]) => void;
  onSelect: (filter: RecordsFilter) => void;
  onCreateRecord: (kind: string) => void;
  onNewFolder: (kind: string, parent: string) => void;
  onRenameFolder: (kind: string, folder: string) => void;
  onRemoveFolder: (folder: string) => void;
  onEdit: (type: MemoryType) => void;
  onRemove: (type: MemoryType) => void;
}) {
  const { counts } = corpus;
  // The types this window lists. A hidden one is gone from here, from the
  // counts above and from "All claims" — one decision, one effect.
  //
  // Held to one identity while the answer holds: the rows below are built from
  // this, and a fresh array each render is a fresh tree each render.
  const types = useMemo(
    () => corpus.types.filter((type) => !view.isHidden(type.kind)),
    [corpus.types, view],
  );
  // What that view holds: claims the code moved under, and files a scan could
  // not attribute. Counted together because they are one question to a person —
  // what in this project is waiting on me — and because a file waiting on
  // somebody has no record, so nothing else in this column would ever show it.
  const attention =
    ATTENTION_STATES.reduce(
      (total, state) => total + (counts.byFreshness[state] ?? 0),
      0,
    ) + corpus.unmatched.length;

  const rows = useMemo(
    () =>
      treeRows({
        types,
        folders,
        counts,
        onCreateRecord,
        onNewFolder,
        onRenameFolder,
        onRemoveFolder,
        onEdit,
        onRemove,
      }),
    [
      types,
      folders,
      counts,
      onCreateRecord,
      onNewFolder,
      onRenameFolder,
      onRemoveFolder,
      onEdit,
      onRemove,
    ],
  );

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-0.5 p-2">
        <NavigatorRow
          label="All claims"
          icon={Layers}
          count={counts.total}
          isActive={isView(filter, "all")}
          onSelect={() => onSelect({ view: "all" })}
        />
        <NavigatorRow
          label="Needs attention"
          icon={CircleAlert}
          count={attention}
          emphasised={attention > 0}
          isActive={isView(filter, "attention")}
          onSelect={() => onSelect({ view: "attention" })}
        />

        <p className="px-2 pt-4 pb-1 text-xs font-semibold text-fg-tertiary">
          Types
        </p>

        {/* One tree, not a list of rows with trees hanging off them. The types
            and the folders under them are one hierarchy, so they are one
            control: a single tab stop, one set of arrow keys, and no seam a
            person can fall into between a type and its own directories. */}
        <SourceTree
          label="Types and folders"
          items={rows}
          rootId={TREE_ROOT}
          activeId={activeId(filter)}
          expanded={expanded}
          onExpandedChange={onExpandedChange}
          onSelect={(id) => onSelect(filterOf(id))}
        />

        {types.length === 0 ? (
          <div className="px-2 pt-1">
            <PanelPlaceholder {...noTypes(corpus)} />
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}

function isView(filter: RecordsFilter, view: "all" | "attention") {
  return "view" in filter && filter.view === view;
}

/**
 * Every row of the tree: the types, and the directories under the ones that
 * have any.
 *
 * Both storages, and the same rows either way. A type over a directory shows
 * the directories under it, empty ones included, because a person sees those in
 * Finder. A type whose documents are its own records shows the folders its
 * records are filed in — no directory exists, and none has to: a folder there
 * is a name, and it is real while something is filed in it or while the record
 * that *is* it says so.
 *
 * Which folders belong to which type is the engine's answer rather than a guess
 * made here: folders are a namespace the whole project shares, and a decision
 * filed in `docs/guides` next to the documents sits there quite happily.
 */
function treeRows({
  types,
  folders,
  counts,
  onCreateRecord,
  onNewFolder,
  onRenameFolder,
  onRemoveFolder,
  onEdit,
  onRemove,
}: {
  types: readonly MemoryType[];
  folders: FoldersByKind;
  counts: Corpus["counts"];
  onCreateRecord: (kind: string) => void;
  onNewFolder: (kind: string, parent: string) => void;
  onRenameFolder: (kind: string, folder: string) => void;
  onRemoveFolder: (folder: string) => void;
  onEdit: (type: MemoryType) => void;
  onRemove: (type: MemoryType) => void;
}): ReadonlyMap<string, SourceTreeItem> {
  const rows = new Map<string, SourceTreeItem>();

  for (const type of types) {
    // Where this type's hierarchy starts. A type over a directory starts at
    // that directory; a type whose documents are its own records starts at the
    // project root, because there is no directory and its folders are simply
    // the ones its records are filed in.
    const root = storageOf(type) ?? "";
    const children = folderChildren(
      rows,
      type,
      folders.get(type.kind) ?? [],
      root,
      onNewFolder,
      onRenameFolder,
      onRemoveFolder,
    );

    rows.set(typeRow(type.kind), {
      id: typeRow(type.kind),
      label: type.title,
      icon: kindIcon(type.icon),
      count: counts.byKind[type.kind] ?? 0,
      children,
      // The type's own row is the top of its hierarchy, so dropping on it files
      // something at the root — out of whatever folder it was in, which is the
      // only way back out by dragging.
      drop:
        !type.own && type.writable
          ? { kind: type.kind, folder: root }
          : undefined,
      // Writing a record leads, because this is the one place in the window
      // where the kind is named by the thing under the pointer. It is a
      // shortcut rather than the command's home: the same write is in File
      // under `⌘N` and beside the list in the workspace.
      //
      // Sync's own type is listed with all three commands and offered none: it
      // is republished whenever a project lacks it, the record naming the
      // project has its kind, and there is exactly one of that record. A menu
      // that left them out would read as a row nothing can be done to, rather
      // than one this window may not act on. Title case, because the system
      // draws this one — that is the one convention a native menu keeps.
      menu: () => [
        {
          // Offered only where a document can actually be written. A type over
          // a folder is as writable as the folder — read-only, or not checked
          // out here at all — and the engine answers that before anything is
          // attempted, so the command is disabled rather than failing after
          // somebody chose it.
          label: `New ${type.title}`,
          enabled: !type.own && type.writable,
          onSelect: () => onCreateRecord(type.kind),
        },
        {
          // Under the type, a new folder is made at its root — which is the
          // directory for a type over one, and no folder at all for a type
          // whose documents are its records. The engine decides which; nothing
          // here branches on it.
          label: "New Folder",
          enabled: !type.own && type.writable,
          onSelect: () => onNewFolder(type.kind, root),
        },
        "separator",
        {
          label: "Edit Type",
          enabled: !type.own,
          onSelect: () => onEdit(type),
        },
        "separator",
        {
          // The word is the operation's, not the menu's: a type over a folder
          // is detached, and its documents are not the window's to delete.
          label: isAttachedType(type) ? "Detach Folder" : "Delete Type",
          enabled: !type.own,
          onSelect: () => onRemove(type),
        },
      ],
      tooltip: typeTooltip(type, storageOf(type)),
    });
  }

  rows.set(TREE_ROOT, {
    id: TREE_ROOT,
    label: "",
    children: types.map((type) => typeRow(type.kind)),
  });

  return rows;
}

/**
 * A type's folders, written into `rows` and answered with the ids of the ones
 * directly below its root.
 *
 * The whole subtree in one pass: every folder is a row, and each is added to
 * its parent's children. A path already says who its parent is, so nothing has
 * to be walked twice.
 *
 * Sorted by path, so a folder appears where somebody expects to find it rather
 * than in whatever order the walk of a directory returned.
 */
function folderChildren(
  rows: Map<string, SourceTreeItem>,
  type: MemoryType,
  folders: readonly MemoryFolder[],
  root: string,
  onNewFolder: (kind: string, parent: string) => void,
  onRenameFolder: (kind: string, folder: string) => void,
  onRemoveFolder: (folder: string) => void,
): string[] {
  const under = foldersUnder(folders, root);
  const children = new Map<string, string[]>();
  // The ones drawn directly under the type, gathered as the walk goes rather
  // than by filtering `under` a second time: a folder whose parent is missing
  // from the answer is one of these too, and a second pass over paths could
  // not know that.
  const top: string[] = [];

  for (const folder of [...under].sort((a, b) => a.path.localeCompare(b.path))) {
    const id = folderRow(type.kind, folder.path);
    const parent = parentFolder(folder.path);
    const parentId = parent === root ? null : folderRow(type.kind, parent);

    // Its own children are filled in by the folders below it, which sorting
    // guarantees are reached after it.
    const mine: string[] = [];
    children.set(id, mine);
    rows.set(id, {
      id,
      label: folderName(folder.path),
      icon: Folder,
      children: mine,
      // Dragged to move it, and dropped on to move something into it. The
      // payload says which of the two arrived; this row does not care, and the
      // tree that carries it cares even less.
      drag: { folder: { kind: type.kind, path: folder.path } },
      drop: type.writable
        ? { kind: type.kind, folder: folder.path }
        : undefined,
      // The documents of *this type* filed directly in it, which is what the
      // row opens. The engine counts per type now, and it leaves out the record
      // that is the folder, so this is the same number as the rows the
      // workspace will show — the arithmetic a person can follow.
      count: folder.records,
      // A directory nothing is filed in is drawn quieter rather than left out:
      // it is on disk, a person sees it in Finder, and it is somewhere they can
      // file into. Leaving it out would make Sync disagree with the file tree
      // beside it.
      muted: !folder.inRecords,
      tooltip: folderTooltip(folder),
      // A folder is a name until somebody gives it something to say, and this
      // is where they say it. What it opens is an ordinary document of this
      // type — indexed, searched and linked to like any other — so the wording
      // is about the folder rather than about a record: what a person wants is
      // to write about this folder, and that the answer is a document is the
      // implementation being honest rather than the command being about it.
      // Just "New Folder". That it was asked for on a folder is what says
      // where it goes — a menu opened on a row is already about that row, and
      // spelling out "inside" is the window explaining its own mechanics.
      menu: () => [
        {
          label: "New Folder",
          enabled: type.writable,
          onSelect: () => onNewFolder(type.kind, folder.path),
        },
        "separator",
        {
          label: "Rename Folder",
          enabled: type.writable,
          onSelect: () => onRenameFolder(type.kind, folder.path),
        },
        "separator",
        {
          // Everything filed under it goes, whatever its type — so this asks
          // before it acts, and the sheet is where the number is named.
          label: "Delete Folder",
          enabled: type.writable,
          onSelect: () => onRemoveFolder(folder.path),
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
    // **A folder whose parent is not in the answer is still drawn**, at the top
    // of its type rather than nowhere. The engine names every folder on the way
    // down, so this should not happen — but the alternative if it ever does is
    // a row written into the tree and reachable from nothing, which is a folder
    // that has vanished while its records are still counted under it. A folder
    // one level too high is a visible oddity; a folder that is gone is not.
    top.push(id);
  }

  return top;
}

/**
 * Two facts, stacked, and either alone is the whole tooltip: a type the project
 * described without attaching a folder shows one line, and one attached without
 * a description shows the other.
 */
function typeTooltip(type: MemoryType, storage: string | null) {
  if (!type.description && storage === null) return undefined;
  return (
    <>
      {type.description ? <span>{type.description}</span> : null}
      {/* Muted against the tooltip's own surface rather than with the window's
          tertiary token: this background is inverted, and a foreground colour
          picked for the panel would be unreadable on it. */}
      {storage ? <span className="font-mono opacity-70">{storage}</span> : null}
    </>
  );
}

/**
 * A folder says where it is and, when that is the news, that the project keeps
 * nothing in it yet.
 *
 * The path because the row shows one segment, and a person deciding where to
 * file something needs the rest of it. The second line only when it is true:
 * saying "3 documents" on every row would be repeating what the rows below
 * already show.
 */
function folderTooltip(folder: MemoryFolder) {
  return (
    <>
      <span className="font-mono opacity-70">{folder.path}</span>
      {folder.inRecords ? null : (
        <span>A directory of the repository with nothing filed in it yet.</span>
      )}
    </>
  );
}

/**
 * Where a type's documents are, for a row that only says so when it is worth
 * saying.
 *
 * `null` for a type whose documents are its own records, which is what a type
 * is unless somebody attached a folder to it. The folder otherwise: the path is
 * in the type definition, so a type that is attached is always locatable.
 */
function storageOf(type: MemoryType): string | null {
  return type.storage.folder ?? null;
}

/**
 * Where a type's hierarchy starts: its directory, or the project's root for a
 * type whose documents are its own records.
 */
function rootOf(type: MemoryType): string {
  return storageOf(type) ?? "";
}

/**
 * Three different silences, said differently: the store could not be asked,
 * the answer has not arrived, or every type it holds is one this window was
 * told not to list.
 */
function noTypes(corpus: Corpus): { headline: string; detail?: string } {
  if (corpus.error) {
    return {
      headline: "The project's types could not be read.",
      detail: corpus.error,
    };
  }
  if (corpus.types.length > 0) {
    return {
      headline: "Every type is hidden.",
      detail: "Bring them back from the filter in the header.",
    };
  }
  return { headline: "Reading the project's types…" };
}

function NavigatorRow({
  label,
  description,
  storage,
  icon,
  count,
  isActive,
  emphasised,
  onSelect,
  menu,
}: {
  label: string;
  /**
   * What the row is for, when the row is a type the store described. It is the
   * whole of what the tooltip says: the identifier records of this type carry
   * belongs where somebody is working with it — the type sheet and the removal
   * sheet — not under the pointer of somebody reading down a list.
   */
  description?: string;
  /**
   * The folder this type's documents are files in, or `null` when they are its
   * own records.
   *
   * Only the folder is drawn, because only the folder is news: it means the
   * documents are in the working tree, in diffs, in review, and open in
   * somebody else's editor while Sync shows them. The mark is a glyph rather
   * than the path — a source list row is one line, and a path is longer than
   * the name it would be crowding — and the path is under the pointer, where
   * somebody who wants it is already looking for what the type is.
   */
  storage?: string | null;
  icon: LucideIcon;
  count: number;
  isActive: boolean;
  emphasised?: boolean;
  onSelect: () => void;
  /**
   * What the secondary button opens, for a row there is something to do to.
   * Built when it is asked for: the commands act on the row as it stands then.
   */
  menu?: () => readonly NativeMenuEntry[];
}) {
  // The trigger has to be the button itself rather than a wrapper around it:
  // the row is what a person points at, and a tooltip anchored to anything else
  // would describe a type while pointing at the gap beside it.
  const Icon = icon;
  const row = (
    <button
      type="button"
      data-active={isActive}
      aria-current={isActive ? "true" : undefined}
      onClick={onSelect}
      onContextMenu={(event) => {
        const entries = menu?.();
        if (!entries) return;
        // The row keeps the event only if a native menu is going to answer for
        // it; where there is none — a browser during development — the system's
        // own menu is left alone rather than suppressed for nothing. Opening a
        // menu on a row selects it: a command that quietly applied to something
        // else on screen is the one thing a context menu must never do.
        if (showNativeContextMenu(event, entries)) onSelect();
      }}
      className="flex h-(--control-height-lg) w-full items-center gap-2.5 rounded-(--radius-control) px-2 text-left text-base text-fg-secondary transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover hover:text-fg data-[active=true]:bg-selected data-[active=true]:font-medium data-[active=true]:text-fg"
    >
      <Icon
        aria-hidden="true"
        className={
          emphasised
            ? "size-3.5 shrink-0 text-warning"
            : "size-3.5 shrink-0 text-fg-tertiary"
        }
      />
      {/* A type says what it is called; nothing here re-cases it. The name is
          the project's own words, and a window that capitalised them would be
          disagreeing with the person who typed them. */}
      <span className="truncate">{label}</span>
      {/* The one thing a row says beyond its name and its count, and it says it
          only when it is true. Tertiary and 12px: a mark that qualifies the row
          rather than a second subject competing with the type's own icon. */}
      {storage ? (
        <>
          <FolderOpen aria-hidden="true" className="size-3 shrink-0 text-fg-tertiary" />
          {/* The glyph is a picture to everyone but a screen reader, which is
              read the fact instead. */}
          <span className="sr-only">, in {storage}</span>
        </>
      ) : null}
      <span
        className={
          emphasised
            ? "ml-auto shrink-0 font-mono text-xs font-medium text-warning tabular-nums"
            : "ml-auto shrink-0 font-mono text-xs text-fg-tertiary tabular-nums"
        }
      >
        {count}
      </span>
    </button>
  );

  if (!description && !storage) return row;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      {/* Two facts, stacked, and either one alone is the whole tooltip: a type
          the project described without attaching a folder shows one line, and
          one attached without a description shows the other. */}
      <TooltipContent
        side="right"
        className="max-w-[40ch] flex-col items-start gap-1"
      >
        {description ? <span>{description}</span> : null}
        {storage ? (
          // Muted against the tooltip's own surface rather than with the
          // window's tertiary token: this background is inverted, and a
          // foreground colour picked for the panel would be unreadable on it.
          <span className="font-mono opacity-70">{storage}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
