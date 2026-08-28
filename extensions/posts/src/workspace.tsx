"use client";

import { useMemo, type MouseEvent, type ReactNode } from "react";

import { ChevronLeft, Plus } from "lucide-react";

import {
  Button,
  DocumentView,
  KindMark,
  Markdown,
  PanelPlaceholder,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  showNativeContextMenu,
  type MemoryRecord,
} from "@sync-buzz/extension-api";

import { useArea } from "./context";
import { sliceName } from "./filter";
import {
  channel,
  channelLabel,
  channelOf,
  identifierOf,
  sentAtOf,
  visibilityLabel,
  visibilityOf,
  when,
} from "./model";

/**
 * The list, and one post when one is open.
 *
 * The dominant surface. A post's first words are the widest thing on a row and
 * are never truncated to a phrase: what is being decided here is whether a
 * sentence is worth saying to strangers, and an interface that abbreviates it
 * has hidden the only thing anybody is judging.
 */
export function PostsWorkspace() {
  const area = useArea();

  return (
    <div className="flex h-full min-w-0 flex-col">
      <Banner
        message={area.failure}
        lead="That did not happen."
        failed
        onDismiss={area.dismissFailure}
      />
      <Banner
        message={area.sent?.said ?? null}
        lead={area.sent?.failed === true ? "It was not handed over." : "Handed over."}
        failed={area.sent?.failed === true}
        onDismiss={area.dismissSent}
      />

      {area.openKey === null ? (
        <List />
      ) : area.openIsPublication ? (
        <Published />
      ) : (
        <DocumentView
          open={area.open}
          icon="square-pen"
          note="What somebody outside this project will read. No headings, no record keys, no internal names — say what changed and why it matters to them. Which network it is for, and how much room is left in it, are beside this."
          onBack={area.closePost}
          backLabel={sliceName(area.slice)}
          onArchive={() => {
            if (area.open.draft === null) return;
            area.open.edit({ archived: !area.open.draft.archived });
            void area.open.write();
          }}
          onDelete={() => area.askRemoval(area.openKey)}
          justCreated={area.justCreated !== null && area.justCreated === area.openKey}
        />
      )}
    </div>
  );
}

/**
 * Something already said, shown as text rather than in an editor.
 *
 * **The one screen in this section with nothing to type into, and that is the
 * whole point of it.** A publication is an account of something that happened
 * outside this window; an editor over it would offer to change a thing that
 * cannot be changed, and whoever used the offer would end up with a record
 * disagreeing with the post it is the record of. What is offered instead is
 * reading it, and the record's own controls for taking it out of the lists.
 */
function Published() {
  const area = useArea();
  const document_ = area.open.document;

  if (document_ === null) {
    return (
      <section className="flex h-full min-w-0 flex-col bg-workspace">
        <div className="p-6">
          <PanelPlaceholder
            {...(area.open.error === null
              ? { headline: "Reading it…" }
              : {
                  headline: "This post could not be read.",
                  detail: area.open.error,
                })}
          />
        </div>
      </section>
    );
  }

  const within = channel(channelOf(document_.fields));
  const identifier = identifierOf(document_.fields);
  const visibility = visibilityLabel(within, visibilityOf(document_.fields));

  return (
    <section className="flex h-full min-w-0 flex-col bg-workspace">
      <div className="flex h-(--panel-header-height) shrink-0 items-center gap-1 border-b border-separator pr-1.5 pl-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={area.closePost}
          className="shrink-0 gap-1 text-fg-secondary hover:text-fg"
        >
          <ChevronLeft />
          {sliceName(area.slice)}
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
          {document_.title.trim() || document_.key}
        </h2>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="prose-surface mx-auto w-full max-w-(--prose-measure) px-6 py-5">
          {/* Said once, above the text: what follows is not this window's
              copy of a post, it is the post. Without it a reader has no way to
              tell this apart from a draft that happens not to be editable. */}
          <p className="mb-4 text-xs text-fg-tertiary">
            Sent to {channelLabel(channelOf(document_.fields))}{" "}
            {when(sentAtOf(document_.fields))}
            {visibility === "" ? null : ` · ${visibility}`}
            {identifier === "" ? null : (
              <>
                {" · "}
                <span className="font-mono">{identifier}</span>
              </>
            )}
          </p>
          <Markdown>{document_.content}</Markdown>
        </div>
      </ScrollArea>
    </section>
  );
}

function List() {
  const area = useArea();
  const drafts = area.slice === "drafts";

  const rows = useMemo(
    () => area.corpus.records.filter((record) => !record.isFolder),
    [area.corpus.records],
  );

  return (
    <section className="flex h-full min-w-0 flex-col bg-workspace">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator pr-1.5 pl-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">
          {sliceName(area.slice)}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-fg-tertiary tabular-nums">
            {rows.length} {rows.length === 1 ? "post" : "posts"}
            {area.corpus.hasMore ? " of more than these" : null}
          </span>
          {/* Beside the list it joins, which is where macOS puts a command that
              belongs to the content. Only over the drafts: a publication is
              written by sending one, and a `+` here would offer to invent an
              account of something that never happened. */}
          {drafts ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New draft"
                  onClick={area.createDraft}
                  className="text-fg-tertiary hover:text-fg"
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New draft</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {rows.length === 0 ? (
          <div className="p-6">
            <PanelPlaceholder
              {...silence(area.corpus.error, area.corpus.isLoading, drafts)}
            />
          </div>
        ) : (
          <ul className="divide-y divide-separator">
            {rows.map((record) => (
              <li key={record.key}>
                <Row record={record} />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}

/**
 * One post, at the width of the window.
 *
 * A component rather than a branch of the loop above, so that what a row does
 * with hooks cannot depend on how many rows there are.
 */
function Row({ record }: { record: MemoryRecord }) {
  const area = useArea();
  const published = area.slice === "published";

  const menu = (event: MouseEvent) =>
    showNativeContextMenu(event, [
      { label: "Open", onSelect: () => area.openPost(record.key) },
      "separator",
      {
        label: record.archived ? "Bring Back" : "Archive",
        onSelect: () => area.archive(record),
      },
      { label: "Delete", onSelect: () => area.askRemoval(record.key) },
    ]);

  // What the row can say about itself, in the order it is worth reading. Built
  // as a list rather than as nested conditions, so the separators between them
  // cannot disagree with what is actually drawn.
  const within = channel(channelOf(record.fields));
  const facts: string[] = [];
  // The network leads, because it is the first thing that decides whether a
  // row is the one somebody is looking for — and on a draft that has not got
  // one, saying so is the most useful thing the line can carry.
  facts.push(within === null ? "No channel" : within.label);
  if (published) facts.push(when(sentAtOf(record.fields)));
  const visibility = visibilityLabel(within, visibilityOf(record.fields));
  if (visibility !== "") facts.push(visibility);
  if (record.tags.length > 0) facts.push(record.tags.slice(0, 3).join(", "));
  if (record.archived) facts.push("archived");

  return (
    <button
      type="button"
      onClick={() => area.openPost(record.key)}
      onContextMenu={menu}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover"
    >
      <KindMark icon={published ? "megaphone" : "square-pen"} className="mt-px" />
      <span className="min-w-0 flex-1">
        <span className="block text-base text-fg">{title(record)}</span>
        {facts.length === 0 ? null : (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-fg-tertiary">
            {facts.map((fact, at) => (
              <span key={fact} className="flex min-w-0 items-center gap-1.5">
                {at === 0 ? null : <span aria-hidden="true">·</span>}
                <span className="truncate">{fact}</span>
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * A post with no title is shown by its key.
 *
 * A draft is written before it is named — somebody types the post and the title
 * comes last, or never — so this is the ordinary case here rather than the
 * broken one, and the key is a name rather than a blank.
 */
function title(record: MemoryRecord): string {
  return record.title.trim() || record.key;
}

/**
 * Three different silences, said differently.
 *
 * A project that has never drafted anything and one that has said nothing yet
 * are not the same news, and neither is a store that would not answer.
 */
function silence(
  error: string | null,
  loading: boolean,
  drafts: boolean,
): { headline: string; detail?: string } {
  if (error !== null) {
    return { headline: "The project's memory could not be read.", detail: error };
  }
  if (loading) return { headline: "Reading the project's memory…" };
  if (drafts) {
    return {
      headline: "Nothing drafted",
      detail:
        "A draft is something this project is about to say outside itself, written where the work is so it can be assembled from what the project already knows. Sync delivers none of them: publishing hands a post to an agent, which reaches the network with a tool you connected to it.",
    };
  }
  return {
    headline: "Nothing has gone out from here",
    detail:
      "What is sent is kept as its own record, carrying the text exactly as it went — so what was said stays readable however the draft changes afterwards. These are written by whoever delivered a post, which is an agent rather than Sync.",
  };
}

/**
 * What a command that did not happen says for itself, and what one that did.
 *
 * One component for both because they occupy the same strip and must not be
 * able to appear in two different shapes; `failed` is what decides the word and
 * the colour, so a success can never be drawn in the voice of a refusal.
 */
function Banner({
  message,
  lead,
  failed,
  onDismiss,
}: {
  message: string | null;
  lead: string;
  failed: boolean;
  onDismiss: () => void;
}): ReactNode {
  if (message === null) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-separator bg-panel px-3 py-2">
      <p className="min-w-0 flex-1 text-xs text-fg-secondary">
        <span className={failed ? "font-medium text-danger" : "font-medium text-fg"}>
          {lead}
        </span>{" "}
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onDismiss} className="shrink-0">
        Dismiss
      </Button>
    </div>
  );
}
