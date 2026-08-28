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

import type { LucideIcon } from "lucide-react";

import {
  FolderRemovalSheet,
  FolderSheet,
  MoveArea,
  RecordRemovalSheet,
  createMemoryFolder,
  deleteMemoryFolder,
  deleteSession,
  describeMemoryFolder,
  explain,
  folderName,
  forgetRememberedConversation,
  kindIcon,
  memoryFolderToll,
  moveMemoryDocument,
  parentFolder,
  rememberedConversations,
  renameMemoryFolder,
  renameSession,
  startSession,
  updateMemoryDocument,
  useAgentSession,
  useAgents,
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

import { KIND, enabledOf } from "./model";
import { liveByFolder, useRoutines, type RoutinesFilter } from "./filter";
import { ALL_ROW, folderRow, parentRow } from "./navigator";

/**
 * What a trial run answered with, and which of the two kinds of answer it is.
 *
 * Two members rather than a string, because the string alone cannot be drawn
 * correctly: *started* and *did not start* are opposite news, and this column
 * showed both in the same tertiary grey — so a routine that refused to run read
 * exactly like one that had.
 */
interface Ran {
  readonly said: string;
  readonly failed: boolean;
}

interface AreaState {
  readonly project: OpenProject;
  readonly corpus: Corpus;
  readonly folders: readonly MemoryFolder[];
  /** How many routines are in play, and how many have been put away. */
  readonly counts: { readonly live: number; readonly archived: number };
  /** How many routines are in play in each folder, by path. */
  readonly perFolder: ReadonlyMap<string, number>;
  readonly filter: RoutinesFilter;
  readonly select: (filter: RoutinesFilter) => void;
  readonly expanded: readonly string[];
  readonly setExpanded: (expanded: readonly string[]) => void;
  /** The record the workspace has given its whole surface to, or `null`. */
  readonly openKey: string | null;
  readonly open: OpenDocument;
  /** The open routine, when what is open is one — never a folder's own note. */
  readonly routineKey: string | null;
  readonly openRoutine: (key: string) => void;
  readonly closeRoutine: () => void;
  /** What a new routine or folder goes into: the folder in view, else the top. */
  readonly folderInView: string;
  readonly folderNote: OpenDocument;
  readonly agents: readonly AgentDescriptor[];
  readonly agentName: (id: string) => string;
  /** The glyph the tree draws, resolved. */
  readonly kindIcon: LucideIcon;
  /** The same mark by name, which is what the surface's own rows take. */
  readonly kindMark: string;
  readonly failure: string | null;
  readonly dismissFailure: () => void;
  readonly justCreated: string | null;

  readonly createRoutine: (folder: string) => void;
  readonly toggle: (record: MemoryRecord) => void;
  readonly archive: (record: MemoryRecord) => void;
  readonly askRemoval: (key: string | null) => void;
  readonly askNewFolder: (parent: string) => void;
  readonly askRenameFolder: (folder: string) => void;
  readonly askRemoveFolder: (folder: string) => void;
  readonly describeFolder: () => void;

  readonly runNow: (key: string | null) => void;
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

/** The kinds whose folders this area reads. Held steady: a fresh array each
 *  render would be a read of the tree each render. */
const KINDS: readonly string[] = [KIND];
const NO_FOLDERS: readonly MemoryFolder[] = [];
const EVERYTHING: RoutinesFilter = { view: "all" };

/**
 * Routines, as an area of the window.
 *
 * Three columns, and the division between the first two is the one this area
 * had to be rebuilt to get right. **The navigator is where you stand and the
 * workspace is what is there** — that is what Records does with its types and
 * Tasks with its register, and putting the routines themselves into the tree
 * made the section a list that folded shut behind one triangle.
 *
 * It is also what gives a routine somewhere to carry a switch. A source list
 * row is a name and a mark; a row on the surface is markup this package writes,
 * and *whether this runs* is a decision somebody makes several times a day —
 * which on this system is a checkbox in the row.
 */
export function RoutinesProvider({
  project,
  active,
  intent,
  children,
}: AreaProviderProps & { children?: ReactNode }) {
  const [filter, setFilter] = useState<RoutinesFilter>(EVERYTHING);
  const corpus = useRoutines(project.path, filter, active);
  const folders = useFolders(project.path, KINDS, corpus.revision, active);
  const { agents } = useAgents();

  const [expanded, setExpanded] = useState<readonly string[]>([ALL_ROW]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const [removing, setRemoving] = useState<string | null>(null);
  const [namingFolder, setNamingFolder] = useState<{
    parent: string;
    renaming?: string;
  } | null>(null);
  const [removingFolder, setRemovingFolder] = useState<string | null>(null);

  const open = useDocument(project.path, openKey);
  const mine = folders.byKind.get(KIND) ?? NO_FOLDERS;
  // The mark the project's own type names for a routine. A type invented on
  // this machine is the project's to mark, so it is read from the corpus rather
  // than chosen here — by name for the surface, resolved for the tree.
  const markName = corpus.types.find((type) => type.kind === KIND)?.icon ?? "alarm-clock";
  const mark = kindIcon(markName);

  const counts = useMemo(() => {
    let live = 0;
    let archived = 0;
    for (const record of corpus.records) {
      if (record.isFolder) continue;
      if (record.archived) archived += 1;
      else live += 1;
    }
    return { live, archived };
  }, [corpus.records]);

  const perFolder = useMemo(() => liveByFolder(corpus.records), [corpus.records]);

  const folderInView = "folder" in filter ? filter.folder : "";
  const selectedFolder =
    "folder" in filter
      ? (mine.find((entry) => entry.path === filter.folder) ?? null)
      : null;
  // What that folder says about itself, read by key: the engine leaves the
  // record that *is* a folder out of listings, so it is not among the rows.
  const folderNote = useDocument(project.path, selectedFolder?.describedBy ?? null);

  /**
   * What is open, and which of the two things it is.
   *
   * A folder's own description is a document this surface shows and never
   * something with a clock, so the inspector is told apart from the workspace:
   * one draws whatever is open, the other only a routine.
   */
  const routineKey =
    openKey !== null && open.document?.isFolder === true ? null : openKey;

  const select = useCallback((next: RoutinesFilter) => {
    setOpenKey(null);
    setFilter(next);
  }, []);

  const refused = useCallback((failure: unknown) => setFailure(explain(failure)), []);
  const done = useCallback(() => setFailure(null), []);

  // A folder that has gone must not leave the surface listing a place nobody
  // can reach. Not while the read is in flight: an empty answer is not the same
  // claim as *this folder is gone*.
  useEffect(() => {
    if (!("folder" in filter) || filter.folder === "") return;
    if (folders.isLoading) return;
    if (!mine.some((entry) => entry.path === filter.folder)) select(EVERYTHING);
  }, [filter, mine, folders.isLoading, select]);

  useApplied(intent, active, (key) => {
    const record = corpus.records.find((row) => row.key === key);
    // Shown where it actually is, so the row the ask names is one the surface
    // is drawing: archived routines are their own view, and a routine in a
    // folder is reached by opening that folder's branch.
    if (record?.archived === true) setFilter({ view: "archived" });
    else if (record?.folder) {
      setExpanded((was) => openTo(was, record.folder ?? ""));
      setFilter({ folder: record.folder });
    } else setFilter(EVERYTHING);
    setOpenKey(key);
  });

  const createRoutine = useCallback(
    (folder: string) => {
      void corpus.createRecord(KIND, folder).then((made) => {
        done();
        setJustCreated(made.key);
        setOpenKey(made.key);
        // Written straight away, so the routine is complete the moment it
        // exists. `enabled` is deliberately not among them: absent reads as
        // off, and off is what a routine starts as.
        void updateMemoryDocument(project.path, made.key, {
          fields: { every: "1h", agent: agents[0]?.id ?? "claude" },
        }).then(
          () => corpus.reload(),
          (bad: unknown) => {
            refused(bad);
            corpus.reload();
          },
        );
      }, refused);
    },
    [corpus, project.path, agents, refused, done],
  );

  /**
   * Switch one routine on or off, from the row it is drawn on.
   *
   * A write to the store rather than a draft, and that is the difference
   * between switching a routine on and having switched it on: the clock reads
   * the store. Left on the pause that text is written on, a switch flicked and
   * a window closed within the second was a routine somebody had turned on and
   * that was still off.
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
      select({ folder: path });
    },
    [project.path, folders, corpus, select, done],
  );

  const renameFolder = useCallback(
    async (from: string, name: string) => {
      const parent = parentFolder(from);
      const to = parent === "" ? name : `${parent}/${name}`;
      await renameMemoryFolder(project.path, from, to);
      done();
      folders.reload();
      corpus.reload();
      setExpanded((was) => openTo(was, to));
      select({ folder: to });
    },
    [project.path, folders, corpus, select, done],
  );

  /**
   * Open what the folder in view says about itself, writing it if it has said
   * nothing yet.
   *
   * There is no separate command for the second case: somebody who clicks an
   * empty description is asking to fill it in.
   */
  const describeFolder = useCallback(() => {
    if (!("folder" in filter) || filter.folder === "") return;
    void describeMemoryFolder(project.path, filter.folder, KIND).then(
      (document_) => {
        done();
        corpus.reload();
        folders.reload();
        setOpenKey(document_.key);
      },
      refused,
    );
  }, [project.path, filter, corpus, folders, refused, done]);

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
          const moved = to === "" ? folderName(from) : `${to}/${folderName(from)}`;
          if (moved === from) return;
          await renameMemoryFolder(project.path, from, moved);
        } else {
          return;
        }
        done();
        corpus.reload();
        folders.reload();
        if (to !== "") setExpanded((was) => openTo(was, to));
      } catch (bad) {
        refused(bad);
      }
    },
    [project.path, corpus, folders, refused, done],
  );

  const { runNow, ran, running } = useRunNow(project, open, routineKey);

  const state = useMemo<AreaState>(
    () => ({
      project,
      corpus,
      folders: mine,
      counts,
      perFolder,
      filter,
      select,
      expanded,
      setExpanded,
      openKey,
      open,
      routineKey,
      openRoutine: setOpenKey,
      closeRoutine: () => setOpenKey(null),
      folderInView,
      folderNote,
      agents,
      agentName: (id) => agents.find((one) => one.id === id)?.name ?? id,
      kindIcon: mark,
      kindMark: markName,
      failure,
      dismissFailure: done,
      justCreated,
      createRoutine,
      toggle,
      archive,
      askRemoval: setRemoving,
      askNewFolder: (parent) => setNamingFolder({ parent }),
      askRenameFolder: (folder) =>
        setNamingFolder({ parent: parentFolder(folder), renaming: folderName(folder) }),
      askRemoveFolder: setRemovingFolder,
      describeFolder,
      runNow,
      ran,
      running,
    }),
    [
      project,
      corpus,
      mine,
      counts,
      perFolder,
      filter,
      select,
      expanded,
      openKey,
      open,
      routineKey,
      folderInView,
      folderNote,
      agents,
      mark,
      markName,
      failure,
      done,
      justCreated,
      createRoutine,
      toggle,
      archive,
      describeFolder,
      runNow,
      ran,
      running,
    ],
  );

  // The row the removal sheet is about. Read from the list rather than held
  // when the command was chosen, so the sheet never asks about a record as it
  // stood a minute ago.
  const going =
    removing === null
      ? null
      : (corpus.records.find((record) => record.key === removing) ?? null);

  return (
    <Area.Provider value={state}>
      {/* Above the columns, because the drag that matters crosses them: a
          routine is picked up on the surface and lands on a folder in the
          navigator. */}
      <MoveArea onDrop={(target, payload) => void dropOn(target, payload)}>
        {children}
      </MoveArea>

      <RecordRemovalSheet
        open={going !== null}
        onOpenChange={(isOpen) => setRemoving(isOpen ? removing : null)}
        record={going}
        types={corpus.types}
        dependentsOf={corpus.dependentsOf}
        onDelete={async (keys) => {
          // The surface lets go before the record does, or it spends a render
          // drawing something that has been deleted.
          if (removing !== null && openKey === removing) setOpenKey(null);
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
          select(EVERYTHING);
          corpus.reload();
          folders.reload();
        }}
      />
    </Area.Provider>
  );
}

/**
 * Apply what the window is asking this area to show.
 *
 * Identity is the signal rather than the key: the same object is handed over
 * until the next ask, so asking twice for one routine is two objects and opens
 * it twice — somebody who wandered off and wants it back, not a duplicate.
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
 * The branches that have to be open for one folder to be visible.
 *
 * A row inside a closed branch is a selection nobody can see, so anything that
 * moves the selection into a folder opens the folder *and everything above it*.
 * Opening only the immediate parent left a new folder two levels down invisible
 * and the column apparently unchanged.
 */
function openTo(expanded: readonly string[], folder: string): readonly string[] {
  const wanted: string[] = [];
  let path = folder;
  while (path !== "") {
    const row = folderRow(path);
    if (!expanded.includes(row) && !wanted.includes(row)) wanted.push(row);
    path = parentFolder(path);
  }
  // The top is always the branch everything else is inside.
  if (!expanded.includes(ALL_ROW) && !wanted.includes(ALL_ROW)) wanted.push(ALL_ROW);
  return wanted.length === 0 ? expanded : [...expanded, ...wanted];
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
