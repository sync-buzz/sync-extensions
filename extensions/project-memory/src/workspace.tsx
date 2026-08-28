"use client";

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";

import { ArrowLeft, Check, CornerDownLeft, Link2 } from "lucide-react";

import {
  Button,
  KindMark,
  Markdown,
  PanelPlaceholder,
  ScrollArea,
  StateMark,
  showNativeContextMenu,
  typeName,
  type MemoryRecord,
} from "@sync-buzz/extension-api";

import { useArea } from "./context";
import type { QuestionsFilter } from "./filter";
import {
  answerOf,
  chosenOf,
  firstLines,
  isAnswered,
  multiOf,
  optionsOf,
  orphanedChoices,
  statusOf,
} from "./model";

/**
 * The questions, and one question when one is open.
 *
 * The dominant surface, because answering is what this section is for: a
 * question's title is the thing being asked, so it is the widest text on the
 * row and is never truncated, and the answer is given here rather than in a
 * panel beside it. What is true *of* the question — its state, its freshness,
 * whether it was asked well enough to answer — is the column to the right.
 */
export function QuestionsWorkspace() {
  const area = useArea();

  return (
    <div className="flex h-full min-w-0 flex-col bg-workspace">
      <ActionFailure message={area.failure} onDismiss={area.dismissFailure} />
      {area.openKey === null ? <Register /> : <OneQuestion />}
    </div>
  );
}

/** What the surface is showing, in the words its header says it in. */
function viewName(filter: QuestionsFilter): string {
  switch (filter.view) {
    case "open":
      return "Open questions";
    case "answered":
      return "Answered";
    default:
      return "All questions";
  }
}

function Register() {
  const area = useArea();

  const held = area.corpus.records.filter((record) => !record.isFolder);
  const rows = held.filter((record) => {
    if (area.filter.view === "all") return true;
    return statusOf(record.fields) === area.filter.view;
  });

  return (
    <section className="flex h-full min-w-0 flex-col">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator px-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">
          {viewName(area.filter)}
        </h2>
        <span className="shrink-0 text-xs text-fg-tertiary tabular-nums">
          {rows.length} {rows.length === 1 ? "question" : "questions"}
          {area.corpus.hasMore ? " of more than these" : null}
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {rows.length === 0 ? (
          <div className="p-6">
            <PanelPlaceholder
              {...silence(
                area.corpus.error,
                area.corpus.isLoading,
                held.length,
                area.filter,
              )}
            />
          </div>
        ) : (
          <ul className="divide-y divide-separator">
            {rows.map((record) => (
              <li key={record.key}>
                <QuestionRow record={record} />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}

/**
 * One question, at the width of the window.
 *
 * The title is never truncated: it is the thing being asked, and a list that
 * abbreviated it would be asking somebody to open every row to find out what
 * the questions are. Under it is what the row can say about itself without
 * opening the record — the key, whether it was a choice and whether the choice
 * has been made.
 */
function QuestionRow({ record }: { record: MemoryRecord }) {
  const area = useArea();
  const options = optionsOf(record.fields);
  const chosen = chosenOf(record.fields);
  const answered = isAnswered(record.fields);

  const menu = (event: MouseEvent) =>
    showNativeContextMenu(event, [
      { label: "Open", onSelect: () => area.openQuestion(record.key) },
      "separator",
      {
        label: record.archived ? "Bring Back" : "Archive",
        onSelect: () => area.archive(record),
      },
      { label: "Delete", onSelect: () => area.askRemoval(record.key) },
    ]);

  // What the row can say about itself, in the order it is worth reading. Built
  // as a list rather than as nested conditions so the separators between them
  // cannot disagree with what is drawn.
  //
  // The key leads because a key *is* the question's number: it is permanent, it
  // is what every conversation about it refers to, and it is what somebody
  // types to find this row again.
  const facts: string[] = [record.key];
  if (record.fields !== undefined) {
    if (options.length > 0) {
      facts.push(
        answered && chosen.length > 0
          ? chosen.join(", ")
          : `${options.length} options`,
      );
    } else if (!answered) {
      facts.push("in prose");
    }
  }
  if (record.tags.length > 0) facts.push(record.tags.slice(0, 3).join(", "));

  return (
    <button
      type="button"
      onClick={() => area.openQuestion(record.key)}
      onContextMenu={menu}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover"
    >
      {/* The mark this window draws every record of a kind with. One kind here,
          so it says nothing new — and that is not what it is for: it is the
          left edge every row starts at, which is what makes a list of
          differently sized titles read as a column rather than as paragraphs.
          Answered ones carry a tick instead, because the one thing somebody
          scanning a mixed list wants to know is which are still asking. */}
      {answered ? (
        <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-fg-tertiary" />
      ) : (
        <KindMark icon="circle-help" className="mt-px" />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={
            answered
              ? "block text-base text-fg-secondary"
              : "block text-base text-fg"
          }
        >
          {title(record)}
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-fg-tertiary">
          {facts.map((fact, at) => (
            <span key={fact} className="flex min-w-0 items-center gap-1.5">
              {at === 0 ? null : <span aria-hidden="true">·</span>}
              <span className={at === 0 ? "shrink-0 font-mono" : "truncate"}>
                {fact}
              </span>
            </span>
          ))}
        </span>
      </span>
      <StateMark freshness={record.freshness} className="mt-0.5 shrink-0" />
    </button>
  );
}

/** A question with no title is shown by its key, which is a name rather than a blank. */
function title(record: { title: string; key: string }): string {
  return record.title.trim() || record.key;
}

/**
 * One question, with what it is about above it and the way to settle it below.
 *
 * The order is the argument. Context first, because a question read on its own
 * is answered from whatever the reader happens to remember; then the question
 * itself; then the controls, which are the only thing on this screen that
 * writes anything.
 */
function OneQuestion() {
  const area = useArea();
  const document_ = area.open.draft ?? area.open.document;

  return (
    <section className="flex h-full min-w-0 flex-col">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator pr-3 pl-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={area.close}
          className="min-w-0 text-fg-secondary hover:text-fg"
        >
          <ArrowLeft />
          <span className="truncate">{viewName(area.filter)}</span>
        </Button>
        <span className="shrink-0 font-mono text-xs text-fg-tertiary">
          {area.openKey}
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {/* The column a person set for themselves, not a width chosen here. A
            question read on this surface is a record like any other, and one
            keeping its own measure would be the single document in the window
            that ignored what its reader decided about reading. */}
        <div className="mx-auto flex w-full max-w-(--prose-measure) flex-col gap-6 px-6 py-6">
          <About />

          {/* The question and whatever was written beside it, at the reader's
              size and face — so the title and everything `Markdown` sets in
              `em` move together when that size changes. It stops here: the
              block above and the controls below are the window speaking, and
              the window's own scale is not a preference.

              The title is set at the proportion a record's title is set at
              wherever one is read, and in `em` for the same reason it is there:
              it is a step in the scale rather than a size, so it stays that
              step whatever the base becomes. */}
          <div className="prose-surface max-w-none space-y-4">
            <h1 className="text-[1.85em] leading-tight font-semibold text-balance text-fg">
              {document_ === null
                ? "…"
                : document_.title.trim() || (area.openKey ?? "")}
            </h1>
            {document_ === null || document_.content.trim() === "" ? (
              <p className="text-[1em] text-fg-tertiary">
                Nothing was written beside the question, so what raised it and
                what each option costs are not on the record.
              </p>
            ) : (
              <div className="text-fg-secondary">
                <Markdown>{document_.content}</Markdown>
              </div>
            )}
          </div>

          <Answer key={area.openKey} />
        </div>
      </ScrollArea>
    </section>
  );
}

/**
 * What the question is about, above the question.
 *
 * Three sources and one block: the record it points at, read whole so that the
 * first lines of it are here rather than a key; whatever else it points at or
 * is pointed at by; and the code it is scoped to. A question with none of them
 * says so — that is a fault of how it was asked, and the person who has to
 * answer it is exactly who should be told.
 */
function About() {
  const area = useArea();
  const about = area.about;
  const document_ = area.open.document;
  const scope = document_?.scope ?? [];
  const nothing =
    about.primary === null &&
    !about.loading &&
    about.others.length === 0 &&
    about.incoming.length === 0 &&
    scope.length === 0;

  if (nothing) {
    return (
      <p className="rounded-(--radius-control) border border-separator px-3 py-2 text-xs text-warning">
        Nothing says what this question is about — no record is linked and no
        code is scoped. Whatever is answered here is answered from memory.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-(--radius-control) border border-separator bg-panel px-3 py-2.5">
      <h2 className="text-xs font-semibold text-fg-tertiary">About</h2>

      {about.loading ? (
        <p className="text-xs text-fg-tertiary">Reading what it points at…</p>
      ) : null}

      {about.primary === null ? null : (
        <div className="min-w-0">
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 flex-1 text-sm text-fg">
                {title(about.primary)}
              </span>
              <span className="shrink-0 text-xs text-fg-tertiary">
                {typeName(area.corpus.types, about.primary.kind)}
              </span>
            </p>
            {/* A few lines rather than the document. Enough to recognise what
                the question is about; anybody who needs the rest of it has the
                key and the section that reads it. */}
            <p className="mt-1 line-clamp-3 text-xs text-fg-secondary">
              {firstLines(about.primary.content, 3)}
            </p>
          </div>
        </div>
      )}

      {about.others.length === 0 ? null : (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-tertiary">
          <Link2 aria-hidden="true" className="size-3 shrink-0" />
          {about.others.map((link) => (
            <span key={link.key} className="font-mono">
              {link.key}
            </span>
          ))}
        </p>
      )}

      {about.incoming.length === 0 ? null : (
        <p className="text-xs text-fg-tertiary">
          Waiting on this:{" "}
          {about.incoming.map((entry, at) => (
            <span key={entry.key}>
              {at === 0 ? null : ", "}
              <span className="text-fg-secondary">{entry.title || entry.key}</span>
            </span>
          ))}
        </p>
      )}

      {scope.length === 0 ? null : (
        <p className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-xs text-fg-tertiary">
          {scope.map((path) => (
            <span key={path}>{path}</span>
          ))}
        </p>
      )}
    </section>
  );
}

/**
 * The only part of this screen that writes anything.
 *
 * Two halves, because an answer has two: which fork was taken, and why. The
 * options are the controls the asker offered — a set of them where more than
 * one may be taken, one of them where only one may — and the prose beside them
 * is what settled it. Either half alone is an answer; neither is not, and the
 * control that ends the question says so rather than recording a silence.
 *
 * **A choice is written the moment it is made.** That is the shell's rule for a
 * discrete value, and here it is also what makes the digits work: pressing `2`
 * has taken the second option before anybody has decided whether they are done.
 * What ends the question is the separate act below.
 */
function Answer() {
  const area = useArea();
  const document_ = area.open.draft ?? area.open.document;
  const fields = document_?.fields;
  const written = optionsOf(fields).join("\u0000");
  // Held still between renders, because it is what a listener is keyed to: a
  // fresh array each keystroke would take the digits off the window and put
  // them back on it while somebody was typing.
  const options = useMemo(() => (written === "" ? [] : written.split("\u0000")), [written]);
  const chosen = chosenOf(fields);
  const orphaned = orphanedChoices(fields);
  const multiple = multiOf(fields);
  const answered = isAnswered(fields);

  const [text, setText] = useState(() => answerOf(fields));

  // The digits, for somebody working down a list of questions rather than
  // reading one. They act on the same command the rows do, so nothing can be
  // chosen by keyboard that could not be chosen by mouse.
  const choose = area.choose;
  useEffect(() => {
    if (options.length === 0) return undefined;
    const press = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Not while somebody is writing the prose half. A `2` typed into a
      // sentence is a `2`, and a window that took it as a command would be
      // editing the record behind the caret.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || target?.isContentEditable) {
        return;
      }
      const at = Number.parseInt(event.key, 10);
      if (Number.isNaN(at) || at < 1 || at > options.length) return;
      event.preventDefault();
      choose(options[at - 1]);
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, [choose, options]);

  const nothingSaid = chosen.length === 0 && text.trim() === "";

  return (
    <section className="flex flex-col gap-3 border-t border-separator pt-5">
      <h2 className="text-xs font-semibold text-fg-tertiary">Answer</h2>

      {options.length === 0 ? null : (
        <div
          role={multiple ? "group" : "radiogroup"}
          aria-label="The options offered"
          className="flex flex-col gap-1.5"
        >
          {options.map((option, at) => {
            const taken = chosen.includes(option);
            return (
              <button
                key={option}
                type="button"
                role={multiple ? "checkbox" : "radio"}
                aria-checked={taken}
                onClick={() => area.choose(option)}
                className="flex w-full items-start gap-2.5 rounded-(--radius-control) border border-separator px-3 py-2.5 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover aria-checked:border-separator-strong aria-checked:bg-selected"
              >
                <span
                  aria-hidden="true"
                  className={
                    multiple
                      ? "mt-px flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-separator-strong"
                      : "mt-px flex size-4 shrink-0 items-center justify-center rounded-full border border-separator-strong"
                  }
                >
                  {taken ? <Check className="size-3 text-fg" /> : null}
                </span>
                <span className="min-w-0 flex-1 text-sm text-fg">{option}</span>
                {/* The digit that takes it. Shown rather than documented: a
                    shortcut nobody can see is a shortcut nobody uses. */}
                {at < 9 ? (
                  <span className="shrink-0 font-mono text-xs text-fg-tertiary tabular-nums">
                    {at + 1}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {orphaned.length === 0 ? null : (
        <p className="text-xs text-warning">
          {orphaned.length === 1 ? "An option" : "Options"} taken here{" "}
          {orphaned.length === 1 ? "is" : "are"} no longer offered:{" "}
          {orphaned.join(", ")}. The list was edited after somebody chose.
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">What settled it</span>
        <textarea
          value={text}
          rows={4}
          placeholder={
            options.length > 0
              ? "What settled it, in your own words. The choice above says which; this says why."
              : "The answer, in your own words."
          }
          onChange={(event) => {
            setText(event.target.value);
            area.writeAnswer(event.target.value);
          }}
          // What is typed here is the answer somebody will read back on this
          // same surface, so it is set the way they chose to read — not at the
          // scale of the controls around it. A field that wrote at one size and
          // was read at another would be the reasoning changing shape between
          // being given and being found.
          className="prose-surface w-full max-w-none resize-y rounded-(--radius-control) border border-separator-strong bg-raised px-2.5 py-2 text-fg placeholder:text-fg-tertiary"
        />
      </label>

      <div className="flex items-center gap-3">
        {answered ? (
          <Button variant="outline" size="sm" onClick={area.reopen}>
            Ask it again
          </Button>
        ) : (
          <Button size="sm" disabled={nothingSaid} onClick={area.settle}>
            <CornerDownLeft />
            Answer
          </Button>
        )}
        <p className="min-w-0 flex-1 text-xs text-fg-tertiary">
          {answered
            ? "Answered, so it is archived: out of the lists, still linked, still found by search."
            : nothingSaid
              ? "Choose one, or say what settles it."
              : "Answering archives it — the section lists what is still being asked."}
        </p>
        <Saving />
      </div>
    </section>
  );
}

/**
 * Whether what was typed has reached the store.
 *
 * Saving is not a button in this window, which puts the burden here: somebody
 * who typed a sentence and closed the lid has to have been told it landed. Four
 * words, in the tier the window keeps for what it is doing rather than for what
 * is true.
 */
function Saving(): ReactNode {
  const area = useArea();
  const save = area.open.save;

  if (save.status === "failed") {
    return <span className="shrink-0 text-xs text-danger">{save.message}</span>;
  }
  if (save.status === "saving") {
    return <span className="shrink-0 text-xs text-fg-tertiary">Saving…</span>;
  }
  if (save.status === "saved") {
    return <span className="shrink-0 text-xs text-fg-tertiary">Saved</span>;
  }
  return null;
}

/**
 * Three different silences, said differently.
 *
 * A project nobody has asked anything in, a view filtered down to nothing, and
 * a store that could not be read look identical, and only one of them is worth
 * doing something about.
 */
function silence(
  error: string | null,
  loading: boolean,
  total: number,
  filter: QuestionsFilter,
): { headline: string; detail?: string } {
  if (error !== null) {
    return { headline: "The project's memory could not be read.", detail: error };
  }
  if (loading) return { headline: "Reading the project's memory…" };
  if (total > 0) {
    return {
      headline:
        filter.view === "open" ? "Nothing is waiting on you" : "Nothing answered yet",
      detail:
        filter.view === "open"
          ? "Every question this project holds has been settled. What was decided is under Answered."
          : "The questions here are all still open.",
    };
  }
  return {
    headline: "No questions yet",
    detail:
      "A question is written by whoever is about to ask one — an agent before it asks you, or anybody writing a record. It is answered here, with what it is about beside it.",
  };
}

/**
 * What a command that did not happen says for itself.
 *
 * A write the store refused has to be visible where it was asked for. Answering
 * is one click and one answer, and without this the answer is a button that
 * appears to do nothing.
 */
function ActionFailure({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}): ReactNode {
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
