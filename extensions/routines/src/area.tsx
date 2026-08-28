"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Info, type LucideIcon } from "lucide-react";

import {
  Button,
  DocumentView,
  FolderRemovalSheet,
  FolderSheet,
  MoveArea,
  PanelPlaceholder,
  RecordRemovalSheet,
  createMemoryFolder,
  deleteMemoryFolder,
  deleteSession,
  describeMemoryFolder,
  explain,
  forgetRememberedConversation,
  kindIcon,
  memoryFolderToll,
  moveMemoryDocument,
  rememberedConversations,
  renameMemoryFolder,
  renameSession,
  startSession,
  updateMemoryDocument,
  useAgentSession,
  useAgents,
  useCorpus,
  useDocument,
  useFolders,
  useLiveSessions,
  type AgentDescriptor,
  type AreaIntent,
  type AreaProviderProps,
  type Corpus,
  type MemoryFolder,
  type MemoryRecord,
  type OpenDocument,
  type OpenProject,
} from "@sync-buzz/extension-api";

import {
  KIND,
  ROW_FIELDS,
  enabledOf,
  folderRow,
  nameOf,
  openTo,
  parentOf,
  routineRow,
  rowSubject,
} from "./model";

/**
 * What a trial run answered with, and which of the two kinds of answer it is.
 *
 * Two members rather than a string, because the string alone cannot be drawn
 * correctly: *started* and *did not start* are opposite news, and this column
 * showed both in the same tertiary grey — so a routine that refused to run read
 * exactly like one that had. `design-foundation.md` is explicit that a command
 * which did not happen says so.
 */
interface Ran {
  readonly said: string;
  readonly failed: boolean;
}

interface AreaState {
  readonly project: OpenProject;
  readonly corpus: Corpus;
  /** The routines in play: everything the project holds that is not archived. */
  readonly routines: readonly MemoryRecord[];
  /**
   * The archived ones, which are deliberately not among the above.
   *
   * `design-foundation.md` §510: archiving is the reversible half of removing
   * something, and what makes it that is that **the record leaves the lists**.
   * Mixed back in behind a filter they were rows nothing told apart from the
   * live ones — so they are their own group, the way an archived message is its
   * own mailbox rather than a preference over the inbox.
   */
  readonly archived: readonly MemoryRecord[];
  /** The mark this project's own type declares for a routine. */
  readonly kindIcon: LucideIcon;
  /** The same rows by key, for the commands that act on one. */
  readonly byKey: ReadonlyMap<string, MemoryRecord>;
  readonly folders: readonly MemoryFolder[];
  /** The selected row of the tree, stated in the tree's own ids. */
  readonly selected: string | null;
  readonly subject: ReturnType<typeof rowSubject>;
  readonly select: (id: string | null) => void;
  readonly expanded: readonly string[];
  readonly setExpanded: (expanded: readonly string[]) => void;
  /**
   * The selected routine, or `null` while the selection is a folder or nothing.
   * What the inspector describes: a folder's own description is a document the
   * workspace shows and never something with a clock.
   */
  readonly routineKey: string | null;
  /** What the workspace is showing: the selected routine, or a folder's note. */
  readonly openKey: string | null;
  readonly open: OpenDocument;
  /** True while what is open is what a folder says about itself. */
  readonly readingNote: boolean;
  /** Put that description away, leaving the folder it belongs to selected. */
  readonly closeNote: () => void;
  /**
   * The folder a new routine or folder goes into: the one selected, the one the
   * selected routine is filed in, or the top. Somebody looking at a folder
   * means that folder, and something that appeared elsewhere would be the
   * window ignoring where they were standing.
   */
  readonly folderInView: string;
  readonly selectedFolder: MemoryFolder | null;
  readonly folderNote: OpenDocument;
  readonly agents: readonly AgentDescriptor[];
  readonly agentName: (id: string) => string;
  readonly failure: string | null;
  readonly dismissFailure: () => void;

  readonly createRoutine: (folder: string) => void;
  readonly toggle: (record: MemoryRecord) => void;
  readonly archive: (record: MemoryRecord) => void;
  readonly moveTo: (key: string, folder: string) => void;
  readonly askRemoval: (key: string | null) => void;
  readonly askNewFolder: (parent: string) => void;
  readonly askRenameFolder: (folder: string) => void;
  readonly askRemoveFolder: (folder: string) => void;
  readonly describeFolder: (folder: string) => void;

  /** Carry one routine out now, without waiting for its interval. */
  readonly runNow: (key: string | null) => void;
  /** What happened to the last `Run now`, or `null` when nothing has. */
  readonly ran: Ran | null;
  readonly running: boolean;
}

const Area = createContext<AreaState | null>(null);

export function useArea(): AreaState {
  const held = useContext(Area);
  if (held === null) {
    throw new Error("A Routines column was drawn outside its own provider.");
  }
  return held;
}

/**
 * Routines, as an area of the window.
 *
 * Three columns, because a routine is a record and this window already knows
 * how to show one: the list, the record, and what is true *of* it. That last
 * division is `design-foundation.md`'s and it is what the first draft of this
 * area got wrong — it drew the interval, the agent and the switch as a settings
 * page in the middle column, which made a record look like a preferences pane
 * and left the instruction as one field among four. The instruction *is* the
 * routine; everything else is metadata, and metadata is edited beside the
 * record rather than in front of it.
 *
 * The first column is a tree rather than a list, and that is the second thing
 * this area got wrong. A project accumulates routines the way it accumulates
 * anything else, and a flat column of them offered no way to say *these three
 * are about the tracker* — so the folders every other record in Sync already
 * had were the missing half. They cost this package nothing to hold: a folder
 * is the engine's, the same one Records draws, and what is filed where travels
 * with the repository.
 */
export function RoutinesProvider({
  project,
  active,
  intent,
  children,
}: AreaProviderProps & { children?: ReactNode }) {
  // The three fields every row draws, asked for by name. A listing carries what
  // it was asked for and nothing else, so a column that says *this one runs,
  // hourly, as Claude* names them here rather than opening every record to find
  // out — which a column cannot do at all, the only read of a single record on
  // this surface being a hook.
  const corpus = useCorpus(
    project.path,
    { kind: KIND, fields: [...ROW_FIELDS] },
    undefined,
    active,
  );
  // The folders, read live and separately from the records. A group somebody
  // made and has not filed anything in yet is a real place; one derived from
  // the rows in it would vanish the moment it was emptied.
  const folders = useFolders(project.path, KINDS, corpus.revision, active);
  const { agents } = useAgents();

  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  // The sheets this area opens. Each is the shell's own: a deletion has to say
  // what holds on to what is going, and an area drawing its own version of that
  // question would be a second answer to it.
  const [removing, setRemoving] = useState<string | null>(null);
  const [namingFolder, setNamingFolder] = useState<{
    parent: string;
    renaming?: string;
  } | null>(null);
  const [removingFolder, setRemovingFolder] = useState<string | null>(null);

  // What a folder says about itself, while somebody is reading it. Held apart
  // from the tree's selection rather than expressed in it, and that separation
  // is load-bearing: the engine leaves the record that *is* a folder out of
  // listings, so a selection naming it would be a selection the tree cannot
  // draw — and the guard below, which drops a selection no row answers to,
  // would take it away in the same breath it was made.
  const [noteKey, setNoteKey] = useState<string | null>(null);

  const subject = rowSubject(selected);
  const routineKey =
    subject !== null && "routine" in subject ? subject.routine : null;
  const openKey = routineKey ?? noteKey;
  const open = useDocument(project.path, openKey);

  // Moving in the tree puts a folder's description away. It was opened from one
  // row, and it is that row's; carrying it to the next would be the middle
  // column showing something the navigator no longer points at.
  const select = useCallback((id: string | null) => {
    setNoteKey(null);
    setSelected(id);
  }, []);

  const mine = folders.byKind.get(KIND) ?? EMPTY_FOLDERS;
  // The glyph the project's own type names for a routine, resolved once. A
  // type invented on this machine is the project's to mark, so it is read from
  // the corpus rather than chosen here.
  const mark = kindIcon(
    corpus.types.find((type) => type.kind === KIND)?.icon ?? "alarm-clock",
  );

  const { routines, archived, byKey } = useMemo(() => {
    const byKey = new Map<string, MemoryRecord>();
    const routines: MemoryRecord[] = [];
    const archived: MemoryRecord[] = [];
    for (const record of corpus.records) {
      byKey.set(record.key, record);
      (record.archived ? archived : routines).push(record);
    }
    return { routines, archived, byKey };
  }, [corpus.records]);

  const selectedFolder =
    subject !== null && "folder" in subject
      ? (mine.find((entry) => entry.path === subject.folder) ?? null)
      : null;
  // What that folder says about itself, read by key: the engine leaves the
  // record that *is* a folder out of listings, so it is not among the rows and
  // has to be asked for.
  const folderNote = useDocument(project.path, selectedFolder?.describedBy ?? null);

  const folderInView =
    subject === null
      ? ""
      : "folder" in subject
        ? subject.folder
        : (byKey.get(subject.routine)?.folder ?? "");

  // A routine that was deleted, or a project that answered without it, must not
  // leave the other columns drawing a record nobody can reach. The same is true
  // of a folder that has gone, and of a routine the archive filter just hid:
  // a selection pointing at a row that is no longer drawn is a window whose two
  // halves disagree about what is on screen.
  useEffect(() => {
    if (selected === null) return;
    // Not while the store is still answering. An empty list is not the same
    // claim as *this row is gone*, and an ask arriving before the first read —
    // a search result, a backlink — named a row the list did not hold yet, so
    // the selection it made was taken away in the same breath.
    if (corpus.isLoading || folders.isLoading) return;
    const held = rowSubject(selected);
    if (held === null) return;
    if ("routine" in held) {
      if (!routines.some((row) => row.key === held.routine)) select(null);
    } else if (!mine.some((entry) => entry.path === held.folder)) {
      select(null);
    }
  }, [routines, mine, selected, select, corpus.isLoading, folders.isLoading]);

  useApplied(intent, active, (key) => {
    // A routine reached from outside this column may be archived, filed in a
    // folder that is closed, or both. Every one of those is a row the tree
    // would not be drawing, so the ask opens the way to it rather than landing
    // on a selection nobody can see.
    const record = corpus.records.find((row) => row.key === key);
    const folder = record?.folder ?? null;
    if (folder !== null) setExpanded((was) => openTo(was, folder));
    select(routineRow(key));
  });

  /**
   * What a write the store refused says for itself.
   *
   * Every command here reports through this. Creating a routine or moving one
   * is a click and an answer, and without this the answer is a control that
   * appears to do nothing — the failure mode this window is least allowed to
   * have.
   */
  const refused = useCallback((failure: unknown) => setFailure(explain(failure)), []);
  const done = useCallback(() => setFailure(null), []);

  const createRoutine = useCallback(
    (folder: string) => {
      void corpus.createRecord(KIND, folder).then((made) => {
        done();
        select(routineRow(made.key));
        if (folder !== "") setExpanded((was) => openTo(was, folder));
        // Written straight away, so the routine is complete the moment it
        // exists. `enabled` is deliberately not among them: absent reads as
        // off, and off is what a routine starts as.
        void updateMemoryDocument(project.path, made.key, {
          fields: { every: "1h", agent: agents[0]?.id ?? "claude" },
        }).then(
          () => corpus.reload(),
          (failure: unknown) => {
            refused(failure);
            corpus.reload();
          },
        );
      }, refused);
    },
    [corpus, project.path, agents, select, refused, done],
  );

  /**
   * Switch one routine on or off, from the list.
   *
   * The one fact about a routine somebody changes more than once, and until now
   * it could only be reached by opening the record first. It is a write to the
   * store rather than a draft, for the same reason the panel's own switch is:
   * the clock reads the store, and a switch left on the pause that text is
   * written on is a routine somebody turned on that is still off.
   */
  const toggle = useCallback(
    (record: MemoryRecord) => {
      const fields = (record.fields ?? {}) as Record<string, unknown>;
      void updateMemoryDocument(project.path, record.key, {
        fields: { ...fields, enabled: !enabledOf(record.fields) },
      }).then(() => {
        done();
        corpus.reload();
      }, refused);
    },
    [project.path, corpus, refused, done],
  );

  const archive = useCallback(
    (record: MemoryRecord) => {
      void updateMemoryDocument(project.path, record.key, {
        archived: !record.archived,
      }).then(() => {
        done();
        corpus.reload();
      }, refused);
    },
    [project.path, corpus, refused, done],
  );

  const moveTo = useCallback(
    (key: string, folder: string) => {
      void moveMemoryDocument(project.path, key, folder).then(() => {
        done();
        corpus.reload();
        folders.reload();
        if (folder !== "") setExpanded((was) => openTo(was, folder));
      }, refused);
    },
    [project.path, corpus, folders, refused, done],
  );

  /**
   * Make a folder, and show it.
   *
   * Thrown rather than swallowed: the sheet that asked for the name is still up
   * and is what reports a name the store would not take.
   */
  const makeFolder = useCallback(
    async (parent: string, name: string) => {
      const path = parent === "" ? name : `${parent}/${name}`;
      await createMemoryFolder(project.path, path, KIND);
      done();
      folders.reload();
      corpus.reload();
      // Opened, because somebody who just made a folder is about to put
      // something in it — and its parent with it, or the new row would be
      // inside a branch that is still closed.
      setExpanded((was) => openTo(was, path));
      select(folderRow(path));
    },
    [project.path, folders, corpus, select, done],
  );

  /**
   * Rename a folder, carrying everything under it.
   *
   * One engine transaction, and keys do not change, so nothing that points at
   * these routines breaks. The selection follows the folder to its new path,
   * because somebody who just renamed the thing they were looking at is still
   * looking at it.
   */
  const renameFolder = useCallback(
    async (from: string, name: string) => {
      const parent = parentOf(from);
      const to = parent === "" ? name : `${parent}/${name}`;
      await renameMemoryFolder(project.path, from, to);
      done();
      folders.reload();
      corpus.reload();
      setExpanded((was) => openTo(was, to));
      select(folderRow(to));
    },
    [project.path, folders, corpus, select, done],
  );

  /**
   * Open what a folder says about itself, writing it if it has said nothing.
   *
   * There is no separate command for the second case: somebody who clicks an
   * empty description is asking to fill it in. What opens is the ordinary
   * editor, because what opens is an ordinary document.
   */
  const describeFolder = useCallback(
    (folder: string) => {
      void describeMemoryFolder(project.path, folder, KIND).then((document_) => {
        done();
        corpus.reload();
        folders.reload();
        setNoteKey(document_.key);
      }, refused);
    },
    [project.path, corpus, folders, refused, done],
  );

  /**
   * Something was dragged onto a row that takes drops.
   *
   * A folder dropped on itself or into its own subtree is refused here rather
   * than by the engine: it is the ordinary slip of the hand, and a folder that
   * disappeared into itself would be a bad afternoon.
   */
  const dropOn = useCallback(
    async (target: unknown, payload: unknown) => {
      const where = target as { folder?: string } | null;
      const what = payload as { record?: string; folder?: string } | null;
      if (where?.folder === undefined) return;
      const to = where.folder;
      try {
        if (what?.record !== undefined) {
          await moveMemoryDocument(project.path, what.record, to);
        } else if (what?.folder !== undefined) {
          const from = what.folder;
          if (to === from || to.startsWith(`${from}/`)) return;
          const moved = to === "" ? nameOf(from) : `${to}/${nameOf(from)}`;
          if (moved === from) return;
          await renameMemoryFolder(project.path, from, moved);
        } else {
          return;
        }
        done();
        corpus.reload();
        folders.reload();
        setExpanded((was) => openTo(was, to));
      } catch (failure) {
        refused(failure);
      }
    },
    [project.path, corpus, folders, refused, done],
  );

  const { runNow, ran, running } = useRunNow(project, open, routineKey);

  const state = useMemo<AreaState>(
    () => ({
      project,
      corpus,
      routines,
      archived,
      kindIcon: mark,
      byKey,
      folders: mine,
      selected,
      subject,
      select,
      expanded,
      setExpanded,
      routineKey,
      openKey,
      open,
      readingNote: routineKey === null && noteKey !== null,
      closeNote: () => setNoteKey(null),
      folderInView,
      selectedFolder,
      folderNote,
      agents,
      agentName: (id) => agents.find((one) => one.id === id)?.name ?? id,
      failure,
      dismissFailure: done,
      createRoutine,
      toggle,
      archive,
      moveTo,
      askRemoval: setRemoving,
      askNewFolder: (parent) => setNamingFolder({ parent }),
      askRenameFolder: (folder) =>
        setNamingFolder({ parent: parentOf(folder), renaming: nameOf(folder) }),
      askRemoveFolder: setRemovingFolder,
      describeFolder,
      runNow,
      ran,
      running,
    }),
    [
      project,
      corpus,
      routines,
      archived,
      mark,
      byKey,
      mine,
      selected,
      subject,
      select,
      expanded,
      routineKey,
      openKey,
      noteKey,
      open,
      folderInView,
      selectedFolder,
      folderNote,
      agents,
      failure,
      done,
      createRoutine,
      toggle,
      archive,
      moveTo,
      describeFolder,
      runNow,
      ran,
      running,
    ],
  );

  // The row the removal sheet is about. Read from the list rather than held
  // when the command was chosen, so the sheet is never asking about a record as
  // it stood a minute ago.
  const goingRecord = removing === null ? null : (byKey.get(removing) ?? null);

  return (
    <Area.Provider value={state}>
      {/* Above the columns, because the drag that matters crosses them: a
          routine is picked up in the navigator and lands on a folder in the
          same column, and a drop that left the tree would have nothing to
          land on. */}
      <MoveArea onDrop={(target, payload) => void dropOn(target, payload)}>
        {children}
      </MoveArea>

      <RecordRemovalSheet
        open={goingRecord !== null}
        onOpenChange={(isOpen) => setRemoving(isOpen ? removing : null)}
        record={goingRecord}
        types={corpus.types}
        dependentsOf={corpus.dependentsOf}
        onDelete={async (keys) => {
          // The selection goes before the record does, or the columns beside
          // this one spend a render drawing something that has been deleted.
          if (removing !== null && routineKey === removing) select(null);
          await corpus.deleteRecords(keys);
          done();
        }}
      />

      <FolderSheet
        open={namingFolder !== null}
        onOpenChange={(isOpen) => setNamingFolder(isOpen ? namingFolder : null)}
        parent={namingFolder?.parent ?? ""}
        renaming={namingFolder?.renaming}
        onSubmit={async (name) => {
          if (namingFolder === null) return;
          const { parent, renaming } = namingFolder;
          if (renaming === undefined) await makeFolder(parent, name);
          else {
            const from = parent === "" ? renaming : `${parent}/${renaming}`;
            await renameFolder(from, name);
          }
        }}
      />

      <FolderRemovalSheet
        open={removingFolder !== null}
        onOpenChange={(isOpen) => setRemovingFolder(isOpen ? removingFolder : null)}
        folder={removingFolder}
        countRecords={(folder) => memoryFolderToll(project.path, folder)}
        onDelete={async (folder) => {
          await deleteMemoryFolder(project.path, folder);
          done();
          select(null);
          corpus.reload();
          folders.reload();
        }}
      />
    </Area.Provider>
  );
}

/** The kinds whose folders this area reads. One, and it is held steady: a
 *  fresh array each render would be a read of the tree each render. */
const KINDS: readonly string[] = [KIND];
const EMPTY_FOLDERS: readonly MemoryFolder[] = [];

/**
 * The routine itself: its name and the instruction, as a record is read.
 *
 * Or the folder, when the selection is one. A folder is a place, and a place a
 * person selected has to answer with something — an empty column beside a row
 * they just clicked is the window refusing to say what it did.
 */
export function RoutinesWorkspace() {
  const area = useArea();
  const folder = area.selectedFolder;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ActionFailure message={area.failure} onDismiss={area.dismissFailure} />
      {area.openKey === null ? (
        <Empty />
      ) : (
        <DocumentView
          open={area.open}
          icon="alarm-clock"
          // What a folder says about itself is an ordinary document, and it is
          // opened in the ordinary editor — but a person who clicked a strip on
          // a folder should be told which of the two they are now typing into.
          note={
            area.readingNote
              ? "What this folder is for. It is a document like any other, filed in the folder it describes, and it is what somebody reads before putting a routine here."
              : "What an agent is told, every time. Write it for somebody competent who has not seen this project — and say what to do when there is nothing to report."
          }
          // The record that *is* a folder is not one this column removes: it
          // goes when the folder does, and archiving it would leave a folder
          // describing itself to nobody. Both commands are drawn and refused
          // rather than left out — a menu missing an item explains nothing.
          fixed={area.readingNote}
          onBack={() => (area.readingNote ? area.closeNote() : area.select(null))}
          backLabel={
            area.readingNote && folder !== null ? nameOf(folder.path) : "Routines"
          }
          onArchive={() => {
            if (area.open.draft === null) return;
            area.open.edit({ archived: !area.open.draft.archived });
            void area.open.write().then(() => area.corpus.reload(), () => undefined);
          }}
          onDelete={() => area.askRemoval(area.routineKey)}
        />
      )}
    </div>
  );
}

/**
 * The column with no document open: a folder, or nothing at all.
 *
 * The band is drawn either way. It is one height across the slab, and a column
 * that skips it leaves the hairline broken at its own edge.
 */
function Empty() {
  const area = useArea();
  const folder = area.selectedFolder;

  return (
    <section className="flex h-full min-w-0 flex-col bg-workspace">
      <div className="flex h-(--panel-header-height) shrink-0 items-center border-b border-separator px-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">
          {folder === null ? "Routine" : nameOf(folder.path)}
        </h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
        {folder === null ? (
          <PanelPlaceholder
            headline="Nothing selected"
            detail="Choose a routine, or make one. Each is an instruction an agent carries out on a clock — whether or not this window is open."
          />
        ) : (
          <>
            <PanelPlaceholder
              headline={
                folder.records === 0
                  ? "Nothing filed here yet"
                  : `${folder.records} ${folder.records === 1 ? "routine" : "routines"} in this folder`
              }
              // What the folder says about itself, when it says anything. It is
              // the answer to *why is this group here*, and it belongs above
              // the invitation to write it rather than behind a second click.
              detail={
                said(area.folderNote) ??
                "A folder is a place to keep the routines that belong together. Drag one onto it, or write a new one here."
              }
            />
            {/* A folder can say what it is for, and the way to say it is to
                click where it would be said. No verb to find in a menu first,
                and nothing to know about how it is stored: what opens is the
                ordinary editor, because what opens is an ordinary document. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => area.describeFolder(folder.path)}
            >
              <Info />
              {folder.describedBy === null
                ? "Say what this folder is for"
                : "Read what this folder is for"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The opening line of what a folder says about itself, or `null`.
 *
 * Markdown's own marks are stepped over rather than rendered: a description
 * beginning `# Overnight` says "Overnight" to a person, and showing the hash
 * would be the window quoting syntax at them.
 */
function said(note: OpenDocument): string | null {
  const line = (note.document?.content ?? "")
    .split("\n")
    .map((text) => text.replace(/^#+\s*/, "").trim())
    .find((text) => text !== "");
  return line ?? null;
}

/**
 * What a command that did not happen says for itself.
 *
 * It stays until it is dismissed or until the next command succeeds. There is
 * no "try again": what failed was a single action, and asking for it again is
 * the same click that was already there.
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
 * Apply what the window is asking this area to show.
 *
 * Identity is the signal rather than the key: the same object is handed over
 * until the next ask, so asking twice for one routine is two objects and opens
 * it twice — somebody who wandered off and wants it back, not a duplicate to
 * swallow.
 */
function useApplied(
  intent: AreaIntent | null | undefined,
  active: boolean,
  show: (key: string) => void,
) {
  const settled = useRef<AreaIntent | null>(null);
  // Read through a ref: what `show` closes over changes as the corpus does, and
  // an effect depending on it would apply the same ask again on every read.
  const apply = useRef(show);
  apply.current = show;

  useEffect(() => {
    if (!active || !intent || intent === settled.current) return;
    settled.current = intent;
    if (intent.show === "record" && intent.kind === KIND) apply.current(intent.key);
  }, [intent, active]);
}

/**
 * Carrying a routine out now, without waiting for its interval.
 *
 * **This is the window's path, not the clock's, and they differ on purpose.**
 * The clock's handler *orders work* and Sync raises the agent, because a
 * handler is gone in milliseconds. Here there is a window, a person watching,
 * and the session layer the surface already publishes — so a trial run is an
 * ordinary conversation, opened the way Chat opens one. It appears in Chat
 * beside every other conversation, which is also the answer to *did it work*:
 * there is something to read.
 *
 * The prompt is the routine's own text and nothing else. What the handler adds
 * — that nobody is watching — would be false here.
 *
 * **It runs any routine, not only the open one.** That was the change worth
 * making: the command lived beside the record, so trying one meant opening it
 * first, and the row in the list — where somebody is looking when they think of
 * it — could not do the one thing a row about a scheduled instruction should.
 * What that costs is a read: the instruction is the body, a body is not carried
 * by a listing, and the only read of a single record on this surface is a hook.
 * So the run is ordered here and starts when the read lands.
 */
function useRunNow(
  project: OpenProject,
  open: OpenDocument,
  routine: string | null,
) {
  const [order, setOrder] = useState<{ key: string; nth: number } | null>(null);
  const [pending, setPending] = useState<{ key: string; text: string } | null>(null);
  const [ran, setRan] = useState<Ran | null>(null);
  const [running, setRunning] = useState(false);
  // The routine being run, read whole. A separate read from the one the middle
  // column holds, and deliberately: the row somebody chose `Run Now` on is
  // usually not the record that is open, and the instruction is the body.
  const asked = useDocument(project.path, order?.key ?? null);
  const session = useAgentSession(pending?.key ?? null);
  // Everything running in this window right now, which is where a trial run
  // started a minute ago still is. A dormant one is in the pointers instead,
  // and clearing a slot means both. Read through a ref for the same reason the
  // session below is: the list changes identity whenever anything anywhere
  // says something, and `runNow` must not be rebuilt on every one of them.
  const live = useLiveSessions();
  const rows = useRef(live.sessions);
  rows.current = live.sessions;

  // The session object changes identity on every update it receives, so it is
  // read through a ref: an effect depending on it would send the prompt again
  // each time the agent said something.
  const talking = useRef(session);
  talking.current = session;

  const openRef = useRef(open);
  openRef.current = open;
  const openRoutine = useRef(routine);
  openRoutine.current = routine;

  // Which order has already been acted on. An order is a fresh object each
  // time, so running the same routine twice in a row is two of them — and the
  // effect below fires once per object rather than once per key.
  const started = useRef<{ key: string; nth: number } | null>(null);

  useEffect(() => {
    if (order === null || started.current === order) return;
    if (asked.isLoading) return;
    const document_ = asked.document;
    if (document_ !== null && document_.key !== order.key) return;
    started.current = order;

    if (document_ === null) {
      setRan({ said: "That routine is no longer in this project.", failed: true });
      setRunning(false);
      return;
    }

    const text = (document_.content ?? "").trim();
    if (text.length === 0) {
      setRan({ said: "There is no instruction to carry out yet.", failed: true });
      setRunning(false);
      return;
    }

    const fields = (document_.fields ?? {}) as Record<string, unknown>;
    const agentId = typeof fields.agent === "string" ? fields.agent : "claude";
    // What the conversation is called in Chat, and the routine is the only
    // thing that knows it. Unnamed, a session is titled from the first words
    // said — which here is the instruction, written to an agent, standing in a
    // list of sentences people typed. The clock's own path names it for exactly
    // this reason; a trial run that did not was the same conversation arriving
    // under two different kinds of name depending on who started it.
    const title = (document_.title ?? "").trim() || "Routine";

    // The same slot the clock uses, cleared the same way and for the same
    // reason: one routine, one conversation, whoever started it. The clock does
    // this from the host, because there is no window at three in the morning;
    // here there is one, so the package does it itself with what the surface
    // already publishes.
    //
    // Before starting rather than after, which is the opposite of the host's
    // order and is right for the opposite reason: a trial run is watched, and
    // somebody who presses this is asking to see *this* run — not to find the
    // one before it still sitting there while they wait.
    void clearSlot(project.path, order.key, rows.current)
      .then(() => startSession({ agentId, cwd: project.path }))
      .then(
        // Named before anything is said, because saying something is what
        // writes the pointer and the pointer records the title. Named after, it
        // would be right in this run's list and wrong in every later one.
        (opened: { key: string }) =>
          renameSession(opened.key, title).then(
            () => setPending({ key: opened.key, text }),
            // A conversation that started under the wrong name is still a
            // conversation that started. The run is what was asked for.
            () => setPending({ key: opened.key, text }),
          ),
        (failure: unknown) => {
          setRan({ said: explain(failure), failed: true });
          setRunning(false);
        },
      );
  }, [order, asked.document, asked.isLoading, project.path]);

  useEffect(() => {
    if (pending === null) return;
    let dropped = false;
    void talking.current
      .prompt(pending.text)
      .then(
        () => {
          if (!dropped) {
            setRan({
              said: "Started. It is in Chat, under this project.",
              failed: false,
            });
          }
        },
        (failure: unknown) => {
          if (!dropped) setRan({ said: explain(failure), failed: true });
        },
      )
      .finally(() => {
        if (!dropped) {
          setPending(null);
          setRunning(false);
        }
      });
    return () => {
      dropped = true;
    };
  }, [pending]);

  const runNow = useCallback((key: string | null) => {
    if (key === null) return;
    setRan(null);
    setRunning(true);
    // Written first, so a trial run never asks an agent to act on a sentence
    // that is still only in this window. Only the open routine can have
    // anything waiting; every other row is already exactly what the store
    // holds, and its read below is what proves it.
    const settled =
      key === openRoutine.current ? openRef.current.write() : Promise.resolve();
    void settled.then(
      () => setOrder((was) => ({ key, nth: (was?.nth ?? 0) + 1 })),
      (failure: unknown) => {
        setRan({ said: explain(failure), failed: true });
        setRunning(false);
      },
    );
  }, []);

  return { runNow, ran, running };
}

/**
 * Leaves this routine's slot empty: every conversation about it, running or
 * dormant, ended and taken out of the list.
 *
 * **A conversation kept as a record is left alone**, which is the one exemption
 * the host makes too. Keeping one is a decision somebody made about that
 * conversation, and it outranks this package's arrangement of its own rows.
 *
 * Quiet throughout, and deliberately: everything here costs at worst a row that
 * should have gone, and none of it is a reason to refuse to carry the routine
 * out. The failure that matters — the run itself — is reported where the button
 * is.
 */
async function clearSlot(
  project: string,
  routine: string,
  live: readonly { key: string; source?: { about?: string } }[],
): Promise<void> {
  for (const row of live) {
    if (row.source?.about !== routine) continue;
    await deleteSession(row.key).catch(() => undefined);
  }

  const dormant = await rememberedConversations(project).catch(() => []);
  for (const one of dormant) {
    if (one.source?.about !== routine) continue;
    if (one.recordKey !== undefined) continue;
    await forgetRememberedConversation(project, one.acpSession).catch(() => undefined);
  }
}
