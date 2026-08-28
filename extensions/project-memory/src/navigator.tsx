"use client";

import { useMemo } from "react";

import { CircleCheck, CircleHelp, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  PanelHeader,
  PanelPlaceholder,
  PanelSurface,
  SourceList,
  type SourceListItem,
} from "@sync-buzz/extension-api";

import { useArea } from "./context";
import type { QuestionsFilter } from "./filter";
import { statusOf } from "./model";

/**
 * Three rows, and the middle one is the reason the other two exist.
 *
 * What is open is the section's subject; what has been answered is where
 * somebody goes to read what was decided and why. Both counts are on the rows
 * rather than only on the one being shown — a figure on the row you are already
 * standing on answers a question nobody asked.
 *
 * There are no folders here and no grouping. A question is open for days and
 * then it is settled, so filing one is arranging something that is about to
 * stop needing an arrangement — and what it is *about* is a link on the record,
 * where the grouping already lives.
 */
const VIEWS: readonly {
  readonly id: QuestionsFilter["view"];
  readonly label: string;
  readonly note: string;
  readonly icon: LucideIcon;
}[] = [
  {
    id: "open",
    label: "Open",
    note: "Waiting on somebody",
    icon: CircleHelp,
  },
  {
    id: "answered",
    label: "Answered",
    note: "Settled, and the reasoning with it",
    icon: CircleCheck,
  },
  { id: "all", label: "All", note: "Both, in one list", icon: Layers },
];

export function QuestionsNavigator() {
  const area = useArea();

  const held = useMemo(() => {
    let open = 0;
    let answered = 0;
    for (const record of area.corpus.records) {
      if (record.isFolder) continue;
      if (statusOf(record.fields) === "answered") answered += 1;
      else open += 1;
    }
    return { open, answered, all: open + answered };
  }, [area.corpus.records]);

  const rows: SourceListItem[] = VIEWS.map((view) => ({
    id: view.id,
    label: view.label,
    icon: view.icon,
    note: view.note,
    // Nothing is drawn for an empty view. A standing `0` is a number nobody can
    // act on, and it reads as a count that failed rather than as a list with
    // nothing in it.
    ...(held[view.id] > 0
      ? { badge: { kind: "count" as const, value: held[view.id] } }
      : {}),
  }));

  return (
    <PanelSurface className="bg-panel">
      {/* The header band, at the one height every column in the slab shares, so
          its hairline reads as a single line crossing the window. This column
          names the section and carries no control: nothing in this section
          writes a question, and a `+` here would offer to. */}
      <PanelHeader title="Questions" />

      {/* Above the list rather than in it, and it does not scroll away: a
          column that could not be read is the first thing to say, and the rows
          under it are counted from nothing. */}
      {area.corpus.error === null ? null : (
        <div className="shrink-0 px-3 pt-2">
          <PanelPlaceholder
            headline="This project's memory could not be read"
            detail={area.corpus.error}
          />
        </div>
      )}

      {/* No scroller and no padding around it. `SourceList` brings both, and a
          second set would narrow the rows this column exists to show — which is
          a label truncated for the sake of margins nobody asked for. */}
      <SourceList
        label="What this project has not settled, and what it has"
        items={rows}
        activeId={area.filter.view}
        onSelect={(id) => area.select({ view: id as QuestionsFilter["view"] })}
      />
    </PanelSurface>
  );
}
