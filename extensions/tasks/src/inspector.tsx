"use client";

import { useMemo, type ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import {
  PanelBody,
  PanelHeader,
  PanelSurface,
  useAgents,
} from "@sync-buzz/extension-api";

import { useArea } from "./context";
import {
  CLOSED,
  PRIORITIES,
  STATUSES,
  TYPES,
  isClosed,
  priorityOf,
  shape,
  statusLabel,
  statusOf,
  typeOf,
} from "./model";

/**
 * What is true *of* the open task: how far it has got, how much it matters,
 * what kind of change it is, whether it is written as a task at all — and the
 * one command that hands it over.
 *
 * Each control is the one its value asks for, by the shell's own rule: a choice
 * over a closed set is a pop-up over exactly that set. Nothing here is a
 * heading with a paragraph under it, which would be a settings page rather than
 * a panel beside a record.
 */
export function TasksInspector() {
  const area = useArea();
  const { agents } = useAgents();
  const document_ = area.open.draft ?? area.open.document;

  // With nothing open this column describes the register rather than one piece
  // of work, which is what the shell's own panel does when no record is open:
  // it answers about the corpus instead of going blank.
  if (area.openKey === null || document_ === null) {
    return (
      <PanelSurface className="bg-panel">
        <PanelHeader title="Tasks" />
        <PanelBody className="space-y-5">
          <RegisterFacts />
        </PanelBody>
      </PanelSurface>
    );
  }

  // The record that *is* a folder is not one of the folder's tasks, and the
  // engine does not hold it to this type's fields. A panel offering it a status
  // and a priority would be inviting somebody to write three fields onto a
  // heading — and the pop-ups would show defaults it does not carry, which
  // reads as data rather than as absence.
  if (area.open.document?.isFolder === true) {
    return (
      <PanelSurface className="bg-panel">
        <PanelHeader title="Folder" />
        <PanelBody className="space-y-5">
          <section className="space-y-2">
            <Label>What this folder is for</Label>
            <p className="text-xs text-fg-tertiary">
              A group of work with something in common, said in the folder&rsquo;s
              own words. Whoever writes the next task reads this to know whether
              it belongs here — an agent included.
            </p>
          </section>
          <section className="space-y-2">
            <Label>Path</Label>
            <p className="font-mono text-xs text-fg-secondary">
              {area.open.document.folder ?? ""}
            </p>
          </section>
        </PanelBody>
      </PanelSurface>
    );
  }

  const fields = (document_.fields ?? {}) as Record<string, unknown>;
  const status = statusOf(fields);
  const written = shape(document_.content ?? "");
  // Where it is filed is the store's answer, not the draft's: a draft holds
  // what somebody is typing, and a folder is moved rather than typed.
  const filed = area.open.document?.folder ?? null;
  const claude = agents.find((agent) => agent.id === "claude");
  const conversation = area.conversationOf(area.openKey);

  // **A single choice is written at once**, which is the shell's rule for a
  // discrete value. Here it is also what keeps the register true: the list
  // groups from the store, not from this window's draft, so a status changed
  // and a window closed within the second would be a move nobody made.
  const set = (patch: Record<string, unknown>) => {
    area.open.edit({ fields: { ...fields, ...patch } });
    void area.open.write().then(() => area.corpus.reload(), () => undefined);
  };

  /**
   * Closing a task takes it out of the register.
   *
   * One act rather than two, because they are one decision: a register lists
   * what is open, and a closed task left in the lists is a row nobody can act
   * on. Everything survives it — the links, the search, the record — and
   * bringing it back is the archive control on the record itself.
   */
  const setStatus = (next: string) => {
    area.open.edit({
      fields: { ...fields, status: next },
      ...(isClosed(next) ? { archived: true } : {}),
    });
    void area.open.write().then(() => area.corpus.reload(), () => undefined);
  };

  return (
    <PanelSurface className="bg-panel">
      {/* Each column's header says something different: the navigator names the
          section, the workspace names what it is showing, and this one names
          what it describes — how far the work has got, and who has it. */}
      <PanelHeader title="Work" />
      <PanelBody className="space-y-5">
        <section className="space-y-2">
          <Label>Status</Label>
          <Choice
            label="Status"
            value={status}
            options={STATUSES.map((entry) => ({ id: entry.id, label: entry.label }))}
            onChange={setStatus}
          />
          <p className="text-xs text-fg-tertiary">
            {STATUSES.find((entry) => entry.id === status)?.note}
            {CLOSED.includes(status)
              ? " — archived, so it leaves the lists and keeps every link."
              : ""}
          </p>
        </section>

        <section className="space-y-2">
          <Label>Priority</Label>
          <Choice
            label="Priority"
            value={priorityOf(fields)}
            options={PRIORITIES.map((entry) => ({ id: entry.id, label: entry.label }))}
            onChange={(next) => set({ priority: next })}
          />
        </section>

        <section className="space-y-2">
          <Label>Type</Label>
          <Choice
            label="Type"
            value={typeOf(fields)}
            options={TYPES.map((entry) => ({ id: entry.id, label: entry.label }))}
            onChange={(next) => set({ type: next })}
          />
          <p className="text-xs text-fg-tertiary">
            What an agent reads first: it decides which skills to load.
          </p>
        </section>

        <section className="space-y-2">
          <Label>Filed in</Label>
          {/* Read here and moved by dragging, the way a record is moved
              everywhere else in this window. A second way to move it — a pop-up
              over every folder — would be a control that has to be rebuilt
              whenever somebody makes one, in a column that is about the task
              rather than about the hierarchy. */}
          <p className="text-xs text-fg-secondary">
            {filed === null ? (
              <span className="text-fg-tertiary">
                No folder. Drag it onto one to group it with work like it.
              </span>
            ) : (
              <span className="font-mono">{filed}</span>
            )}
          </p>
        </section>

        <section className="space-y-2">
          <Label>Done when</Label>
          {/* Counted from the body, where the criteria are. */}
          {written.criteria.total === 0 ? null : (
            <p className="text-xs text-fg-secondary tabular-nums">
              {written.criteria.done} of {written.criteria.total} settled
            </p>
          )}
          {/* What is missing, said plainly and in the same words the agent is
              told. A task nobody can settle is the one defect this record type
              exists to prevent, and until now the window only ever mentioned
              the absence of criteria — a task with criteria and no bounds
              looked complete. */}
          {written.faults.map((fault) => (
            <p key={fault} className="text-xs text-warning">
              {fault}
            </p>
          ))}
        </section>

        <section className="space-y-2">
          <Label>Hand it over</Label>
          {/* At the weight the panel is drawn at, not at a button's: every
              other control in this column is one line of `text-xs` inside a
              hairline, and a control here at a button's size would read as the
              loudest thing in a column whose subject is the record beside it. */}
          <button
            type="button"
            disabled={area.sending || claude?.available === false}
            onClick={area.send}
            className="w-full rounded-(--radius-control) border border-separator-strong px-2 py-1 text-xs text-fg-secondary transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover hover:text-fg disabled:opacity-50"
          >
            {area.sending ? "Handing over…" : "Send to agent"}
          </button>
          {/* Where it went, for as long as this window knows. A person who
              hands over three tasks has three conversations in Chat, and until
              this said which was which the answer was "one of them". It is the
              conversation's own name, because that is what Chat lists it as,
              and what the agent is doing right now beside it — a finished
              conversation that went on claiming to be working would be worse
              than saying nothing. */}
          {conversation === null ? null : (
            <p className="text-xs text-fg-secondary">
              In Chat as <span className="text-fg">“{conversation.title}”</span>
              {conversation.status === null
                ? " — that conversation is no longer running."
                : ` — ${doing(conversation.status)}.`}
            </p>
          )}
          {/* A command that did not happen says so, beside the control that was
              pressed, in the one tier this window keeps for a refusal. */}
          {area.sent !== null ? (
            <p className={area.sent.failed ? "text-xs text-danger" : "text-xs text-fg-tertiary"}>
              {area.sent.said}
            </p>
          ) : claude?.available === false ? (
            <p className="text-xs text-fg-tertiary">
              No agent is installed on this machine to hand it to.
            </p>
          ) : (
            <p className="text-xs text-fg-tertiary">
              Opens a conversation in Chat with this task as its brief, and moves
              it to {statusLabel("in_progress").toLowerCase()}.
              {written.faults.length > 0
                ? " It will be asked to put the record right before it starts."
                : ""}
            </p>
          )}
        </section>
      </PanelBody>
    </PanelSurface>
  );
}

/**
 * What is true of the register as a whole, for the column that would otherwise
 * be empty.
 *
 * Every open status is listed, including the ones nothing is in: `Blocked 0` is
 * the good news, and a summary that hides it cannot be read as an answer. The
 * closed ones are not listed at all — closing a task archives it, so it leaves
 * the register, and a row that could only ever say zero would be a fact about
 * this window rather than about the project.
 */
function RegisterFacts() {
  const area = useArea();
  const open = STATUSES.filter((status) => !CLOSED.includes(status.id));

  const held = area.corpus.records.filter((record) => !record.isFolder);
  // The same absence the list checks for, and the same refusal to invent: a
  // register summary counted from rows that carry no status would report every
  // task as waiting to be started.
  const blind = held.length > 0 && held.every((record) => record.fields === undefined);

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const record of area.corpus.records) {
      if (record.isFolder) continue;
      const status = statusOf(record.fields);
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    }
    return byStatus;
  }, [area.corpus.records]);

  const here = "folder" in area.filter ? area.filter.folder : null;
  const total = held.length;

  if (blind) {
    return (
      <section className="space-y-2">
        <Label>{here === null ? "Register" : "In this folder"}</Label>
        <p className="text-xs text-fg-secondary tabular-nums">
          {total} {total === 1 ? "task" : "tasks"}
        </p>
        <p className="text-xs text-warning">
          How far each has got did not arrive with the rows, so there is nothing
          honest to count them by here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <Label>{here === null ? "Register" : "In this folder"}</Label>
      <dl className="space-y-1.5">
        {open.map((status) => (
          <div key={status.id} className="flex items-center gap-2">
            <dt className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
              {status.label}
            </dt>
            <dd className="shrink-0 font-mono text-xs text-fg-secondary tabular-nums">
              {counts.get(status.id) ?? 0}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-fg-tertiary">
        {area.corpus.error !== null
          ? area.corpus.error
          : total === 0
            ? "The project has committed to nothing yet, so there is nothing to be behind on."
            : area.hidden.length > 0
              ? `Counted over everything here; ${area.hidden.length} of the statuses are not listed in the column beside this one.`
              : "Closing a task archives it, so what is counted here is what is still open."}
      </p>
    </section>
  );
}

/**
 * What an agent is doing, in words rather than in the protocol's.
 *
 * The states are the session layer's own and a person reading a task has no use
 * for the vocabulary — what they want to know is whether to wait, to go and
 * look, or that it is over.
 */
function doing(status: string): string {
  switch (status) {
    case "starting":
      return "starting up";
    case "working":
      return "working on it now";
    case "asking":
      return "waiting on an answer from you";
    case "ready":
      return "finished its turn";
    case "failed":
      return "it could not be started";
    default:
      return "it has ended";
  }
}

function Label({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold text-fg-tertiary">{children}</h3>;
}

/**
 * A choice over a closed set, which on this system is a pop-up.
 *
 * `appearance-none` and a chevron of our own: a `select` left to itself is
 * drawn by the engine at whatever height it likes, with an arrow of its own,
 * and lines up with nothing above or below it. The menu it opens is still the
 * system's, which is the half worth keeping.
 */
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-(--control-height-sm) w-full cursor-default appearance-none rounded-(--radius-control) border border-separator-strong bg-raised pr-7 pl-2 text-xs text-fg"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-fg-tertiary"
      />
    </div>
  );
}
