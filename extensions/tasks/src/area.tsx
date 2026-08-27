"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  FolderRemovalSheet,
  FolderSheet,
  MoveArea,
  RecordRemovalSheet,
  createMemoryFolder,
  deleteMemoryFolder,
  describeMemoryFolder,
  explain,
  folderName,
  memoryFolderToll,
  moveMemoryDocument,
  parentFolder,
  renameMemoryFolder,
  renameSession,
  startSession,
  updateMemoryDocument,
  useAgentSession,
  useAppMenu,
  useDocument,
  useFolders,
  useLiveSessions,
  type AreaIntent,
  type AreaProviderProps,
  type Corpus,
  type MemoryRecord,
  type OpenDocument,
  type OpenProject,
} from "@sync-buzz/extension-api";

import {
  Area,
  type AreaState,
  type Conversation,
  type SelectedFolder,
  type Sent,
} from "./context";
import { useTasks, type TasksFilter } from "./filter";
import { ALL_ROW, folderRow, parentRow } from "./navigator";
import { CLOSED, KIND, brief, priorityOf, template, typeOf, type StatusId } from "./model";

/**
 * Tasks, as an area of the window.
 *
 * Three columns, because a task *is* a record and this window reads a record in
 * three: where the work is filed, the work itself, and what is true of the one
 * that is open. The area owns what is being shown — the selection, the open
 * task, which confirmation is up — and the window owns where the columns are.
 *
 * The sheets are rendered here rather than passed upward, so that selecting a
 * different area takes them away by unmounting rather than by anybody
 * remembering to clear them.
 */
export function TasksProvider({
  project,
  active,
  intent,
  children,
}: AreaProviderProps & { children?: ReactNode }) {
  const [filter, setFilter] = useState<TasksFilter>({ view: "all" });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<readonly string[]>([ALL_ROW]);
  const [hidden, setHidden] = useState<readonly StatusId[]>(() => held(project.path));
  const [failure, setFailure] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  // Which task a deletion has been asked about, by key. The sheet is the only
  // way one is removed: deleting a record is a transaction nothing in this
  // window undoes, and until now this section did it on a single click.
  const [removing, setRemoving] = useState<string | null>(null);
  const [removingFolder, setRemovingFolder] = useState<string | null>(null);
  // Where a folder was asked for. `renaming` carries the folder's current name
  // when this is a rename, which is the same question with an answer already in
  // the field.
  const [makingFolder, setMakingFolder] = useState<{
    parent: string;
    renaming?: string;
  } | null>(null);

  const corpus = useTasks(project.path, filter, active);
  const open = useDocument(project.path, openKey);
  // The hierarchy, beside the corpus rather than inside it, keyed to the same
  // revision so the tree and the list on screen describe one moment.
  const folders = useFolders(project.path, KINDS, corpus.revision, active);

  const selectedFolder = useMemo<SelectedFolder | null>(() => {
    if (!("folder" in filter)) return null;
    const held = folders.byKind
      .get(KIND)
      ?.find((entry) => entry.path === filter.folder);
    return { path: filter.folder, describedBy: held?.describedBy ?? null };
  }, [filter, folders.byKind]);
  // What that folder says about itself. It is not in the page the workspace
  // shows — the engine leaves the record that is a folder out of listings — so
  // it is a read of its own.
  const folderNote = useDocument(project.path, selectedFolder?.describedBy ?? null);

  // A task that was deleted, or a project that answered without it, must not
  // leave the other two columns drawing a record nobody can reach.
  useEffect(() => {
    if (
      openKey !== null &&
      !corpus.isLoading &&
      open.document === null &&
      open.error !== null
    ) {
      setOpenKey(null);
    }
  }, [corpus.isLoading, open.document, open.error, openKey]);

  // A write that landed changed a row the list is holding, so the list is asked
  // again — while the task is still open, which is what keeps the way back from
  // showing a stale row.
  const saved = open.save.status === "saved";
  const reload = corpus.reload;
  useEffect(() => {
    if (saved) reload();
  }, [saved, reload]);

  /**
   * Close the open task: write it, and ask the store for the list again.
   *
   * Both halves are needed and they answer different halves of the same
   * failure. A task left within the save delay had not been written yet, so the
   * store still holds it under its key with no title. And a list read before
   * any of that is a list from before it.
   */
  const closeTask = useCallback(() => {
    if (openKey === null) return;
    setOpenKey(null);
    void open.write().then(() => corpus.reload(), () => undefined);
  }, [corpus, open, openKey]);

  const select = useCallback(
    (next: TasksFilter) => {
      // Opening a different folder closes whatever task is open: the list is
      // what the window is answering, and a task left behind from the last
      // folder would be answering the previous question.
      closeTask();
      setFilter(next);
    },
    [closeTask],
  );

  useApplied(intent, active, (key) => setOpenKey(key));

  const createTask = useCallback(() => {
    // Where the person is standing. A task written while a folder is open
    // belongs in that folder — anywhere else is the window forgetting what the
    // column beside it is showing.
    const here = "folder" in filter ? filter.folder : undefined;
    void (async () => {
      try {
        const made = await corpus.createRecord(KIND, here);
        // The sections are what make a task checkable, so a new one arrives
        // with them standing empty rather than as a blank page somebody has to
        // remember the shape of. Written before it is opened, in the project's
        // own language: the record is complete the moment anybody sees it.
        await updateMemoryDocument(project.path, made.key, {
          content: template(project.language),
        });
        setFailure(null);
        corpus.reload();
        folders.reload();
        setOpenKey(made.key);
        setJustCreated(made.key);
      } catch (refused) {
        setFailure(explain(refused));
      }
    })();
  }, [corpus, filter, folders, project.language, project.path]);

  const archive = useCallback(
    (record: MemoryRecord) => {
      void (async () => {
        try {
          await updateMemoryDocument(project.path, record.key, {
            archived: !record.archived,
          });
          setFailure(null);
          corpus.reload();
        } catch (refused) {
          setFailure(explain(refused));
        }
      })();
    },
    [corpus, project.path],
  );

  const deleteTasks = useCallback(
    async (keys: readonly string[]) => {
      // Anything typed into one of these was typed into a record that is about
      // to stop existing. It is dropped before the delete rather than after, so
      // a save already scheduled cannot land in between.
      keys.forEach(open.forget);
      await corpus.deleteRecords(keys);
      setFailure(null);
      if (openKey !== null && keys.includes(openKey)) setOpenKey(null);
      folders.reload();
    },
    [corpus, folders, open, openKey],
  );

  const askNewFolder = useCallback(
    (parent: string) => setMakingFolder({ parent }),
    [],
  );
  const askRenameFolder = useCallback(
    (folder: string) =>
      setMakingFolder({ parent: parentFolder(folder), renaming: folderName(folder) }),
    [],
  );

  /**
   * Make a folder, and show it.
   *
   * Thrown rather than swallowed: the sheet is still up and is what reports it.
   */
  const makeFolder = useCallback(
    async (parent: string, name: string) => {
      const path = parent === "" ? name : `${parent}/${name}`;
      await createMemoryFolder(project.path, path, KIND);
      setFailure(null);
      folders.reload();
      corpus.reload();
      // Opened, because somebody who just made a folder is about to put
      // something in it — and its parent, or the new row would be inside a
      // branch that is still closed.
      const branch = parentRow(path);
      setExpanded((rows) => (rows.includes(branch) ? rows : [...rows, branch]));
      select({ folder: path });
    },
    [corpus, folders, project.path, select],
  );

  /**
   * Rename a folder, carrying everything under it.
   *
   * One engine transaction. Keys do not change, so nothing that points at these
   * tasks breaks, and the selection follows the folder to its new path: a
   * person who just renamed the thing they were looking at is still looking at
   * it.
   */
  const renameFolder = useCallback(
    async (from: string, name: string) => {
      const parent = parentFolder(from);
      const to = parent === "" ? name : `${parent}/${name}`;
      await renameMemoryFolder(project.path, from, to);
      setFailure(null);
      folders.reload();
      corpus.reload();
      const was = folderRow(from);
      setExpanded((rows) =>
        rows.map((id) =>
          id === was
            ? folderRow(to)
            : id.startsWith(`${was}/`)
              ? folderRow(to) + id.slice(was.length)
              : id,
        ),
      );
      select({ folder: to });
    },
    [corpus, folders, project.path, select],
  );

  /**
   * Open what a folder has to say, writing it if it has said nothing yet.
   *
   * What opens is a document filed in the folder, so the selection moves there
   * first — a workspace still showing the whole register would be listing a
   * record that is not in the list it is showing.
   */
  const describeFolder = useCallback(
    (folder: string) => {
      void (async () => {
        try {
          const document = await describeMemoryFolder(project.path, folder, KIND);
          setFailure(null);
          setFilter({ folder });
          setOpenKey(document.key);
          corpus.reload();
          folders.reload();
        } catch (refused) {
          setFailure(explain(refused));
        }
      })();
    },
    [corpus, folders, project.path],
  );

  /**
   * Something was dropped on a row of the tree.
   *
   * Two payloads and one destination. A task is filed there; a folder is
   * renamed into it, which is the same engine operation as any other rename and
   * carries everything under it. The register's own row means no folder at all,
   * which is the only way to drag something back out of one.
   *
   * A folder dropped on itself or into its own subtree is refused here rather
   * than by the engine: it is the ordinary slip of the hand.
   */
  const dropOn = useCallback(
    (target: unknown, payload: unknown) => {
      const where = target as { folder?: string } | null;
      const what = payload as
        | { record?: string; folder?: { kind: string; path: string } }
        | null;
      if (where?.folder === undefined) return;
      const to = where.folder;
      void (async () => {
        try {
          if (what?.record !== undefined) {
            await moveMemoryDocument(project.path, what.record, to);
          } else if (what?.folder !== undefined) {
            const from = what.folder.path;
            if (to === from || to.startsWith(`${from}/`)) return;
            const moved = to === "" ? folderName(from) : `${to}/${folderName(from)}`;
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
      })();
    },
    [corpus, folders, project.path],
  );

  const toggleStatus = useCallback(
    (status: StatusId) => {
      setHidden((was) => {
        const next = was.includes(status)
          ? was.filter((entry) => entry !== status)
          : [...was, status];
        remember(project.path, next);
        return next;
      });
    },
    [project.path],
  );

  const showAllStatuses = useCallback(() => {
    setHidden([]);
    remember(project.path, []);
  }, [project.path]);

  // Every conversation running in this project, polled by the surface at its
  // own rate. Two things are read from it, and neither is available any other
  // way.
  const { sessions } = useLiveSessions(active);
  const mine = useMemo(
    () => sessions.filter((row) => row.cwd === project.path),
    [sessions, project.path],
  );

  const { send, sent, sending, handed } = useSend(project, open, openKey, corpus);

  /**
   * Re-read the register when an agent stops working.
   *
   * A task's status is written by whoever is doing the work — an agent through
   * the memory server, in another process — and this window has no way to be
   * told. It re-reads when it is opened and when the window comes back to the
   * front, which covers somebody switching to their editor and back, and misses
   * the case that matters most here: sitting in front of Tasks watching an agent
   * work. A turn ending is the cheapest honest signal that something may have
   * been written, so that is what this listens to. It is not a poll of the
   * store: nothing is re-read while nothing is happening.
   */
  const turns = mine.map((row) => `${row.key}:${row.status}`).join("|");
  useEffect(() => {
    if (turns === "") return;
    corpus.reload();
    folders.reload();
    // Only when a turn ends or begins, which is what `turns` changes on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns]);

  /**
   * The conversation one task was handed to, if this window opened one.
   *
   * The status comes from the live list rather than from what was true when the
   * button was pressed: a conversation that has finished has to stop saying it
   * is working, and nothing else would tell this column that it had.
   */
  const conversationOf = useCallback(
    (task: string): Conversation | null => {
      const held = handed.get(task);
      if (held === undefined) return null;
      const live = mine.find((row) => row.key === held.key);
      return { key: held.key, title: held.title, status: live?.status ?? null };
    },
    [handed, mine],
  );

  // The menu bar is the application's, and this area is what can write
  // something while it is selected, so this is where File gets `⌘N`. Naming a
  // type is not offered: the types this section reads are its package's, and a
  // section that let somebody add one would be adding it to Records.
  useAppMenu(
    {
      selected: { kind: KIND, title: "Task" },
      createRecord: () => createTask(),
      createType: null,
      table: null,
    },
    active,
  );

  // The row a deletion was asked about. The confirmation needs the row rather
  // than the key: it draws what is about to go.
  const removingRecord =
    removing === null
      ? null
      : (corpus.records.find((record) => record.key === removing) ??
        asRow(open.document, removing));

  const state = useMemo<AreaState>(
    () => ({
      project,
      corpus,
      folders,
      filter,
      select,
      openKey,
      open,
      openTask: setOpenKey,
      closeTask,
      justCreated,
      expanded,
      setExpanded,
      createTask,
      archive,
      askRemoval: setRemoving,
      askNewFolder,
      askRenameFolder,
      askRemoveFolder: setRemovingFolder,
      describeFolder,
      selectedFolder,
      folderNote,
      dropOn,
      hidden,
      toggleStatus,
      showAllStatuses,
      send,
      sent,
      sending,
      conversationOf,
      failure,
      dismissFailure: () => setFailure(null),
    }),
    [
      project,
      corpus,
      folders,
      filter,
      select,
      openKey,
      open,
      closeTask,
      justCreated,
      expanded,
      createTask,
      archive,
      askNewFolder,
      askRenameFolder,
      describeFolder,
      selectedFolder,
      folderNote,
      dropOn,
      hidden,
      toggleStatus,
      showAllStatuses,
      send,
      sent,
      sending,
      conversationOf,
      failure,
    ],
  );

  return (
    <Area.Provider value={state}>
      {/* Above the columns, because the drag that matters crosses them: a task
          leaves the workspace's list and lands on a folder in the navigator. */}
      <MoveArea onDrop={dropOn}>{children}</MoveArea>

      <RecordRemovalSheet
        open={removingRecord !== null}
        onOpenChange={(isOpen) => setRemoving(isOpen ? removing : null)}
        record={removingRecord}
        types={corpus.types}
        dependentsOf={corpus.dependentsOf}
        onDelete={deleteTasks}
      />

      <FolderSheet
        open={makingFolder !== null}
        onOpenChange={(isOpen) => setMakingFolder(isOpen ? makingFolder : null)}
        parent={makingFolder?.parent ?? ""}
        renaming={makingFolder?.renaming}
        onSubmit={async (name) => {
          if (!makingFolder) return;
          const { parent, renaming } = makingFolder;
          if (renaming === undefined) {
            await makeFolder(parent, name);
          } else {
            await renameFolder(parent === "" ? renaming : `${parent}/${renaming}`, name);
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
          setFailure(null);
          // The selection was on what just went, so it moves up to the
          // register — and so does anything of it that was open.
          if ("folder" in filter && filter.folder === folder) {
            setOpenKey(null);
            setFilter({ view: "all" });
          }
          corpus.reload();
          folders.reload();
        }}
      />
    </Area.Provider>
  );
}

/**
 * The kinds whose folders this area needs: its own, and only its own.
 *
 * A stable array, because it is a dependency of the read it drives — a fresh
 * one each render would be a read each render.
 */
const KINDS: readonly string[] = [KIND];

/**
 * A row for the record that is open but is not on the page.
 *
 * The confirmation draws a row, and the task being deleted may have been opened
 * from a folder the list has since moved off. Built from the document rather
 * than refused, so the sheet has something to show.
 */
function asRow(
  document: OpenDocument["document"],
  key: string,
): MemoryRecord | null {
  if (document === null || document.key !== key) return null;
  return {
    key: document.key,
    kind: document.kind,
    title: document.title,
    fields: document.fields,
    freshness: document.freshness,
    scope: document.scope,
    archived: document.archived,
    tags: document.tags,
    locator: document.locator,
    presence: document.presence,
    folder: document.folder,
    isFolder: document.isFolder,
  };
}

/**
 * Open what the window asked for.
 *
 * Identity is the signal rather than the key: the same object is handed over
 * until the next ask, so asking twice for one record is two objects and opens
 * it twice — somebody who wandered off and wants it back, not a duplicate to
 * swallow.
 */
function useApplied(
  intent: AreaIntent | null | undefined,
  active: boolean,
  show: (key: string) => void,
) {
  const [settled, setSettled] = useState<AreaIntent | null>(null);
  useEffect(() => {
    if (!active || !intent || intent === settled) return;
    if (intent.show === "record" && intent.kind === KIND) show(intent.key);
    setSettled(intent);
  }, [intent, settled, active, show]);
}

/**
 * Handing the open task to an agent.
 *
 * The same path Routines takes for a trial run, and for the same reason: there
 * is a window, a person watching, and the session layer the surface already
 * publishes — so this is an ordinary conversation, opened the way Chat opens
 * one, and it appears in Chat beside every other. That is also the answer to
 * *did it work*: there is something to read.
 *
 * Three writes in a fixed order, and the order is the whole of the care here.
 * The body is written first, so no agent is ever asked to act on a sentence
 * that is still only in this window. The status is written next, before a word
 * is said: the task has been handed over, and that is true whatever the agent
 * goes on to do — including refusing to start, which leaves a task honestly
 * marked as in progress with a conversation to read.
 */
function useSend(
  project: OpenProject,
  open: OpenDocument,
  task: string | null,
  corpus: Corpus,
) {
  const [pending, setPending] = useState<
    { key: string; text: string; title: string } | null
  >(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [sending, setSending] = useState(false);
  // Which conversation each task was handed to, for as long as this window is
  // open. Not written into the record: a session key names a process on this
  // machine in this run, and a record is what travels with the repository —
  // filing it there would put somebody else's dead session in everybody's
  // memory.
  const [handed, setHanded] = useState<ReadonlyMap<string, { key: string; title: string }>>(
    () => new Map(),
  );
  const session = useAgentSession(pending?.key ?? null);

  // The session object changes identity on every update it receives, so it is
  // read through a ref: an effect depending on it would send the brief again
  // each time the agent said something.
  const live = useRef(session);
  live.current = session;

  useEffect(() => {
    if (pending === null) return;
    let dropped = false;
    void live.current
      .prompt(pending.text)
      .then(
        () => {
          if (!dropped) {
            // Named, because "it is in Chat" is not an answer to *which one*.
            // The conversation was renamed to the task's own title before a
            // word was said, so this is what Chat lists it as.
            setSent({
              said: `Handed over. In Chat, as “${pending.title}”.`,
              failed: false,
            });
          }
        },
        (failure: unknown) => {
          if (!dropped) setSent({ said: explain(failure), failed: true });
        },
      )
      .finally(() => {
        if (!dropped) {
          setPending(null);
          setSending(false);
        }
      });
    return () => {
      dropped = true;
    };
  }, [pending]);

  const send = useCallback(() => {
    const document_ = open.draft ?? open.document;
    if (task === null || document_ === null) return;
    const body = (document_.content ?? "").trim();
    if (body.length === 0) {
      setSent({ said: "There is nothing to work on yet: the task has no body.", failed: true });
      return;
    }
    const fields = (document_.fields ?? {}) as Record<string, unknown>;
    const title = (document_.title ?? "").trim();
    const text = brief({
      key: task,
      title,
      body,
      status: "in_progress",
      type: typeOf(fields),
      priority: priorityOf(fields),
      // Where it is filed is the store's answer rather than the draft's: a
      // draft carries what somebody is typing, and a folder is not typed.
      folder: open.document?.folder ?? null,
    });

    const named = title.length > 0 ? title : "Task";

    setSending(true);
    setSent(null);
    void open
      .write()
      .then(() => startSession({ agentId: "claude", cwd: project.path }))
      .then(
        (opened: { key: string }) => {
          // Named before anything is said, because saying something is what
          // writes the pointer and the pointer records the title. Unnamed, the
          // conversation would be titled from the first words in it — which
          // here is a brief written to an agent, standing in a list of
          // sentences people typed.
          return renameSession(opened.key, named).then(
            () => opened.key,
            // A conversation that started under the wrong name is still a
            // conversation that started. The handover is what was asked for.
            () => opened.key,
          );
        },
        (failure: unknown) => {
          setSent({ said: explain(failure), failed: true });
          setSending(false);
          return null;
        },
      )
      .then((key: string | null) => {
        if (key === null) return;
        setHanded((was) => new Map(was).set(task, { key, title: named }));
        // Quiet on failure, and deliberately: the task is being worked on
        // either way, and a register one state behind is a smaller problem than
        // a handover refused because a field would not write.
        void updateMemoryDocument(project.path, task, {
          fields: { ...fields, status: "in_progress" },
        }).then(() => corpus.reload(), () => undefined);
        setPending({ key, text, title: named });
      });
  }, [open, project.path, task, corpus]);

  return { send, sent, sending, handed };
}

/** Which statuses this window is not listing, as this machine last left them. */
function held(project: string): readonly StatusId[] {
  // On the machine rather than in the repository: what somebody is looking at
  // is theirs, and a filter that travelled with the project would hide a
  // colleague's rows because of how this window was left. Closed by default,
  // because a register lists what is open.
  try {
    const stored = globalThis.localStorage?.getItem(slot(project));
    if (stored === null || stored === undefined) return CLOSED;
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? (parsed.filter((entry) => typeof entry === "string") as StatusId[])
      : CLOSED;
  } catch {
    return CLOSED;
  }
}

function remember(project: string, hidden: readonly StatusId[]): void {
  try {
    globalThis.localStorage?.setItem(slot(project), JSON.stringify(hidden));
  } catch {
    // A preference that could not be stored is a preference that lasts until
    // the window closes, which is not worth a message to anybody.
  }
}

const slot = (project: string) => `tasks.hidden-statuses:${project}`;
