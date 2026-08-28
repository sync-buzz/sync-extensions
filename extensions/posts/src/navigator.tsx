"use client";

import { Megaphone, SquarePen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  PanelHeader,
  PanelSurface,
  SourceList,
  type SourceListItem,
} from "@sync-buzz/extension-api";

import { useArea } from "./context";
import { SLICES, type SliceId } from "./filter";

/**
 * The two halves of the section, and nothing else in this column.
 *
 * Two rows is a short list, and that is the point rather than an argument
 * against it: the division it draws — what can still be changed against what
 * has been said — is the one distinction this whole section is built on, and a
 * person has to be able to see which side they are standing on without reading
 * the rows in the middle column to work it out.
 *
 * Each row carries its own count. A figure only on the row being shown would
 * answer a question about where somebody already is; what they want to know
 * from here is whether there is anything on the other side.
 */
const MARKS: Record<SliceId, LucideIcon> = {
  drafts: SquarePen,
  published: Megaphone,
};

export function PostsNavigator() {
  const area = useArea();

  const held: Record<SliceId, number> = {
    drafts: area.drafts.records.length,
    published: area.publications.records.length,
  };

  const rows: SourceListItem[] = SLICES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    icon: MARKS[entry.id],
    note: entry.note,
    // Nothing is drawn for an empty half. A standing `0` is a number nobody can
    // act on, and it reads as a count that failed rather than as a list with
    // nothing in it.
    ...(held[entry.id] > 0
      ? { badge: { kind: "count" as const, value: held[entry.id] } }
      : {}),
  }));

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Posts" />

      {/* No scroller and no padding around it. `SourceList` brings both, and a
          second set would narrow the rows this column exists to show. */}
      <SourceList
        label="What this project has said, and what it has not said yet"
        items={rows}
        activeId={area.slice}
        onSelect={(id) => area.select(id as SliceId)}
      />
    </PanelSurface>
  );
}
