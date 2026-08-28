"use client";

import { useId, useMemo, type MouseEvent } from "react";

import { Info, Plus } from "lucide-react";

import {
  Button,
  DocumentView,
  PanelPlaceholder,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  folderName,
  showNativeContextMenu,
  useDragHandle,
  type MemoryRecord,
} from "@sync-buzz/extension-api";

import { useArea } from "./area";
import type { RoutinesFilter } from "./filter";
import { agentOf, enabledOf, enabledLabel, everyLabel, everyOf } from "./model";

/** What the surface is showing, in the words its header says it in. */
export function viewName(filter: RoutinesFilter): string {
  if ("view" in filter) {
    return filter.view === "archived" ? "Archived" : "All routines";
  }
  return folderName(filter.folder) || "All routines";
}

export function RoutinesWorkspace() {
  const area = useArea();

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ActionFailure message={area.failure} onDismiss={area.dismissFailure} />
      {area.openKey === null ? (
        <List />
      ) : (
        <DocumentView
          open={area.open}
          icon={area.open.document?.isFolder === true ? "folder" : "alarm-clock"}
          // A folder's own document is not a routine, so it is not told how to
          // be one. What it is for is the sentence above it.
          note={
            area.open.document?.isFolder === true
              ? "What belongs in this folder, in its own words. Whoever writes the next routine reads this to know whether it goes here."
              : "What an agent is told, every time. Write it for somebody competent who has not seen this project — and say what to do when there is nothing to report."
          }
          onBack={area.closeRoutine}
          backLabel={viewName(area.filter)}
          onArchive={() => {
            if (area.open.draft === null) return;
            area.open.edit({ archived: !area.open.draft.archived });
            void area.open.write().then(() => area.corpus.reload(), () => undefined);
          }}
          onDelete={() => area.askRemoval(area.openKey)}
          justCreated={area.justCreated !== null && area.justCreated === area.openKey}
        />
      )}
    </div>
  );
}

/**
 * The routines the navigator's selection is asking for, and nothing else.
 *
 * A list rather than a tree, because this is what a person reads rather than
 * where they stand. It is also the only place a row can carry a control: a
 * source list row is a name and a mark, and *whether this runs* is a decision
 * somebody makes several times a day — which on this system is a checkbox in
 * the row, the way Mail's rules and System Settings' login items keep one.
 */
function List() {
  const area = useArea();
  const folder = "folder" in area.filter ? area.filter.folder : null;
  const archived = "view" in area.filter && area.filter.view === "archived";

  const rows = useMemo(() => {
    const held = area.corpus.records.filter(
      (record) => !record.isFolder && record.archived === archived,
    );
    return [...held].sort(byName);
  }, [area.corpus.records, archived]);

  return (
    <section className="flex h-full min-w-0 flex-col bg-workspace">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator pr-1.5 pl-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">
          {viewName(area.filter)}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-fg-tertiary">
            {rows.length} {rows.length === 1 ? "routine" : "routines"}
          </span>
          {/* Writing a routine, beside the list it joins — which is where macOS
              puts the command when it belongs to the content rather than to the
              window: the `+` beside a list's title in Reminders. Not offered
              over the archive: a routine written there would be one somebody
              had put away before writing it. */}
          {archived ? null : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New routine"
                  onClick={() => area.createRoutine(folder ?? "")}
                  className="text-fg-tertiary hover:text-fg"
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {folder === null || folder === ""
                  ? "New routine"
                  : `New routine in ${folderName(folder)}`}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {folder === null || folder === "" ? null : <FolderNote />}

        {rows.length === 0 ? (
          <div className="p-6">
            <PanelPlaceholder {...silence(area, archived, folder)} />
          </div>
        ) : (
          <ul className="divide-y divide-separator">
            {rows.map((record) => (
              <li key={record.key}>
                <Row record={record} showFolder={folder === null} />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}

/**
 * One routine: whether it runs, what it is called, and when.
 *
 * The switch is a control of its own beside the row rather than inside it,
 * because a button inside a button is not a thing — and because they are two
 * different acts: one opens the instruction, the other decides whether an agent
 * carries it out tonight. Flicking it must not open anything.
 */
function Row({
  record,
  showFolder,
}: {
  record: MemoryRecord;
  showFolder: boolean;
}) {
  const area = useArea();
  const drag = useDragHandle(`record:${record.key}`, { record: record.key });
  const runs = useId();
  const on = enabledOf(record.fields);

  const menu = (event: MouseEvent) =>
    showNativeContextMenu(event, [
      { label: "Open", onSelect: () => area.openRoutine(record.key) },
      {
        label: "Run Now",
        enabled: !area.running && !record.archived,
        onSelect: () => area.runNow(record.key),
      },
      {
        label: on ? "Switch Off" : "Switch On",
        enabled: !record.archived,
        onSelect: () => area.toggle(record),
      },
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
  const facts: string[] = [];
  if (record.fields !== undefined) {
    facts.push(everyLabel(everyOf(record.fields)));
    facts.push(area.agentName(agentOf(record.fields)));
  }
  if (showFolder && record.folder) facts.push(record.folder);

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {/* The one control macOS puts in a row of standing rules — Mail's Rules,
          System Settings' login items. A routine that is switched off is not a
          different kind of thing, so nothing else on this row changes: the
          state is said once, by the control that changes it. */}
      <input
        id={runs}
        type="checkbox"
        checked={on}
        disabled={record.archived}
        aria-label={enabledLabel(record)}
        onChange={() => area.toggle(record)}
        className="mt-0.5 size-3.5 shrink-0 accent-fg disabled:opacity-40"
      />
      <button
        {...drag}
        type="button"
        onClick={() => area.openRoutine(record.key)}
        onContextMenu={menu}
        className="-my-3 flex min-w-0 flex-1 items-start py-3 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover data-[dragging=true]:opacity-50"
      >
        <span className="min-w-0 flex-1">
          {/* Never truncated. It is what the routine is called, and a list that
              abbreviates it hides the one thing somebody scans for. */}
          <span className="block text-base text-fg">{name(record)}</span>
          {facts.length === 0 ? null : (
            <span className="mt-1 block truncate text-xs text-fg-tertiary">
              {facts.join(" · ")}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

/**
 * What a folder says about itself, above the things in it.
 *
 * A place rather than a command. Somebody looking at a folder can read what it
 * is for, and somebody who wants to say what it is for writes it here — there
 * is no verb to find in a menu first, and nothing to know about how it is
 * stored.
 */
function FolderNote() {
  const area = useArea();
  const said = area.folderNote.document;
  const line = said && (firstLine(said.content) || said.title);

  return (
    <button
      type="button"
      onClick={area.describeFolder}
      className="flex w-full items-center gap-2 border-b border-separator px-3 py-2 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover"
    >
      <Info aria-hidden="true" className="size-3.5 shrink-0 text-fg-tertiary" />
      <span
        className={
          line
            ? "min-w-0 flex-1 truncate text-sm text-fg-secondary"
            : "min-w-0 flex-1 truncate text-sm text-fg-tertiary"
        }
      >
        {line || "Say what this folder is for"}
      </span>
    </button>
  );
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

/** An empty list has several causes, and they must not read the same. */
function silence(
  area: ReturnType<typeof useArea>,
  archived: boolean,
  folder: string | null,
): { headline: string; detail?: string } {
  if (area.corpus.error !== null) {
    return {
      headline: "The project's memory could not be read.",
      detail: area.corpus.error,
    };
  }
  if (area.corpus.isLoading) return { headline: "Reading the project's memory…" };
  if (archived) {
    return {
      headline: "Nothing has been archived.",
      detail:
        "Archiving takes a routine out of the lists and stops the clock asking for it, without deleting anything.",
    };
  }
  if (folder !== null && folder !== "") {
    return {
      headline: "Nothing filed here yet.",
      detail: "Drag a routine onto this folder, or write a new one here.",
    };
  }
  return {
    headline: "No routines yet.",
    detail:
      "A routine is one instruction an agent carries out on a clock — whether or not this window is open.",
  };
}

/** A routine with no title is still a routine, and is listed by its key. */
function name(record: MemoryRecord): string {
  return record.title.trim() || record.key;
}

/**
 * The order routines are read in: by name, and by key for the ones with none.
 *
 * Not by whether they run. A list that reordered itself when somebody flicked a
 * switch would move the row out from under the pointer that flicked it.
 */
function byName(a: MemoryRecord, b: MemoryRecord): number {
  return name(a).localeCompare(name(b)) || a.key.localeCompare(b.key);
}

/** The opening line of a folder's description, with Markdown's marks stepped over. */
function firstLine(content: string): string {
  return (
    content
      .split("\n")
      .map((text) => text.replace(/^#+\s*/, "").trim())
      .find((text) => text !== "") ?? ""
  );
}
