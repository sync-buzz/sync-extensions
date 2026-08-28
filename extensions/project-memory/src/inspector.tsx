"use client";

import { useMemo, type ReactNode } from "react";

import {
  PanelBody,
  PanelHeader,
  PanelSurface,
  StateMark,
} from "@sync-buzz/extension-api";

import { useArea } from "./context";
import {
  STATUSES,
  asked,
  chosenOf,
  isAnswered,
  multiOf,
  optionsOf,
  statusOf,
} from "./model";

/**
 * What is true *of* the open question, and nothing that answers it.
 *
 * The controls that settle a question are in the workspace, deliberately: this
 * column collapses, and below a certain window width it cannot be opened at
 * all — so a section whose one act lived here would be a section that stops
 * working when the window is narrow. What is here is what a person wants to
 * know *before* answering and cannot see from the question itself: how far it
 * has got, whether the claim it rests on still matches the code, and whether it
 * was asked well enough to answer at all.
 */
export function QuestionsInspector() {
  const area = useArea();
  const document_ = area.open.draft ?? area.open.document;

  // With nothing open this column describes the section rather than one
  // question, which is what the shell's own panel does when no record is open.
  if (area.openKey === null || document_ === null) {
    return (
      <PanelSurface className="bg-panel">
        <PanelHeader title="Questions" />
        <PanelBody className="space-y-5">
          <Summary />
        </PanelBody>
      </PanelSurface>
    );
  }

  const fields = document_.fields;
  const status = statusOf(fields);
  const options = optionsOf(fields);
  const chosen = chosenOf(fields);
  const stored = area.open.document;
  const written = asked({
    title: document_.title,
    body: document_.content,
    links: document_.links,
    scope: document_.scope,
    options,
  });

  return (
    <PanelSurface className="bg-panel">
      {/* Each column's header says something different: the navigator names the
          section, the workspace names what it is showing, and this one names
          what it describes. */}
      <PanelHeader title="Question" />
      <PanelBody className="space-y-5">
        <section className="space-y-2">
          <Label>State</Label>
          <p className="text-xs text-fg-secondary">
            {STATUSES.find((entry) => entry.id === status)?.note}
          </p>
          {options.length === 0 ? null : (
            <p className="text-xs text-fg-tertiary tabular-nums">
              {chosen.length} of {options.length} taken
              {multiOf(fields) ? ", more than one allowed" : ""}
            </p>
          )}
        </section>

        {stored === null ? null : (
          <section className="space-y-2">
            <Label>Freshness</Label>
            <p className="flex items-center gap-1.5 text-xs text-fg-secondary">
              <StateMark freshness={stored.freshness} />
              {/* The word beside the mark, always: the ring carries the state
                  for somebody who knows the vocabulary, and the word carries it
                  for everybody else. */}
              <span>{stored.freshness}</span>
            </p>
            {stored.freshness === "stale" || stored.freshness === "invalid" ? (
              <p className="text-xs text-warning">
                The code moved under what this question rests on. Read it before
                answering — the fork may not be the one being asked about any
                more.
              </p>
            ) : null}
          </section>
        )}

        <section className="space-y-2">
          <Label>How it was asked</Label>
          {written.faults.length === 0 ? (
            <p className="text-xs text-fg-tertiary">
              It says what it is about, what raised it, and what the choice is.
            </p>
          ) : (
            written.faults.map((fault) => (
              <p key={fault} className="text-xs text-warning">
                {fault}
              </p>
            ))
          )}
        </section>

        {document_.links.length === 0 ? null : (
          <section className="space-y-2">
            <Label>Links</Label>
            <dl className="space-y-1.5">
              {document_.links.map((link) => (
                <div key={`${link.relation}:${link.key}`} className="flex items-baseline gap-2">
                  <dt className="shrink-0 text-xs text-fg-tertiary">
                    {link.relation}
                  </dt>
                  <dd className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary">
                    {link.key}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {document_.tags.length === 0 ? null : (
          <section className="space-y-2">
            <Label>Tags</Label>
            <p className="text-xs text-fg-secondary">{document_.tags.join(", ")}</p>
          </section>
        )}
      </PanelBody>
    </PanelSurface>
  );
}

/**
 * What is true of the section as a whole, for the column that would otherwise
 * be empty.
 *
 * Both figures, including a zero: *Open 0* is the good news, and a summary that
 * hid it could not be read as an answer.
 */
function Summary() {
  const area = useArea();

  const counts = useMemo(() => {
    let open = 0;
    let answered = 0;
    for (const record of area.corpus.records) {
      if (record.isFolder) continue;
      if (isAnswered(record.fields)) answered += 1;
      else open += 1;
    }
    return { open, answered };
  }, [area.corpus.records]);

  return (
    <section className="space-y-2">
      <Label>This project</Label>
      <dl className="space-y-1.5">
        <div className="flex items-center gap-2">
          <dt className="min-w-0 flex-1 truncate text-xs text-fg-secondary">Open</dt>
          <dd className="shrink-0 font-mono text-xs text-fg-secondary tabular-nums">
            {counts.open}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
            Answered
          </dt>
          <dd className="shrink-0 font-mono text-xs text-fg-secondary tabular-nums">
            {counts.answered}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-fg-tertiary">
        {area.corpus.error !== null
          ? area.corpus.error
          : counts.open + counts.answered === 0
            ? "Nothing has been asked here yet. A question is raised by whoever is about to ask one, and answered in this section."
            : "Answering a question archives it, so what is counted as open is what is still waiting on somebody."}
      </p>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold text-fg-tertiary">{children}</h3>;
}
