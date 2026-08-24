"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { ContextInspector } from "@sync/extension-api";
import { ContextNavigator, folderRow, parentRow } from "./navigator";
import { DocumentView } from "@sync/extension-api";
import { RecordRemovalSheet } from "@sync/extension-api";
import { TypeRemovalSheet } from "@sync/extension-api";
import { TypeSheet } from "@sync/extension-api";
import { Workspace, viewName } from "./workspace";
import { Button } from "@sync/extension-api";
import { useAppMenu } from "@sync/extension-api";
import {
  TableCommandsProvider,
  type TableCommands,
} from "@sync/extension-api";
import {
  updateMemoryDocument,
  describeMemoryFolder,
  createMemoryFolder,
  renameMemoryFolder,
  moveMemoryDocument,
  deleteMemoryFolder,
  memoryFolderToll,
} from "@sync/extension-api";
import { FolderSheet, FolderRemovalSheet, MoveArea } from "@sync/extension-api";
import {
  PROJECT_KEY,
  type MemoryFolder,
  type MemoryRecord,
  type MemoryType,
} from "@sync/extension-api";
import { explain, type Corpus } from "@sync/extension-api";
import { useFolders, type Folders } from "@sync/extension-api";
import { useDocument, type OpenDocument } from "@sync/extension-api";
import { useRecords, type RecordsFilter } from "./filter";
import type { AreaIntent, OpenProject } from "@sync/extension-api";
import {
  useProjectView,
  type ProjectViewState,
} from "@sync/extension-api";

/**
 * Records, as an area of the window.
 *
 * An area owns what it is showing — which type is selected, which record is
 * open, which confirmation is up — and the window owns where the columns are.
 * Before this, both lived in `ProjectWindow`, which meant the shell knew what a
 * type was and what "needs attention" meant. It does not need to know either,
 * and once areas arrive from extensions it cannot be allowed to.
 *
 * The three columns are three components rather than one, because they are
 * rendered into three different places in the window's panel tree. What holds
 * them together is a context: the columns read one answer from the store, one
 * selection and one open record, and three components asking separately would
 * be three answers from three revisions.
 *
 * The provider also carries the two things an area contributes to the window
 * beyond its columns: the sheets it opens, and what File offers while it is the
 * selected area. Both are rendered here rather than passed upward, so that
 * selecting a different area takes them away by unmounting rather than by
 * anybody remembering to clear them.
 */

interface RecordsContext {
  readonly project: OpenProject;
  readonly corpus: Corpus;
  readonly open: OpenDocument;
  readonly openKey: string | null;
  readonly openType: MemoryType | undefined;
  readonly filter: RecordsFilter;
  readonly view: ProjectViewState;
  readonly folders: Folders;
  readonly expanded: readonly string[];
  readonly setExpanded: (expanded: readonly string[]) => void;
  readonly composeType: MemoryType | null;
  readonly failure: string | null;
  readonly justCreated: string | null;
  readonly select: (next: RecordsFilter) => void;
  readonly openRecord: (key: string) => void;
  readonly closeRecord: () => void;
  readonly createRecord: (kind: string) => Promise<void>;
  /** Open the document that is a folder, writing it if there is none yet. */
  readonly describeFolder: (kind: string, folder: string) => Promise<void>;
  /** Ask for a folder inside `parent`, under `kind`. */
  readonly askNewFolder: (kind: string, parent: string) => void;
  /** Ask for a new name for one folder. */
  readonly askRenameFolder: (kind: string, folder: string) => void;
  /** Ask to delete one folder, and everything filed under it. */
  readonly askRemoveFolder: (folder: string | null) => void;
  /** Something was dragged onto a row that takes drops. */
  readonly dropOn: (target: unknown, payload: unknown) => Promise<void>;
  /** The folder the selection is on, when it is on one. */
  readonly selectedFolder: MemoryFolder | null;
  /** What that folder says about itself, or `null` while it says nothing. */
  readonly folderNote: OpenDocument;
  readonly archive: (record: MemoryRecord) => Promise<void>;
  readonly askRemoval: (key: string | null) => void;
  readonly nameType: (type: MemoryType | null) => void;
  readonly askTypeRemoval: (type: MemoryType | null) => void;
  readonly dismissFailure: () => void;
  readonly isFixed: (key: string, kind: string) => boolean;
}

const Context = createContext<RecordsContext | null>(null);

function useRecordsArea(): RecordsContext {
  const value = useContext(Context);
  if (value === null) {
    // A slot rendered outside its own area is a wiring mistake in the window,
    // not a state a person can reach. Saying so beats reading an empty column.
    throw new Error("A Records column was rendered outside the Records area.");
  }
  return value;
}

export function RecordsAreaProvider({
  project,
  active,
  intent,
  children,
}: {
  project: OpenProject;
  /**
   * False while this area is mounted but another one is selected. It keeps
   * everything it holds — the selection, the open record, the caret, where the
   * list was scrolled to — and stops doing anything: no reads, no scans, no
   * menu. Coming back is then a person finding the window as they left it,
   * which is what an area is for.
   */
  active: boolean;
  /** What the window is asking this area to show, or `null`. */
  intent?: AreaIntent | null;
  children: ReactNode;
}) {
  const [chosenFilter, setChosenFilter] = useState<RecordsFilter>({
    view: "all",
  });
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  /**
   * Which rows of the navigator's tree are open.
   *
   * Here rather than in the column, because the column is drawn and thrown away
   * as the window's panels come and go, and rebuilt again when somebody widens
   * the navigator. Here rather than in the project's stored view, because it is
   * layout: this window's shape right now, not a preference the project holds.
   */
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  /**
   * The last ask this area has stopped honouring, because the person did
   * something of their own afterwards.
   *
   * What an intent shows is derived rather than copied into state: an ask is a
   * value the window is holding, and an area that copied it would have two
   * answers to "what is open" that could drift apart. It stops applying the
   * moment somebody selects a type or opens a record — the ask has been
   * answered by then, and their next click is theirs rather than a correction
   * of ours.
   */
  const [settled, setSettled] = useState<AreaIntent | null>(null);
  // The ask still standing, if there is one. Identity is the test: the same
  // record asked for twice is two objects, and the second ask brings the
  // workspace back to it after the person had wandered off.
  const asking =
    intent && intent !== settled && intent.show === "record" ? intent : null;
  const filter: RecordsFilter = asking
    ? { kind: asking.kind }
    : chosenFilter;
  const openKey = asking ? asking.key : chosenKey;

  /**
   * Show a list, or a record, because the person said so.
   *
   * Every path that changes what this area is showing goes through these, and
   * each one settles the standing ask along the way: it has been honoured, and
   * what is on screen from here on is what somebody chose.
   */
  const setFilter = (next: RecordsFilter) => {
    setSettled(intent ?? null);
    setChosenFilter(next);
  };
  const setOpenKey = (next: string | null) => {
    setSettled(intent ?? null);
    setChosenKey(next);
  };

  // Which record a deletion has been asked about, by key. The sheet is the only
  // way a record is removed, and it is owned here because a deletion changes the
  // list, the counts and what the workspace is showing.
  const [removing, setRemoving] = useState<string | null>(null);
  // Which type a sheet is open on. Naming a type and redefining one are the
  // same sheet, so `null` inside means it is being named and `undefined` means
  // the sheet is closed; removing one is its own confirmation.
  const [namingType, setNamingType] = useState<
    MemoryType | null | undefined
  >();
  const [removingType, setRemovingType] = useState<MemoryType | null>(null);
  // Which folder a deletion has been asked about. The sheet is the only way one
  // is removed, because removing one takes everything filed under it.
  const [removingFolder, setRemovingFolder] = useState<string | null>(null);
  // Where a new folder was asked for, and under which type. `null` is the sheet
  // closed; the parent is the row the command came from, so the sheet has one
  // question to ask rather than two.
  // `renaming` carries the folder's current name when this is a rename, which
  // is the same question with a different answer already in the field.
  const [makingFolder, setMakingFolder] = useState<{
    kind: string;
    parent: string;
    renaming?: string;
  } | null>(null);
  // What the table under the caret can do, reported by the editor while it
  // holds one. The menu belongs to the window, and the caret is known several
  // components below it, so the table hands its commands up rather than the
  // area reaching down into a selection it does not own.
  const [tableCommands, setTableCommands] = useState<TableCommands | null>(null);
  // The record written a moment ago, which is the one whose title is waiting to
  // be typed. It is selection state like the rest of this: the next record
  // opened is somebody reading, not naming.
  const [justCreated, setJustCreated] = useState<string | null>(null);
  // Why the last write refused, or `null`. A command that a person asked for and
  // that did not happen has to say so where they asked: without this, creating a
  // record against an engine that cannot take one is a button that does nothing.
  const [failure, setFailure] = useState<string | null>(null);

  const projectView = useProjectView(project.path);
  // One read of the project's memory, shared by the three columns that show it:
  // the navigator lists its types, the workspace lists the selection, and the
  // inspector counts the whole of it.
  const corpus = useRecords(
    project.path,
    filter,
    projectView.hidden,
    active,
  );
  const open = useDocument(project.path, openKey);
  // The hierarchy, beside the corpus rather than inside it. Keyed to the same
  // revision, so the tree and the list on screen describe one moment: a folder
  // appearing a beat before the documents in it reads as the project being
  // wrong rather than the timing.
  // One read per type this window lists, because a folder belongs to a type
  // rather than to the project — see `useFolders`. The kinds are derived from
  // the corpus rather than held: they are the types, and a second copy would
  // be a second answer to what the project holds.
  const folders = useFolders(project.path, kindsOf(corpus), corpus.revision, active);

  /**
   * Close the open record: write it, and ask the store for the list again.
   *
   * Both halves are needed and they answer different halves of the same
   * failure. A record left within the save delay had not been written yet, so
   * the store still held it under its key with no title. And a list read before
   * any of that is a list from before it.
   */
  const closeRecord = () => {
    if (openKey === null) return;
    setOpenKey(null);
    void open.write().then(() => corpus.reload());
  };

  // Opening a different type closes whatever record is open: the list is what
  // the window is answering, and a record left behind from the last one would
  // be answering the previous.
  const select = (next: RecordsFilter) => {
    closeRecord();
    setFilter(next);
  };

  /**
   * A write that landed changed a row the list is holding, so the list is asked
   * again — while the record is still open, which is what keeps the way back
   * from showing a stale row at all.
   */
  const saved = open.save.status === "saved";
  const reload = corpus.reload;
  useEffect(() => {
    if (saved) reload();
  }, [saved, reload]);

  // Hiding the type currently being listed leaves the workspace showing a list
  // of something the window no longer lists, so the selection falls back to
  // everything.
  const view: ProjectViewState = {
    ...projectView,
    toggle: (kind: string) => {
      if ("kind" in filter && filter.kind === kind) select({ view: "all" });
      projectView.toggle(kind);
    },
  };

  // Removing a type leaves the same two things behind as hiding one, and one
  // more. The selection falls back to everything; the preference that hid it
  // stops naming it, or a type created later under the same name would arrive
  // already hidden by a decision about a different type.
  const deleteType = async (kind: string) => {
    const removed = await corpus.deleteType(kind);
    if ("kind" in filter && filter.kind === kind) select({ view: "all" });
    // A record of the type went with it, so the workspace would be holding a
    // document that no longer exists — and anything typed into it is addressed
    // to a record the transaction has already taken.
    if (open.document?.kind === kind) {
      if (openKey !== null) open.forget(openKey);
      setOpenKey(null);
    }
    if (projectView.isHidden(kind)) projectView.toggle(kind);
    return removed;
  };

  // The open record's type, from the project's own corpus: it carries the mark
  // the record is drawn with and the fields and relations the panel offers.
  const openType = corpus.types.find(
    (type) => type.kind === open.document?.kind,
  );

  // Writing a record and opening it are one action: the record is empty, so
  // there is nothing to look at anywhere else, and the caret belongs in its
  // title. If the write fails there is nothing to open and the navigator's own
  // error says why.
  const createRecord = async (kind: string) => {
    // Where the person is standing. A record written while a folder is open
    // belongs in that folder — anywhere else is the window forgetting what the
    // navigator is showing. Only for the kind being looked at: `⌘N` on another
    // type is about that type, and its own root is where it starts.
    const here =
      "kind" in filter && filter.kind === kind ? filter.folder : undefined;
    try {
      const created = await corpus.createRecord(kind, here);
      setFailure(null);
      select(here === undefined ? { kind } : { kind, folder: here });
      setOpenKey(created.key);
      setJustCreated(created.key);
    } catch (refused) {
      setFailure(explain(refused));
    }
  };

  /**
   * Open what a folder has to say, writing it if it has said nothing yet.
   *
   * The selection moves to the folder first. What opens is a document filed in
   * it, so a workspace still showing the type would be listing a record that is
   * not in the list it is showing.
   *
   * Both the corpus and the folders are re-read: a folder that had no
   * description now has one, which is a record in the corpus *and* a
   * `describedBy` in the tree.
   */
  const describeFolder = async (kind: string, folder: string) => {
    try {
      const document = await describeMemoryFolder(project.path, folder, kind);
      setFailure(null);
      select({ kind, folder });
      setOpenKey(document.key);
      corpus.reload();
      folders.reload();
    } catch (refused) {
      setFailure(explain(refused));
    }
  };

  /**
   * Make a folder, and show it.
   *
   * What a folder *is* differs by where the type keeps its documents — a
   * directory for one over a folder, the record that carries `isFolder` for one
   * whose documents are its records — and neither this nor the sheet branches
   * on it. The engine decides from the kind, which is why one command can sit
   * on both.
   *
   * Thrown rather than swallowed: the sheet is still up and is what reports it.
   */
  const makeFolder = async (kind: string, parent: string, name: string) => {
    const path = parent === "" ? name : `${parent}/${name}`;
    await createMemoryFolder(project.path, path, kind);
    setFailure(null);
    // A new folder is a row in the tree and, for one made in the records, a
    // record in the corpus too.
    folders.reload();
    corpus.reload();
    // Opened, because somebody who just made a folder is about to put something
    // in it — and its parent, or the new row would be inside a branch that is
    // still closed and the selection below would be somewhere nobody can see.
    //
    // The parent's *row*, which is the type's own when the folder is going in
    // at the top: there is no row for a type's root, so a folder id built from
    // it would name a row that is not in the tree.
    const branch = parentRow(kind, path, rootOfKind(corpus, kind));
    setExpanded((open) =>
      open.includes(branch) ? open : [...open, branch],
    );
    select({ kind, folder: path });
  };

  // What the workspace is showing, when it is showing a folder. Read from the
  // same answer the tree is drawn from, so the row and the surface beside it
  // cannot disagree about whether the folder has anything to say.
  const selectedFolder =
    "kind" in filter && filter.folder !== undefined
      ? (folders.byKind
          .get(filter.kind)
          ?.find((entry) => entry.path === filter.folder) ?? null)
      : null;
  // What that folder says, read by key. It is not in the page the workspace is
  // showing — the engine leaves the record that is a folder out of listings —
  // so it is a read of its own, and `null` while the folder says nothing.
  const folderNote = useDocument(project.path, selectedFolder?.describedBy ?? null);

  /**
   * Rename a folder, carrying everything under it.
   *
   * One engine transaction, and for a type over a directory the directory moves
   * too. Keys do not change, so nothing that points at these documents breaks.
   *
   * The selection follows the folder to its new path, because a person who just
   * renamed the thing they were looking at is still looking at it.
   */
  const renameFolder = async (kind: string, from: string, name: string) => {
    const parent = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    const to = parent === "" ? name : `${parent}/${name}`;
    await renameMemoryFolder(project.path, from, to);
    setFailure(null);
    folders.reload();
    corpus.reload();
    // Whatever was open under the old path is open under the new one: a rename
    // moves a branch, it does not close it.
    const was = folderRow(kind, from);
    setExpanded((open) =>
      open.map((id) =>
        id === was
          ? folderRow(kind, to)
          : id.startsWith(`${was}/`)
            ? folderRow(kind, to) + id.slice(was.length)
            : id,
      ),
    );
    select({ kind, folder: to });
  };

  /**
   * Something was dropped on a row of the tree.
   *
   * Two payloads and one destination. A record is filed there; a folder is
   * renamed into it, which is the same engine operation as any other rename and
   * carries everything under it. Where it landed is stated as a filter, so the
   * type's own row means the top of that type — the only way to drag something
   * back out of a folder.
   *
   * A folder dropped on itself or into its own subtree is refused here rather
   * than by the engine: it is the ordinary slip of the hand, and a folder that
   * disappeared into itself would be a bad afternoon.
   */
  const dropOn = async (target: unknown, payload: unknown) => {
    const where = target as { kind?: string; folder?: string } | null;
    const what = payload as
      | { record?: string; folder?: { kind: string; path: string } }
      | null;
    if (!where?.kind) return;
    // The type's own row means the top of *that type*, which is its directory
    // for a type over one and the project's root for a type whose documents
    // are its records. Reading it as the repository root either way would send
    // an attached document outside its storage, which the engine refuses —
    // correctly, and in words about a locator that nobody dragged.
    const type = corpus.types.find((candidate) => candidate.kind === where.kind);
    const to = where.folder ?? type?.storage.folder ?? "";
    try {
      if (what?.record !== undefined) {
        await moveMemoryDocument(project.path, what.record, to);
      } else if (what?.folder !== undefined) {
        const from = what.folder.path;
        const name = from.slice(from.lastIndexOf("/") + 1);
        if (to === from || to.startsWith(`${from}/`)) return;
        const moved = to === "" ? name : `${to}/${name}`;
        if (moved === from) return;
        await renameMemoryFolder(project.path, from, moved);
      } else {
        return;
      }
      setFailure(null);
      corpus.reload();
      folders.reload();
    } catch (refused) {
      setFailure(explain(refused));
    }
  };

  // Archiving is a patch on the record, and the row it came from has to stop
  // saying otherwise, so the list is re-read.
  const archive = async (record: MemoryRecord) => {
    try {
      await updateMemoryDocument(project.path, record.key, {
        archived: !record.archived,
      });
      setFailure(null);
      corpus.reload();
    } catch (refused) {
      setFailure(explain(refused));
    }
  };

  // Deleting the record the workspace has open leaves the workspace showing a
  // record that is gone, so it closes first.
  const deleteRecords = async (keys: readonly string[]) => {
    // Anything typed into one of these was typed into a record that is about to
    // stop existing. It is dropped before the delete rather than after, so the
    // save that was already scheduled cannot land in between.
    keys.forEach(open.forget);
    await corpus.deleteRecords(keys);
    if (openKey !== null && keys.includes(openKey)) setOpenKey(null);
  };

  // Which records the window neither creates nor removes, mirroring
  // `is_fixed_record` in `sync-memory`. Definitions never reach a list, so what
  // is left is the record that names the project: there is one of it, and a
  // project cannot be opened without it.
  const isFixed = (key: string, kind: string) =>
    key === PROJECT_KEY ||
    corpus.types.find((type) => type.kind === kind)?.own === true;

  // The row a deletion was asked about. A record is only removable through a
  // confirmation, and the confirmation needs the row rather than the key: it
  // draws what is about to go.
  const removingRecord =
    removing === null
      ? null
      : (corpus.records.find((record) => record.key === removing) ??
        (open.document && open.document.key === removing
          ? {
              key: open.document.key,
              kind: open.document.kind,
              title: open.document.title,
              freshness: open.document.freshness,
              scope: open.document.scope,
              archived: open.document.archived,
              tags: open.document.tags,
              locator: open.document.locator,
              presence: open.document.presence,
              folder: open.document.folder,
              isFolder: open.document.isFolder,
            }
          : null));

  // What can be written, and of which kind by default: the types this area
  // lists, in its order, and the one the navigator has selected.
  //
  // Sync's own type is never among them. A record of it is the record that
  // names the project: `isFixed` is the same rule, and a window offering to
  // write a second one would be offering to make the project two projects.
  const composable = corpus.types.filter(
    (type) => !type.own && !projectView.isHidden(type.kind),
  );
  const composeKind =
    "kind" in filter && composable.some((type) => type.kind === filter.kind)
      ? filter.kind
      : null;

  // The kind the workspace is showing, which is the one thing `⌘N` and the `+`
  // beside its title write. A view is not a kind, so both are disabled on one.
  const composeType =
    composable.find((type) => type.kind === composeKind) ?? null;

  // The menu bar is the application's, and this area is what can write
  // something while it is selected, so this is where File gets its commands.
  // `⇧⌘N` names a type, which is the one way to add one while the navigator is
  // collapsed. Selecting another area unmounts this and takes them away.
  useAppMenu(
    {
      selected: composeType
        ? { kind: composeType.kind, title: composeType.title }
        : null,
      createRecord: (kind) => void createRecord(kind),
      createType: () => setNamingType(null),
      table: tableCommands,
    },
    active,
  );

  return (
    <Context.Provider
      value={{
        project,
        corpus,
        open,
        openKey,
        openType,
        filter,
        view,
        folders,
        expanded,
        setExpanded,
        composeType,
        failure,
        justCreated,
        select,
        openRecord: setOpenKey,
        closeRecord,
        createRecord,
        describeFolder,
        askNewFolder: (kind, parent) => setMakingFolder({ kind, parent }),
        askRenameFolder: (kind, folder) =>
          setMakingFolder({
            kind,
            parent: folder.includes("/")
              ? folder.slice(0, folder.lastIndexOf("/"))
              : "",
            renaming: folder.slice(folder.lastIndexOf("/") + 1),
          }),
        dropOn,
        askRemoveFolder: setRemovingFolder,
        selectedFolder,
        folderNote,
        archive,
        askRemoval: setRemoving,
        nameType: setNamingType,
        askTypeRemoval: setRemovingType,
        dismissFailure: () => setFailure(null),
        isFixed,
      }}
    >
      <TableCommandsProvider value={setTableCommands}>
        {/* Above the columns, because the drag that matters crosses them: a
            record leaves the workspace's list and lands on a folder in the
            navigator. */}
        <MoveArea onDrop={(target, payload) => void dropOn(target, payload)}>
          {children}
        </MoveArea>

        <RecordRemovalSheet
          open={removingRecord !== null}
          onOpenChange={(isOpen) => setRemoving(isOpen ? removing : null)}
          record={removingRecord}
          types={corpus.types}
          dependentsOf={corpus.dependentsOf}
          onDelete={deleteRecords}
        />

        <FolderRemovalSheet
          open={removingFolder !== null}
          onOpenChange={(isOpen) => setRemovingFolder(isOpen ? removingFolder : null)}
          folder={removingFolder}
          countRecords={(folder) => memoryFolderToll(project.path, folder)}
          onDelete={async (folder) => {
            await deleteMemoryFolder(project.path, folder);
            setFailure(null);
            // The selection was on what just went, so it moves up to the type.
            if ("kind" in filter && filter.folder === folder) {
              select({ kind: filter.kind });
            }
            corpus.reload();
            folders.reload();
          }}
        />

        <FolderSheet
          open={makingFolder !== null}
          onOpenChange={(isOpen) => setMakingFolder(isOpen ? makingFolder : null)}
          parent={makingFolder?.parent ?? ""}
          renaming={makingFolder?.renaming}
          onSubmit={async (name) => {
            if (!makingFolder) return;
            const { kind, parent, renaming } = makingFolder;
            if (renaming === undefined) {
              await makeFolder(kind, parent, name);
            } else {
              const from = parent === "" ? renaming : `${parent}/${renaming}`;
              await renameFolder(kind, from, name);
            }
          }}
        />

        <TypeSheet
          open={namingType !== undefined}
          onOpenChange={(isOpen) =>
            setNamingType(isOpen ? namingType : undefined)
          }
          editing={namingType ?? null}
          onSubmit={namingType ? corpus.updateType : corpus.createType}
          existing={corpus.types}
          projectPath={project.path}
        />

        <TypeRemovalSheet
          open={removingType !== null}
          onOpenChange={(isOpen) => setRemovingType(isOpen ? removingType : null)}
          type={removingType}
          countRecords={corpus.countRecords}
          onDelete={deleteType}
        />
      </TableCommandsProvider>
    </Context.Provider>
  );
}

/** What this area calls itself, wherever the window shows its name. */
const TITLE = "Records";

export function RecordsNavigator() {
  const area = useRecordsArea();

  return (
    <ContextNavigator
      title={TITLE}
      corpus={area.corpus}
      folders={area.folders.byKind}
      filter={area.filter}
      view={area.view}
      expanded={area.expanded}
      onExpandedChange={area.setExpanded}
      onSelect={area.select}
      onNewFolder={area.askNewFolder}
      onRenameFolder={area.askRenameFolder}
      onRemoveFolder={area.askRemoveFolder}
      onNewType={() => area.nameType(null)}
      onEditType={area.nameType}
      onRemoveType={area.askTypeRemoval}
      onCreateRecord={(kind) => void area.createRecord(kind)}
    />
  );
}

export function RecordsWorkspace() {
  const area = useRecordsArea();
  const { open, corpus } = area;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ActionFailure message={area.failure} onDismiss={area.dismissFailure} />
      {area.openKey === null ? (
        <Workspace
          corpus={corpus}
          folder={area.selectedFolder}
          note={area.folderNote.document}
          filter={area.filter}
          compose={{
            type: area.composeType,
            onCreate: (kind) => void area.createRecord(kind),
          }}
          onOpen={area.openRecord}
          onArchive={(record) => void area.archive(record)}
          onDelete={(record) => area.askRemoval(record.key)}
          onDescribe={() => {
            if ("kind" in area.filter && area.filter.folder !== undefined) {
              void area.describeFolder(area.filter.kind, area.filter.folder);
            }
          }}
          isFixed={area.isFixed}
        />
      ) : (
        <DocumentView
          open={open}
          icon={area.openType?.icon}
          // The one record worth a sentence before its text. Its title and body
          // are the project's name and description, and a person editing what
          // looks like an ordinary claim should know which one this is.
          note={
            open.document?.key === PROJECT_KEY
              ? "The project's own record: its title is the project's name, its body is the description, and it travels with the repository. There is one of it, and it cannot be archived or deleted."
              : undefined
          }
          // The record that names the project is not one of the records the
          // window removes. The commands are shown and refused with the reason
          // rather than left out: a menu that is missing an item explains
          // nothing.
          fixed={
            open.document !== null &&
            area.isFixed(open.document.key, open.document.kind)
          }
          backLabel={viewName(area.filter, corpus.types)}
          onBack={area.closeRecord}
          onArchive={() => {
            if (open.draft === null) return;
            open.edit({ archived: !open.draft.archived });
            open.write();
          }}
          onDelete={() => area.askRemoval(open.document?.key ?? null)}
          justCreated={
            area.justCreated !== null && area.justCreated === area.openKey
          }
        />
      )}
    </div>
  );
}

export function RecordsInspector() {
  const area = useRecordsArea();

  return (
    <ContextInspector
      corpus={area.corpus}
      open={area.openKey === null ? null : area.open}
      projectPath={area.project.path}
    />
  );
}

/**
 * What a command that did not happen says for itself.
 *
 * A write the store refused has to be visible where it was asked for. Creating a
 * record is one click and one answer, and without this the answer is a button
 * that appears to do nothing — which is the failure mode this shell is least
 * allowed to have, and the one it had for exactly one session.
 *
 * It stays until it is dismissed or until the next command succeeds. There is no
 * "try again": what failed was a single action, and asking for it again is the
 * same click that was already there.
 */
function ActionFailure({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (message === null) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-separator bg-panel px-3 py-2">
      <p className="min-w-0 flex-1 text-xs text-fg-secondary">
        <span className="font-medium text-danger">That did not happen.</span>{" "}
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onDismiss} className="shrink-0">
        Dismiss
      </Button>
    </div>
  );
}

/**
 * Where one type's hierarchy starts.
 *
 * Its directory for a type over one, and the project root for a type whose
 * documents are its own records — the same answer the navigator draws from, so
 * a row the area expands is a row the navigator has.
 */
function rootOfKind(corpus: Corpus, kind: string): string {
  const type = corpus.types.find((candidate) => candidate.kind === kind);
  return type?.storage.folder ?? "";
}

/**
 * The kinds whose folders this window needs.
 *
 * Every type the project holds, hidden ones included: hiding a type is a view
 * preference, and re-reading the whole tree because somebody toggled one would
 * make a preference cost a round trip per type.
 *
 * A stable array while the corpus holds, because it is a dependency of the read
 * it drives — a fresh one each render would be a read each render.
 */
function kindsOf(corpus: Corpus): readonly string[] {
  return corpus.types.map((type) => type.kind);
}
