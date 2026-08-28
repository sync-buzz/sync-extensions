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
  RecordRemovalSheet,
  explain,
  renameSession,
  startSession,
  updateMemoryDocument,
  useAgentSession,
  useDocument,
  type AreaIntent,
  type AreaProviderProps,
  type MemoryRecord,
  type OpenDocument,
  type OpenProject,
} from "@sync-buzz/extension-api";

import { brief } from "./brief";
import { Area, type AreaState, type Sent } from "./context";
import { usePosts, type SliceId } from "./filter";
import {
  DRAFT,
  EMPTY,
  PUBLICATION,
  channel,
  channelOf,
  unsendable,
  visibilityOf,
} from "./model";

/**
 * Posts, as an area of the window.
 *
 * Three columns, because a post *is* a record and this window reads a record in
 * three: which half of the section, the post itself, and what would happen if
 * it went out. The area owns what is being shown — the slice, the open post,
 * which confirmation is up — and the window owns where the columns are.
 *
 * The removal sheet is rendered here rather than passed upward, so that
 * selecting a different area takes it away by unmounting rather than by
 * anybody remembering to clear it.
 */
export function PostsProvider({
  project,
  active,
  intent,
  children,
}: AreaProviderProps & { children?: ReactNode }) {
  const [slice, setSlice] = useState<SliceId>("drafts");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Which record a deletion has been asked about, by key. The sheet is the only
  // way one is removed: deleting a record is a transaction nothing in this
  // window undoes.
  const [removing, setRemoving] = useState<string | null>(null);

  const { drafts, publications } = usePosts(project.path, active);
  const corpus = slice === "drafts" ? drafts : publications;
  const open = useDocument(project.path, openKey);

  const openIsPublication = open.document?.kind === PUBLICATION;

  // A record that was deleted, or a project that answered without it, must not
  // leave the other two columns drawing something nobody can reach.
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
  // again — while the post is still open, which is what keeps the way back from
  // showing a stale row.
  const saved = open.save.status === "saved";
  const reloadDrafts = drafts.reload;
  useEffect(() => {
    if (saved) reloadDrafts();
  }, [saved, reloadDrafts]);

  const { send, sending, sent, dismissSent, clearSent } = useSend(
    project,
    open,
    openIsPublication ? null : openKey,
  );

  /**
   * Close the open post: write it, and ask the store for the list again.
   *
   * Both halves are needed and they answer different halves of the same
   * failure. A draft left within the save delay had not been written yet, so
   * the store still holds it under its key with nothing in it. And a list read
   * before any of that is a list from before it.
   */
  const closePost = useCallback(() => {
    if (openKey === null) return;
    setOpenKey(null);
    clearSent();
    void open.write().then(() => drafts.reload(), () => undefined);
  }, [clearSent, drafts, open, openKey]);

  const select = useCallback(
    (next: SliceId) => {
      // Moving to the other half closes what is open: the list is what the
      // window is answering, and a draft left standing over the published list
      // would be answering the previous question.
      closePost();
      setSlice(next);
    },
    [closePost],
  );

  useApplied(intent, active, (key, kind) => {
    setSlice(kind === PUBLICATION ? "published" : "drafts");
    setOpenKey(key);
  });

  const createDraft = useCallback(() => {
    void (async () => {
      try {
        const made = await drafts.createRecord(DRAFT);
        // Empty on purpose — see `EMPTY`. Written anyway, so the record is
        // complete the moment anybody sees it rather than half-made.
        await updateMemoryDocument(project.path, made.key, { content: EMPTY });
        setFailure(null);
        clearSent();
        drafts.reload();
        setSlice("drafts");
        setOpenKey(made.key);
        setJustCreated(made.key);
      } catch (refused) {
        setFailure(explain(refused));
      }
    })();
  }, [clearSent, drafts, project.path]);

  const archive = useCallback(
    (record: MemoryRecord) => {
      void (async () => {
        try {
          await updateMemoryDocument(project.path, record.key, {
            archived: !record.archived,
          });
          setFailure(null);
          drafts.reload();
          publications.reload();
        } catch (refused) {
          setFailure(explain(refused));
        }
      })();
    },
    [drafts, project.path, publications],
  );

  const deletePosts = useCallback(
    async (keys: readonly string[]) => {
      // Anything typed into one of these was typed into a record that is about
      // to stop existing. It is dropped before the delete rather than after, so
      // a save already scheduled cannot land in between.
      keys.forEach(open.forget);
      await corpus.deleteRecords(keys);
      setFailure(null);
      if (openKey !== null && keys.includes(openKey)) setOpenKey(null);
    },
    [corpus, open, openKey],
  );

  const state = useMemo<AreaState>(
    () => ({
      project,
      slice,
      select,
      drafts,
      publications,
      corpus,
      openKey,
      open,
      openPost: (key: string) => {
        clearSent();
        setOpenKey(key);
      },
      closePost,
      openIsPublication,
      justCreated,
      createDraft,
      archive,
      askRemoval: setRemoving,
      send,
      sending,
      sent,
      dismissSent,
      failure,
      dismissFailure: () => setFailure(null),
    }),
    [
      archive,
      clearSent,
      closePost,
      corpus,
      createDraft,
      dismissSent,
      drafts,
      failure,
      justCreated,
      open,
      openIsPublication,
      openKey,
      project,
      publications,
      select,
      send,
      sending,
      sent,
      slice,
    ],
  );

  return (
    <Area.Provider value={state}>
      {children}
      <RecordRemovalSheet
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
        record={rowFor(corpus.records, open.document, removing)}
        types={corpus.types}
        dependentsOf={corpus.dependentsOf}
        onDelete={deletePosts}
      />
    </Area.Provider>
  );
}

/**
 * Handing a post to an agent, which is the whole of what publishing is here.
 *
 * The same path Tasks takes to hand over a task, and for the same reasons:
 * there is a window, a person watching, and the session layer the surface
 * already publishes — so this is an ordinary conversation, opened the way Chat
 * opens one, and it appears in Chat beside every other. That is also the answer
 * to *did it work*: there is something to read.
 *
 * **Nothing is written to the record here.** Tasks moves its task to
 * `in_progress` on handover; a post has no such state, and inventing one would
 * be this window claiming a post is on its way when all that happened is that
 * somebody was asked. What was said and when is the publication record, and the
 * agent writes it — after the post exists, which is the only moment anybody can
 * honestly write it.
 */
function useSend(
  project: OpenProject,
  open: OpenDocument,
  draft: string | null,
): {
  send: () => void;
  sending: boolean;
  sent: Sent | null;
  dismissSent: () => void;
  clearSent: () => void;
} {
  const [pending, setPending] = useState<
    { key: string; text: string; title: string } | null
  >(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [sending, setSending] = useState(false);
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
            setSent({
              said: `Handed to an agent. In Chat, as “${pending.title}”.`,
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
    if (draft === null || document_ === null) return;

    const text = document_.content ?? "";
    const within = channel(channelOf(document_.fields));
    // Asked here as well as under the button, and the same function answers
    // both: a draft the window offered to send has to be one the brief accepts.
    const stopped = unsendable(within, text);
    if (stopped !== null || within === null) {
      setSent({ said: stopped ?? "This draft cannot be sent.", failed: true });
      return;
    }

    const title = (document_.title ?? "").trim();
    const named = title.length > 0 ? title : `Post to ${within.label}`;
    const text_ = brief({
      key: draft,
      text,
      channel: within,
      visibility: visibilityOf(document_.fields),
    });

    setSending(true);
    setSent(null);
    void open
      .write()
      // The agent this window raises, as Tasks raises one: the machine's
      // Claude. Which agents exist at all is a fact about this machine rather
      // than about this package, and choosing between them is a question the
      // section does not yet ask.
      .then(() => startSession({ agentId: "claude", cwd: project.path }))
      .then(
        (opened) =>
          // Named before anything is said, because saying something is what
          // writes the pointer and the pointer records the title. Unnamed, the
          // conversation would be titled from the first words in it — which
          // here is a brief written to an agent, standing in a list of
          // sentences people typed.
          renameSession(opened.key, named).then(
            () => opened.key,
            // A conversation that started under the wrong name is still a
            // conversation that started. The handover is what was asked for.
            () => opened.key,
          ),
        (failure: unknown) => {
          setSent({ said: explain(failure), failed: true });
          setSending(false);
          return null;
        },
      )
      .then((key: string | null) => {
        if (key === null) return;
        setPending({ key, text: text_, title: named });
      });
  }, [draft, open, project.path]);

  return {
    send,
    sending,
    sent,
    dismissSent: useCallback(() => setSent(null), []),
    clearSent: useCallback(() => setSent(null), []),
  };
}

/**
 * The record a confirmation is about, wherever it can be found.
 *
 * The page first, and the open document after it: a post may have been opened
 * from the half of the section the list has since moved off, and a sheet with
 * nothing to show is a sheet asking somebody to confirm a blank.
 */
function rowFor(
  rows: readonly MemoryRecord[],
  document: OpenDocument["document"],
  key: string | null,
): MemoryRecord | null {
  if (key === null) return null;
  const listed = rows.find((record) => record.key === key);
  if (listed !== undefined) return listed;
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
 *
 * Both kinds are answered. This section opens two, and an intent naming a
 * publication that landed on the drafts list would open a record the list it
 * is standing over does not contain.
 */
function useApplied(
  intent: AreaIntent | null | undefined,
  active: boolean,
  show: (key: string, kind: string) => void,
) {
  const [settled, setSettled] = useState<AreaIntent | null>(null);
  useEffect(() => {
    if (!active || !intent || intent === settled) return;
    if (intent.show === "record" && (intent.kind === DRAFT || intent.kind === PUBLICATION)) {
      show(intent.key, intent.kind);
    }
    setSettled(intent);
  }, [intent, settled, active, show]);
}
