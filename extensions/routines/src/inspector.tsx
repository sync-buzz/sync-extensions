"use client";

import { useId, type ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import {
  Button,
  PanelBody,
  PanelHeader,
  PanelSurface,
} from "@sync-buzz/extension-api";

import { INTERVALS, agentOf, enabledOf, everyOf } from "./model";
import { useArea } from "./area";

/**
 * What is true *of* the open routine: how often, by whom, and whether it runs.
 *
 * Each control is the one the value asks for, by `design-foundation.md`'s rule:
 * a flag is the system's own checkbox, and a choice over a closed set is a
 * pop-up over exactly that set. Nothing here is a heading with a paragraph
 * under it — that is a settings page, and this is a panel beside a record.
 */
export function RoutinesInspector() {
  const area = useArea();
  const document_ = area.open.draft ?? area.open.document;
  const runs = useId();

  // Empty and labelled rather than absent. The band is the same one the other
  // two columns draw, and a column that leaves it out while it has nothing to
  // say breaks the line the slab reads as. Nothing is put in its place: the
  // workspace beside it already says what to do, and saying it twice is a
  // window arguing with itself.
  if (area.routineKey === null || document_ === null) {
    return (
      <PanelSurface className="bg-panel">
        <PanelHeader title="Clock" />
        <div className="min-h-0 flex-1" />
      </PanelSurface>
    );
  }

  const fields = (document_.fields ?? {}) as Record<string, unknown>;
  const every = everyOf(fields);
  const agent = agentOf(fields);
  const enabled = enabledOf(fields);
  const empty = (document_.content ?? "").trim().length === 0;
  // **A single choice is written at once**, which is `design-foundation.md`'s
  // rule for a discrete value and here is also the difference between switching
  // a routine on and having switched it on: the clock reads the store, not this
  // window's draft. Left on the pause that text is written on, a switch flicked
  // and a window closed within the second was a routine somebody had turned on
  // and that was still off.
  //
  // The list is re-read after it, because a row now says the opposite of what
  // it said: the mark on every routine carries whether it runs, and a column
  // still drawing the old answer beside the switch that changed it is the two
  // halves of one window disagreeing in plain sight.
  const set = (patch: Record<string, unknown>) => {
    area.open.edit({ fields: { ...fields, ...patch } });
    void area.open.write().then(() => area.corpus.reload(), () => undefined);
  };

  return (
    <PanelSurface className="bg-panel">
      {/* Each column's header says something different: the navigator names the
          section, the workspace names what is being shown of it, and this one
          names what it describes — when the routine is carried out, by whom,
          and whether it is. */}
      <PanelHeader title="Clock" />
      {/* `PanelBody` sets the padding every panel in this window is read at.
          The first draft passed `py-4` and stood four pixels off every other
          one, top and bottom, in a column that sits directly beside them. */}
      <PanelBody className="space-y-5">
        <section className="space-y-2">
          <Label>Runs</Label>
          <div className="flex items-center gap-2">
            <input
              id={runs}
              type="checkbox"
              checked={enabled}
              onChange={(event) => set({ enabled: event.target.checked })}
              className="size-3.5 accent-fg"
            />
            <label htmlFor={runs} className="min-w-0 flex-1 text-xs text-fg-secondary">
              On this clock, unattended
            </label>
          </div>
          {enabled && empty ? (
            <p className="text-xs text-warning">
              Nothing will be asked: this routine has no instruction yet.
            </p>
          ) : null}
          <p className="text-xs text-fg-tertiary">
            It spends this agent&apos;s tokens each time, with no window open.
          </p>
        </section>

        <section className="space-y-2">
          <Label>How often</Label>
          <Choice
            label="How often"
            value={every}
            options={INTERVALS.map((interval) => ({
              id: interval.id,
              label: interval.label,
            }))}
            onChange={(next) => set({ every: next })}
          />
          <p className="text-xs text-fg-tertiary">
            Lateness is not made up for: a machine asleep for six hours runs it
            once when it wakes.
          </p>
        </section>

        <section className="space-y-2">
          <Label>Agent</Label>
          <Choice
            label="Agent"
            value={agent}
            options={
              area.agents.length === 0
                ? [{ id: agent, label: agent }]
                : area.agents.map((one) => ({
                    id: one.id,
                    label: one.available ? one.name : `${one.name} — not installed`,
                  }))
            }
            onChange={(next) => set({ agent: next })}
          />
          <p className="text-xs text-fg-tertiary">
            It runs in this project&apos;s folder with the tools it has on this
            machine.
          </p>
        </section>

        <section className="space-y-2">
          <Label>Try it</Label>
          {/* The window's own button, at the window's own height. Drawn by hand
              it was a control that resembled one — its own border, its own
              padding, its own idea of a disabled state — sitting under two
              pop-ups it did not line up with. */}
          <Button
            variant="outline"
            size="sm"
            disabled={area.running}
            onClick={() => area.runNow(area.routineKey)}
            className="w-full"
          >
            {area.running ? "Starting…" : "Run now"}
          </Button>
          {/* A command that did not happen says so, beside the control that was
              pressed — and says it in the one tier this window keeps for a
              refusal. Drawn in the same grey as the note beneath it, a run that
              was refused read as a run that had started. */}
          {area.ran !== null ? (
            <p
              className={
                area.ran.failed ? "text-xs text-danger" : "text-xs text-fg-tertiary"
              }
            >
              {area.ran.said}
            </p>
          ) : (
            <p className="text-xs text-fg-tertiary">
              Carries it out once, as a conversation you can read in Chat.
            </p>
          )}
        </section>
      </PanelBody>
    </PanelSurface>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold text-fg-tertiary">{children}</h3>;
}

/**
 * A choice over a closed set, which on this system is a pop-up.
 *
 * `appearance-none` and a chevron of our own, which is the repair the window's
 * own panel already made and this package had not: a `select` left to itself is
 * drawn by the engine at whatever height it likes, with an arrow of its own, and
 * it was the one control in this column that lined up with nothing above or
 * below it. The menu it opens is still the system's, which is the half worth
 * keeping.
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
