"use client";

import { useMemo, type MouseEvent, type ReactNode } from "react";

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

import { useArea } from "./context";
import type { TasksFilter } from "./filter";
import {
  PRIORITIES,
  STATUSES,
  priorityLabel,
  priorityOf,
  statusOf,
  typeLabel,
  typeOf,
  type StatusId,
} from "./model";

/**
 * The register, and one task when one is open.
 *
 * The dominant surface, and the reason the navigator no longer lists tasks: a
 * task's title is an instruction somebody is about to agree to do, so it is the
 * widest thing on the row and is never truncated. Everything else the row says
 * — what kind of change it is, how much it matters, where it is filed — is one
 * quiet line under it, which is the shape Records already uses for a claim.
 */
export function TasksWorkspace() {
  const area = useArea();

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ActionFailure message={area.failure} onDismiss={area.dismissFailure} />
      {area.openKey === null ? (
        <Register />
      ) : (
        <DocumentView
          open={area.open}
          icon={area.open.document?.isFolder === true ? "folder" : "list-checks"}
          // A folder's own document is not a task, so it is not told how to be
          // one. What it is for is the sentence above it.
          note={
            area.open.document?.isFolder === true
              ? "What belongs in this folder, in its own words. Whoever writes the next task reads this to know whether it goes here."
              : "What to do, the criteria that settle it, and what is out of bounds. Write every criterion so it can be checked by running something, reading a file or looking at the screen."
          }
          onBack={area.closeTask}
          backLabel={viewName(area.filter)}
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

/** What the surface is showing, in the words its header says it in. */
export function viewName(filter: TasksFilter): string {
  return "folder" in filter ? folderName(filter.folder) || "All tasks" : "All tasks";
}

function Register() {
  const area = useArea();
  const folder = "folder" in area.filter ? area.filter.folder : null;

  // Two different cuts of one page, and both are needed: the count in the
  // header is of what is on screen, and the sentence under an empty list has to
  // be able to say that the project holds tasks this window is not listing.
  const { groups, listed, total, blind } = useMemo(() => {
    const held = area.corpus.records.filter((record) => !record.isFolder);
    // Whether the rows arrived carrying the fields this list was drawn from.
    //
    // A listing brings the fields it asked for, and when it brings none every
    // row reads as the type's default — which here means a register where every
    // task says *To do*, including the one an agent is working on. Grouping
    // that is not a list with a bug in it; it is a list stating something
    // false, which is the one thing a register may not do. So the absence is
    // detected and said out loud, and the rows are shown ungrouped until it is
    // fixed. Detected rather than assumed: the day the fields arrive, this
    // turns itself off.
    const blind = held.length > 0 && held.every((record) => record.fields === undefined);
    const byStatus = new Map<StatusId, MemoryRecord[]>();
    for (const record of held) {
      const status = statusOf(record.fields);
      if (area.hidden.includes(status)) continue;
      const rows = byStatus.get(status);
      if (rows === undefined) byStatus.set(status, [record]);
      else rows.push(record);
    }

    const groups: {
      status: (typeof STATUSES)[number] | null;
      rows: MemoryRecord[];
    }[] = STATUSES.flatMap((status) => {
      const rows = byStatus.get(status.id);
      // A group nobody has anything in is not drawn: six standing headings for
      // a project with four tasks is a column of labels.
      if (rows === undefined || rows.length === 0) return [];
      return [{ status, rows: [...rows].sort(order) }];
    });

    if (blind) {
      return {
        groups: [{ status: null, rows: [...held].sort(order) }],
        listed: held.length,
        total: held.length,
        blind,
      };
    }

    return {
      groups,
      listed: groups.reduce((count, group) => count + group.rows.length, 0),
      total: held.length,
      blind,
    };
  }, [area.corpus.records, area.hidden]);

  return (
    <section className="flex h-full min-w-0 flex-col bg-workspace">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator pr-1.5 pl-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">
          {viewName(area.filter)}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-fg-tertiary tabular-nums">
            {listed} {listed === 1 ? "task" : "tasks"}
            {area.corpus.hasMore ? " of more than these" : null}
          </span>
          {/* Beside the list it joins, which is where macOS puts the command
              when it belongs to the content: the `+` beside a list's title in
              Reminders. A task written while a folder is open is filed in that
              folder, so this asks nothing — the column beside it has already
              answered where. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New task"
                onClick={area.createTask}
                className="text-fg-tertiary hover:text-fg"
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {folder === null ? "New task" : `New task in ${folderName(folder)}`}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {folder === null ? null : <FolderNote />}
        {blind ? <FieldsMissing /> : null}

        {groups.length === 0 ? (
          <div className="p-6">
            <PanelPlaceholder {...silence(area.corpus.error, area.corpus.isLoading, total, folder)} />
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.status?.id ?? "ungrouped"}>
              {/* The status is said once, over the rows it is true of, rather
                  than repeated down a column: a word that appears on every row
                  is not something anybody scans. */}
              {group.status === null ? null : (
                <div className="flex items-baseline justify-between gap-3 border-b border-separator bg-workspace px-4 pt-4 pb-1">
                  <h3 className="min-w-0 truncate text-xs font-semibold text-fg-tertiary">
                    {group.status.label}
                  </h3>
                  <span className="shrink-0 font-mono text-xs text-fg-tertiary tabular-nums">
                    {group.rows.length}
                  </span>
                </div>
              )}
              <ul className="divide-y divide-separator">
                {group.rows.map((record) => (
                  <li key={record.key}>
                    <TaskRow record={record} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </ScrollArea>
    </section>
  );
}

/**
 * The rows arrived without the fields they are drawn from, and the list says so.
 *
 * Not an error of this section's: it asks for `status`, `priority` and `type`
 * by name on every read. What it cannot do is pretend — every row would read as
 * the type's default, so a register of work in flight would show as untouched.
 *
 * Stated where the list is, in the voice a refusal gets, and it disappears on
 * its own when the fields arrive.
 */
function FieldsMissing() {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-separator bg-panel px-3 py-2">
      <p className="min-w-0 flex-1 text-xs text-fg-secondary">
        <span className="font-medium text-warning">
          Status, priority and type did not arrive with these rows.
        </span>{" "}
        The list asks for them by name; the store answered without them, so the
        tasks are shown ungrouped rather than all under one status they are not
        in. Open a task to see and change its own state.
      </p>
    </div>
  );
}

/**
 * High first, then by title.
 *
 * Priority earns its place in the list rather than only in the panel: sorted by
 * it, the three values are the order somebody works down a group in, and a
 * field that changed nothing visible would be a field nobody sets.
 */
function order(left: MemoryRecord, right: MemoryRecord): number {
  const rank = (record: MemoryRecord) =>
    PRIORITIES.findIndex((priority) => priority.id === priorityOf(record.fields));
  const difference = rank(left) - rank(right);
  return difference !== 0 ? difference : left.title.localeCompare(right.title);
}

/**
 * One task, at the width of the window.
 *
 * A component rather than a branch of the loop above, because `useDragHandle`
 * is a hook and a list whose rows come and go would call a different number of
 * them on every render. Dragged onto a folder in the navigator to file it
 * there, and onto the register's own row to take it back out of one.
 */
function TaskRow({ record }: { record: MemoryRecord }) {
  const area = useArea();
  const drag = useDragHandle(`record:${record.key}`, { record: record.key });
  const priority = priorityOf(record.fields);
  const showing = "folder" in area.filter ? null : record.folder;

  const menu = (event: MouseEvent) =>
    showNativeContextMenu(event, [
      { label: "Open", onSelect: () => area.openTask(record.key) },
      "separator",
      {
        label: record.archived ? "Bring Back" : "Archive",
        onSelect: () => area.archive(record),
      },
      { label: "Delete", onSelect: () => area.askRemoval(record.key) },
    ]);

  return (
    <button
      {...drag}
      type="button"
      onClick={() => area.openTask(record.key)}
      onContextMenu={menu}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover data-[dragging=true]:opacity-50"
    >
      <span className="min-w-0 flex-1">
        {/* Never truncated. It is an instruction with a verb and an object, and
            an interface that abbreviates it is hiding the one thing somebody
            has to read before agreeing to do it. */}
        <span className="block text-base text-fg">{title(record)}</span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-fg-tertiary">
          {/* Drawn from what the row carries, and left off entirely when it
              carries nothing: a row that printed the type's defaults would be
              stating a fact about the task that nobody wrote. */}
          {record.fields === undefined ? null : (
            <>
              <span className="shrink-0">{typeLabel(typeOf(record.fields))}</span>
              {/* `normal` is what a task is unless somebody decided otherwise,
                  so saying it on every row would be saying nothing on every
                  row. */}
              {priority === "normal" ? null : (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">{priorityLabel(priority)}</span>
                </>
              )}
            </>
          )}
          {showing ? (
            <>
              {record.fields === undefined ? null : <span aria-hidden="true">·</span>}
              <span className="truncate font-mono">{showing}</span>
            </>
          ) : null}
          {record.archived ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">archived</span>
            </>
          ) : null}
        </span>
      </span>
    </button>
  );
}

/** A task with no title is shown by its key, which is a name rather than a blank. */
function title(record: MemoryRecord): string {
  return record.title.trim() || record.key;
}

/**
 * What a folder says about itself, above the things in it.
 *
 * A place rather than a command: somebody looking at a folder reads what it is
 * for, and somebody who wants to say what it is for writes it here. It is what
 * makes a folder mean something to an agent as well — a group whose purpose is
 * written down is one an agent can file into, and one that is only a word is a
 * guess.
 */
function FolderNote() {
  const area = useArea();
  const note = area.folderNote.document;
  const said = note && (firstLine(note.content) || note.title);

  return (
    <button
      type="button"
      onClick={() => {
        if ("folder" in area.filter) area.describeFolder(area.filter.folder);
      }}
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
        {said || "Say what belongs in this folder"}
      </span>
    </button>
  );
}

/**
 * The opening line of a body, for a strip one line tall. Markdown's own marks
 * are stepped over: showing the hash would be the window quoting syntax.
 */
function firstLine(content: string): string {
  return (
    content
      .split("\n")
      .map((text) => text.replace(/^#+\s*/, "").trim())
      .find((text) => text !== "") ?? ""
  );
}

/**
 * Four different silences, said differently.
 *
 * A project with no tasks, a folder nothing is filed in, and a window filtered
 * down to nothing look identical, and only one of them is worth writing a task
 * about.
 */
function silence(
  error: string | null,
  loading: boolean,
  total: number,
  folder: string | null,
): { headline: string; detail?: string } {
  if (error !== null) {
    return { headline: "The project's memory could not be read.", detail: error };
  }
  if (loading) return { headline: "Reading the project's memory…" };
  if (total > 0) {
    return {
      headline: "Nothing in the listed statuses",
      detail: `${total} ${total === 1 ? "task is" : "tasks are"} here, all in statuses this window is not listing. The filter in the bottom bar brings them back.`,
    };
  }
  if (folder !== null) {
    return {
      headline: "Nothing is filed here yet",
      detail:
        "A folder is a group of work with something in common. Say what belongs in it above, and whoever writes the next task will know where it goes.",
    };
  }
  return {
    headline: "No tasks yet",
    detail:
      "A task is one piece of work, with the criteria that decide it is finished — so whoever does it can be checked rather than believed.",
  };
}

/**
 * What a command that did not happen says for itself.
 *
 * A write the store refused has to be visible where it was asked for. Creating
 * a task is one click and one answer, and without this the answer is a button
 * that appears to do nothing — the failure mode this shell is least allowed to
 * have, and the one this section had until now: every write here swallowed its
 * refusal.
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
