"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  RecordRemovalSheet,
  explain,
  updateMemoryDocument,
  useAppMenu,
  useDocument,
  type AreaIntent,
  type AreaProviderProps,
  type Dependent,
  type MemoryRecord,
  type OpenDocument,
} from "@sync-buzz/extension-api";

import { Area, type About, type AreaState } from "./context";
import { useQuestions, type QuestionsFilter } from "./filter";
import { KIND, answerOf, chosenOf, multiOf } from "./model";

/**
 * Questions, as an area of the window.
 *
 * The area owns what is being shown — which questions are listed, which one is
 * open, whether a confirmation is up — and the window owns where the columns
 * are. The sheet is rendered here rather than passed upward, so that selecting
 * a different area takes it away by unmounting rather than by anybody
 * remembering to clear it.
 */
export function QuestionsProvider({
  project,
  active,
  intent,
  children,
}: AreaProviderProps & { children?: ReactNode }) {
  const [filter, setFilter] = useState<QuestionsFilter>({ view: "open" });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Which question a deletion has been asked about, by key. The sheet is the
  // only way one is removed: deleting a record is a transaction nothing in this
  // window undoes.
  const [removing, setRemoving] = useState<string | null>(null);

  const corpus = useQuestions(project.path, active);
  const open = useDocument(project.path, openKey);
  const about = useAbout(project.path, open, corpus.dependentsOf);

  // A question that was deleted, or a project that answered without it, must
  // not leave the other two columns drawing a record nobody can reach.
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
  // again — while the question is still open, which is what keeps the way back
  // from showing a stale row.
  const saved = open.save.status === "saved";
  const reload = corpus.reload;
  useEffect(() => {
    if (saved) reload();
  }, [saved, reload]);

  /**
   * Close the open question: write it, and ask the store for the list again.
   *
   * Both halves are needed and they answer different halves of the same
   * failure. Prose typed within the save delay had not been written yet, and a
   * list read before any of that is a list from before it.
   */
  const close = useCallback(() => {
    if (openKey === null) return;
    setOpenKey(null);
    void open.write().then(() => corpus.reload(), () => undefined);
  }, [corpus, open, openKey]);

  const select = useCallback(
    (next: QuestionsFilter) => {
      // Moving to another view closes what is open: the list is what the window
      // is answering, and a question left behind from the last view would be
      // answering the previous question.
      close();
      setFilter(next);
    },
    [close],
  );

  useApplied(intent, active, (key) => setOpenKey(key));

  /**
   * The fields as they stand, draft first.
   *
   * The draft is what somebody is part-way through saying; the document is what
   * the store holds. Reading the store while a draft exists would answer with
   * the sentence before the one on screen.
   */
  const fieldsNow = useCallback((): Record<string, unknown> => {
    const held = open.draft ?? open.document;
    return { ...((held?.fields ?? {}) as Record<string, unknown>) };
  }, [open.draft, open.document]);

  /** Write a patch at once, and put the list back in step with it. */
  const writeNow = useCallback(
    (patch: { fields?: Record<string, unknown>; archived?: boolean }) => {
      open.edit(patch);
      void open.write().then(() => corpus.reload(), () => undefined);
    },
    [corpus, open],
  );

  /**
   * Take an option, or take it back.
   *
   * **A single choice replaces; a multiple choice toggles.** That is the whole
   * of the difference between the two, and it is decided from the record rather
   * than from which control was drawn — the panel and the record cannot then
   * disagree about what pressing it meant.
   *
   * Written at once, which is the shell's rule for a discrete value and here is
   * also what keeps the list true: the rows are drawn from the store, not from
   * this window's draft.
   */
  const choose = useCallback(
    (option: string) => {
      const fields = fieldsNow();
      const taken = chosenOf(fields);
      const next = multiOf(fields)
        ? taken.includes(option)
          ? taken.filter((entry) => entry !== option)
          : [...taken, option]
        : taken.includes(option)
          ? []
          : [option];
      setFailure(null);
      writeNow({ fields: { ...fields, chosen: next } });
    },
    [fieldsNow, writeNow],
  );

  /**
   * Typing the prose half of an answer.
   *
   * Edited rather than written: the document hook writes on the same pause the
   * body is written on, and flushes when the record is left. A write per
   * keystroke would be a transaction per keystroke.
   */
  const writeAnswer = useCallback(
    (text: string) => {
      open.edit({ fields: { ...fieldsNow(), answer: text } });
    },
    [fieldsNow, open],
  );

  /**
   * Settle it.
   *
   * Two things in one act, because they are one decision: the status moves to
   * answered and the record is archived. A section for open questions that went
   * on listing the settled ones would be a list nobody can act on, and the
   * count on the section's row is what is still waiting — the host counts the
   * corpus and leaves archived records out of it, so this is also the only way
   * that number can be true. Nothing is lost: an archived record keeps every
   * link, is found by search, and is listed here under *Answered*.
   *
   * Refused when nothing was said. A question marked answered with no choice
   * and no sentence is worse than an open one — it is an open question that has
   * stopped asking.
   */
  const settle = useCallback(() => {
    const fields = fieldsNow();
    if (chosenOf(fields).length === 0 && answerOf(fields).trim() === "") {
      setFailure(
        "Nothing has been chosen and nothing written, so there is no answer to record.",
      );
      return;
    }
    setFailure(null);
    writeNow({ fields: { ...fields, status: "answered" }, archived: true });
  }, [fieldsNow, writeNow]);

  /** Put it back among the open ones, keeping everything that was said. */
  const reopen = useCallback(() => {
    setFailure(null);
    writeNow({ fields: { ...fieldsNow(), status: "open" }, archived: false });
  }, [fieldsNow, writeNow]);

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

  const deleteQuestions = useCallback(
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

  // The File menu is the application's, and this section writes nothing: a
  // question is raised by whoever is about to ask, which is an agent through
  // the memory server or a person in the section that makes records. Claimed
  // rather than left alone, because the menu is installed by whichever area
  // last asked and is not taken back when that area is left — so a section that
  // said nothing here would leave ⌘N writing into a section nobody is looking
  // at.
  useAppMenu(null, active);

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
      filter,
      select,
      openKey,
      open,
      openQuestion: setOpenKey,
      close,
      about,
      choose,
      writeAnswer,
      settle,
      reopen,
      archive,
      askRemoval: setRemoving,
      failure,
      dismissFailure: () => setFailure(null),
    }),
    [
      project,
      corpus,
      filter,
      select,
      openKey,
      open,
      close,
      about,
      choose,
      writeAnswer,
      settle,
      reopen,
      archive,
      failure,
    ],
  );

  return (
    <Area.Provider value={state}>
      {children}

      <RecordRemovalSheet
        open={removingRecord !== null}
        onOpenChange={(isOpen) => setRemoving(isOpen ? removing : null)}
        record={removingRecord}
        types={corpus.types}
        dependentsOf={corpus.dependentsOf}
        onDelete={deleteQuestions}
      />
    </Area.Provider>
  );
}

/**
 * What the open question is about, from the two directions a record says it.
 *
 * Forwards is the question's own links, and the first of them is read whole so
 * that the person answering has the thing itself in front of them rather than a
 * key. Backwards is what points at the question, which the engine already
 * holds and which is the half an asker most often leaves out — a task blocked
 * on an answer says so from its own side, and nothing was written on the
 * question at all.
 */
function useAbout(
  projectPath: string,
  open: OpenDocument,
  dependentsOf: (key: string) => Promise<{ links: readonly Dependent[] }>,
): About {
  const links = open.document?.links ?? [];
  // `references` first, because that is the relation this type declares for
  // *what it is about*; anything else the record carries is still a link worth
  // following and is listed beside it.
  const primaryKey =
    links.find((link) => link.relation === "references")?.key ??
    links[0]?.key ??
    null;
  const primary = useDocument(projectPath, primaryKey);

  const [incoming, setIncoming] = useState<readonly Dependent[]>([]);
  const key = open.document?.key ?? null;
  useEffect(() => {
    if (key === null) {
      setIncoming([]);
      return undefined;
    }
    let dropped = false;
    void dependentsOf(key).then(
      (held) => {
        if (!dropped) setIncoming(held.links);
      },
      () => {
        // A question drawn without its backlinks is a question drawn without
        // half its context, and it is still answerable. Nothing is said about
        // it: the panel shows what it has.
        if (!dropped) setIncoming([]);
      },
    );
    return () => {
      dropped = true;
    };
  }, [dependentsOf, key]);

  // The array is rebuilt on every render of the open document, so what this is
  // keyed to is what is in it. A block of state rebuilt each render would be a
  // new context value each render, and every column below it would redraw on
  // every keystroke.
  const written = links.map((link) => `${link.relation}\u0000${link.key}`).join("\u0001");
  return useMemo(
    () => ({
      primary: primary.document,
      loading: primaryKey !== null && primary.isLoading,
      others: links
        .filter((link) => link.key !== primaryKey)
        .map((link) => ({ ...link })),
      incoming,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary.document, primary.isLoading, primaryKey, incoming, written],
  );
}

/**
 * A row for the record that is open but is not on the page.
 *
 * The confirmation draws a row, and the question being deleted may have been
 * opened from a view the list has since moved off. Built from the document
 * rather than refused, so the sheet has something to show.
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
