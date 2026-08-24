"use client";

import type { MouseEvent, ReactNode } from "react";
import { Info, Plus } from "lucide-react";
import { KindMark, StateMark } from "@sync-buzz/extension-api";
import { PanelPlaceholder } from "@sync-buzz/extension-api";
import { UnmatchedFiles } from "@sync-buzz/extension-api";
import { Button } from "@sync-buzz/extension-api";
import { ScrollArea } from "@sync-buzz/extension-api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@sync-buzz/extension-api";
import {
  absenceLabel,
  type MemoryDocument,
  type MemoryFolder,
  type MemoryRecord,
  type MemoryType,
} from "@sync-buzz/extension-api";
import { typeName, type Corpus } from "@sync-buzz/extension-api";
import { useDragHandle } from "@sync-buzz/extension-api";
import type { RecordsFilter } from "./filter";
import { showNativeContextMenu } from "@sync-buzz/extension-api";

/**
 * The dominant surface.
 *
 * It shows the records the navigator's selected view is asking for, and nothing
 * else. Everything on it is read from the project's own memory: an empty list
 * means the project holds nothing of that type, which is a fact worth stating
 * plainly rather than filling in.
 */
export function Workspace({
  corpus,
  folder,
  note,
  filter,
  compose,
  onOpen,
  onArchive,
  onDelete,
  onDescribe,
  isFixed,
}: {
  corpus: Corpus;
  /** The folder being shown, when the selection is one. */
  folder: MemoryFolder | null;
  /** What that folder says about itself, once it has been read. */
  note: MemoryDocument | null;
  filter: RecordsFilter;
  /**
   * The kind this surface is showing, when it is showing one, and how to write
   * a record of it. The command belongs to the list it adds to, so it is here
   * rather than in the window's title bar or in the navigator's bottom bar.
   */
  compose: {
    type: MemoryType | null;
    onCreate: (kind: string) => void;
  };
  /** Open one record. The workspace hands over its whole surface to it. */
  onOpen: (key: string) => void;
  /** Archive or bring back one row, which is a write and a re-read. */
  onArchive: (record: MemoryRecord) => void;
  /** Ask to delete one row. The confirmation belongs to the window. */
  onDelete: (record: MemoryRecord) => void;
  /**
   * Open what this folder says about itself, writing it if it has said nothing
   * yet. There is no separate command for the second case: somebody who clicks
   * an empty description is asking to fill it in.
   */
  onDescribe: () => void;
  /**
   * Whether a row is one the window neither creates nor removes. Its menu shows
   * both commands disabled rather than leaving them out, the way the navigator's
   * type rows do for Sync's own type.
   */
  isFixed: (key: string, kind: string) => boolean;
}) {
  // Nothing is filtered here any more. The record that is a folder is not a
  // document filed in it, and the engine leaves it out of listings for the same
  // reason it leaves out type definitions — so every client gets that, once,
  // rather than each of them remembering to.
  const { records } = corpus;

  return (
    <section className="flex h-full min-w-0 flex-col bg-workspace">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator pr-1.5 pl-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">
          {viewName(filter, corpus.types)}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-fg-tertiary">
            {records.length} {records.length === 1 ? "claim" : "claims"}
            {corpus.hasMore ? " of more than these" : null}
          </span>
          <NewRecord {...compose} />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {folder ? <FolderNote note={note} onOpen={onDescribe} /> : null}
        {/* Above the list, and only where the window already gathers what is
            waiting on somebody. A file nothing could be matched to has no
            record, so it cannot be a row: it is a question, and it is asked
            where the other questions are. */}
        {"view" in filter && filter.view === "attention" ? (
          <UnmatchedFiles
            files={corpus.unmatched}
            types={corpus.types}
            onResolve={corpus.resolveUnmatched}
          />
        ) : null}
        <RecordList
          corpus={corpus}
          filter={filter}
          onOpen={onOpen}
          onArchive={onArchive}
          onDelete={onDelete}
          isFixed={isFixed}
        />
      </ScrollArea>
    </section>
  );
}

/**
 * The control that writes a record, beside the list it writes into.
 *
 * It is here and not in the window's title bar: Sync is not a text editor, and
 * a claim is not what the window exists to produce the way a message is in
 * Mail. It is here and not in the navigator's bottom bar for the older reason —
 * that bar acts on the source list itself, and a record is not one of the
 * project's types. What is left is the surface that lists records, which is
 * where macOS puts it when the command belongs to the content: the `+` beside a
 * list's title in Reminders.
 *
 * It acts on what the surface is showing, and it never asks. The header above
 * it names one kind, so `+` writes one of that kind and the tooltip says which;
 * a menu here would be asking a question the column has already answered. Where
 * the surface is showing a view rather than a kind — everything, or everything
 * that needs attention — there is no list to add to, and the control is
 * disabled the way a native one is over a smart list. Choosing a kind in the
 * navigator is what enables it, which is the same act the shortcut follows.
 */
function NewRecord({
  type,
  onCreate,
}: {
  type: MemoryType | null;
  onCreate: (kind: string) => void;
}) {
  // A type whose storage cannot be written is shown the same way as no type at
  // all: the button is there, and it is plainly not available. The engine
  // answers this before anything is attempted, so nothing here has to find out
  // by failing.
  if (type === null || !type.writable) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled
        aria-label="New record"
        className="text-fg-tertiary"
      >
        <Plus />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`New ${type.title}`}
          onClick={() => onCreate(type.kind)}
          className="text-fg-tertiary hover:text-fg"
        >
          <Plus />
        </Button>
      </TooltipTrigger>
      <TooltipContent>New {type.title}</TooltipContent>
    </Tooltip>
  );
}

/**
 * What a folder says about itself, above the things in it.
 *
 * A place rather than a command. Somebody looking at a folder can read what it
 * is for, and somebody who wants to say what it is for writes it here — there
 * is no verb to find in a menu first, and nothing to know about how it is
 * stored. What it opens is the ordinary editor, because what it opens is an
 * ordinary document; that this is *also* a `README.md` in an attached folder is
 * a fact about the repository rather than a step in this.
 *
 * A folder with nothing said about it shows the invitation quietly. It is not a
 * placeholder for missing data — most folders have nothing to say and are none
 * the worse for it — so it is one line, in the tertiary colour, and it does not
 * push the list down the page.
 */
function FolderNote({
  note,
  onOpen,
}: {
  /** What the folder says, or `null` while it has said nothing. */
  note: MemoryDocument | null;
  onOpen: () => void;
}) {
  // Its own first words, and its title only while it has none. A folder just
  // described has a title and an empty body, and a strip that said nothing at
  // all would look like the write had failed.
  const said = note && (firstLine(note.content) || note.title);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 border-b border-separator px-3 py-2 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover"
    >
      <Info aria-hidden="true" className="size-3.5 shrink-0 text-fg-tertiary" />
      <span
        className={
          said
            ? "min-w-0 flex-1 truncate text-sm text-fg-secondary"
            : "min-w-0 flex-1 truncate text-sm text-fg-tertiary"
        }
      >
        {said || "Say what this folder is for"}
      </span>
    </button>
  );
}

/**
 * The workspace is titled by what it is showing, not by the section it is in.
 *
 * A type is named the way its own definition names it, in the singular, because
 * that is the word the navigator was clicked on. The count beside it is what
 * says how many there are.
 */
export function viewName(
  filter: RecordsFilter,
  types: readonly MemoryType[],
): string {
  if ("kind" in filter) return typeName(types, filter.kind);
  return filter.view === "attention" ? "Needs attention" : "All claims";
}

/**
 * One source, many types.
 *
 * The claim itself is the widest thing on the row and is never truncated: it
 * is what the store holds, and an interface that abbreviates it to fit a column
 * is hiding the product to make room for its labels. The type and the freshness
 * state travel beside it as marks, so a row can be read at a glance and a whole
 * list can be scanned for the states that need attention.
 */
function RecordList({
  corpus,
  filter,
  onOpen,
  onArchive,
  onDelete,
  isFixed,
}: {
  corpus: Corpus;
  filter: RecordsFilter;
  onOpen: (key: string) => void;
  onArchive: (record: MemoryRecord) => void;
  onDelete: (record: MemoryRecord) => void;
  isFixed: (key: string, kind: string) => boolean;
}) {
  const iconFor = new Map(
    corpus.types.map((type) => [type.kind, type.icon] as const),
  );
  const { types, records } = corpus;

  if (records.length === 0) {
    return (
      <div className="p-6">
        <PanelPlaceholder {...emptyState(corpus, filter)} />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-separator">
      {records.map((record) => (
        <li key={record.key}>
          <RecordRow
            record={record}
            onOpen={onOpen}
            // The system draws the menu for the secondary button, and everything
            // in it is reachable another way: opening the row is what a click
            // does, and the two writes are in the open record's own header. Title
            // case, because a native menu keeps that convention.
            onContextMenu={(event) =>
              showNativeContextMenu(event, [
                { label: "Open", onSelect: () => onOpen(record.key) },
                "separator",
                {
                  label: record.archived ? "Bring Back" : "Archive",
                  enabled: !isFixed(record.key, record.kind),
                  onSelect: () => onArchive(record),
                },
                {
                  label: "Delete",
                  enabled: !isFixed(record.key, record.kind),
                  onSelect: () => onDelete(record),
                },
              ])
            }
          >
            <KindMark icon={iconFor.get(record.kind)} className="mt-px" />
            <span className="min-w-0 flex-1">
              <span className="block text-base text-fg">{title(record)}</span>
              <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-fg-tertiary">
                <span className="shrink-0">
                  {typeName(types, record.kind)}
                </span>
                {record.archived ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">archived</span>
                  </>
                ) : null}
                {/* A document this branch does not have is shown, not hidden:
                    the record is real, its links still resolve, and the file is
                    simply somewhere this checkout is not. Saying which of the
                    two absences it is matters — one is another branch's
                    document, the other is a deletion somebody made here. */}
                {record.presence === "present" ? null : (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0 text-fg-secondary">
                      {absenceLabel(record.presence)}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="truncate font-mono">{location(record)}</span>
              </span>
            </span>
            <StateMark freshness={record.freshness} className="mt-1 shrink-0" />
          </RecordRow>
        </li>
      ))}
    </ul>
  );
}

/**
 * One row, and the only place a hook may be called per record.
 *
 * A component rather than a branch of the loop above, because `useDragHandle`
 * is a hook and a list whose rows come and go would call a different number of
 * them on every render.
 *
 * Dragged onto a folder in the navigator to file it there. What the payload
 * means is decided where the drop is handled; this row only says what it is.
 */
function RecordRow({
  record,
  onOpen,
  onContextMenu,
  children,
}: {
  record: MemoryRecord;
  onOpen: (key: string) => void;
  onContextMenu: (event: MouseEvent) => void;
  children: ReactNode;
}) {
  const drag = useDragHandle(`record:${record.key}`, { record: record.key });

  return (
    <button
      {...drag}
      type="button"
      onClick={() => onOpen(record.key)}
      onContextMenu={onContextMenu}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover data-[dragging=true]:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * A record with no title is shown by its key.
 *
 * The key is what the store is asked for it, so it is a name rather than a
 * placeholder — and a blank row would be the interface hiding a record the
 * project genuinely holds.
 */
function title(record: MemoryRecord): string {
  return record.title.trim() || record.key;
}

/**
 * Where the record is, in one line.
 *
 * For a document whose content is a file that is the file: it is the answer to
 * "where do I find this", and the person reading the row can open it in their
 * own editor. For everything else it is the scope — the paths that turn the
 * claim stale when the code under them moves — which is the only location a
 * record kept in `refs` has.
 */
function location(record: MemoryRecord): string {
  if (record.locator !== null) return record.locator;
  return record.scope.length > 0 ? record.scope.join(", ") : "—";
}


function emptyState(
  corpus: Corpus,
  filter: RecordsFilter,
): { headline: string; detail?: string } {
  if (corpus.error) {
    return {
      headline: "The project's memory could not be read.",
      detail: corpus.error,
    };
  }
  if (corpus.isLoading) {
    return { headline: "Reading the project's memory…" };
  }
  if ("view" in filter && filter.view === "attention") {
    return {
      headline: "Nothing has stopped matching the code.",
      detail:
        "Records land here when the code under their scope moves, which is the one thing worth interrupting for.",
    };
  }
  if ("kind" in filter) {
    return {
      headline: `The project holds nothing of type ${typeName(corpus.types, filter.kind)} yet.`,
      detail:
        "Types the project has not used are still listed, so their absence is visible rather than missing.",
    };
  }
  // An empty list has two different causes and they must not read the same: a
  // project that has said nothing, and a window told not to list the types it
  // said it in.
  if (corpus.hidden.length > 0) {
    return {
      headline: "Nothing in the types this window lists.",
      detail: `${corpus.hidden.length} of the project's types are hidden — the filter in the navigator's header brings them back.`,
    };
  }
  return {
    headline: "The project has not stated anything yet.",
    detail:
      "Its types are published and ready; what it knows about itself is written as the work happens.",
  };
}

/**
 * The opening line of a body, for a strip one line tall.
 *
 * Markdown's own marks are stepped over rather than rendered: a description
 * beginning `# API guides` says "API guides" to a person, and showing the hash
 * would be the window quoting syntax at them.
 */
function firstLine(content: string): string {
  const line = content
    .split("\n")
    .map((text) => text.replace(/^#+\s*/, "").trim())
    .find((text) => text !== "");
  return line ?? "";
}
