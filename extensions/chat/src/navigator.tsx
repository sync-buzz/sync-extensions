"use client";

/**
 * The column, as rows of one tree.
 *
 * Apart from the area that mounts it, and it imports nothing from there: what
 * is here is a function of a list and a set of callbacks, so it can be read —
 * and checked — without a window, an agent or a project. The same reason
 * `list.ts` stands apart, one step further out.
 *
 * **One tree, not a list with trees hanging off it.** The groups, the
 * conversations and what was delegated from them are one hierarchy, so they are
 * one control: a single tab stop, one set of arrow keys, ← and → to close and
 * open, and no seam a person can fall into between a heading and the rows under
 * it. Three ways of reaching what was hidden — a heading that collapsed, a
 * count that disclosed, and a line of text offering the rest — are now the one
 * triangle on the leading edge that the rest of this window already uses.
 */

import { useState, type ReactNode } from "react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  type NativeMenuEntry,
  type SessionRow,
  type SourceTreeItem,
  type Worktree,
} from "@sync-buzz/extension-api";
import {
  CircleDashed,
  CircleEllipsis,
  CircleMinus,
  CircleX,
  Hourglass,
  MessageSquare,
  MessageSquareDot,
  MessageSquareOff,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

import {
  descended,
  titleOf,
  type Bucket,
  type ConversationEntry,
} from "./list";
import { worktreeName } from "./pickers";

/**
 * The row every other row hangs from. Never drawn — a source list shows its
 * contents, not a row standing for the list itself.
 */
export const ROOT = "/conversations";

/** What one row of this tree is called, and what selection is stated in. */
export function idOf(entry: ConversationEntry): string {
  return entry.at === "live" ? `live:${entry.row.key}` : `dormant:${entry.held.acpSession}`;
}

/** The row a group is drawn as, keyed apart from any conversation. */
function groupId(key: string): string {
  return `group:${key}`;
}

/** What an id points at, for the one place that has to turn it back. */
export function opened(id: string): { at: "live" | "dormant"; key: string } | null {
  const [at, ...rest] = id.split(":");
  const key = rest.join(":");
  if (key === "") return null;
  return at === "live" || at === "dormant" ? { at, key } : null;
}

/**
 * Which state a conversation is in, as one glyph.
 *
 * A word for each of these is what the second line under every name used to
 * carry, and a column of second lines is a column read twice. The glyph says
 * the same thing in the width of an icon, and the word is still there under the
 * pointer for whoever wants it.
 */
const GLYPHS: Record<SessionRow["status"], LucideIcon> = {
  starting: CircleDashed,
  ready: MessageSquare,
  working: CircleEllipsis,
  queued: Hourglass,
  asking: MessageSquareDot,
  ended: CircleMinus,
  failed: CircleX,
};

/** The same states in words, for the tooltip and for a screen reader. */
export const WORDS: Record<SessionRow["status"], string> = {
  starting: "Starting",
  ready: "Ready",
  working: "Working",
  // Two waits, and a person has to be able to tell them apart: one is waiting
  // on them, the other on the conversation above it finishing.
  queued: "Waiting its turn",
  asking: "Waiting for you",
  ended: "Ended",
  failed: "Failed",
};

/**
 * Whether this row is waiting on the person reading the column.
 *
 * Two states and not one. A conversation that stopped on a question is the
 * obvious one; a conversation that failed is waiting just as squarely, and
 * leaving it unmarked would make the quiet states and the one nobody has
 * noticed look alike. Everything else is either working or finished, and
 * neither wants anything.
 */
function wants(status: SessionRow["status"]): boolean {
  return status === "asking" || status === "failed";
}

/** What a row says under the pointer: the whole of what the second line held. */
function tooltipFor(
  entry: ConversationEntry,
  tree: Worktree | null,
): ReactNode {
  const about = entry.at === "live" ? entry.row.about : entry.held.about;
  const agent = entry.at === "live" ? entry.row.agentName : entry.held.agentName;
  const state = entry.at === "live" ? WORDS[entry.row.status] : "Closed";
  return (
    <>
      <span className="font-medium">{state}</span>
      <span>{agent}</span>
      {about ? <span>{about.title}</span> : null}
      {tree === null ? null : <span>{worktreeName(tree)}</span>}
    </>
  );
}

/** What acting on a row does, given to the rows rather than reached from them. */
export interface Acting {
  readonly open: (id: string) => void;
  readonly openRecord: ((about: { key: string; kind: string }) => void) | null;
  readonly resume: (acpSession: string) => void;
  readonly forgetDormant: (acpSession: string) => void;
  readonly keep: (key: string) => void;
  readonly stop: (key: string) => void;
  readonly forget: (key: string) => void;
  /** Opens the sheet on one of the four questions a row can raise. */
  readonly ask: (asking: Asking) => void;
  /** The tree a live row is working in, as it stands now rather than at open. */
  readonly treeOf: (row: SessionRow) => Worktree | null;
}

/**
 * Every row of the column, by id.
 *
 * **A group is a row only when there is more than one.** A single heading over
 * the whole list is a heading that never distinguishes anything, and the column
 * it stands in is a column of conversations either way. So with one group the
 * conversations are the roots, and the moment a second appears they take one
 * indent — once, and in the direction that starts saying something.
 */
export function treeRows(
  buckets: readonly Bucket[],
  acting: Acting,
): ReadonlyMap<string, SourceTreeItem> {
  const rows = new Map<string, SourceTreeItem>();
  const named = buckets.length > 1;
  const roots: string[] = [];

  for (const bucket of buckets) {
    const descents = descended(bucket.entries);
    const top = descents.map((descent) => {
      const id = idOf(descent.entry);
      rows.set(id, conversationRow(descent.entry, acting, descent.children.map(idOf)));
      for (const child of descent.children) {
        rows.set(idOf(child), conversationRow(child, acting, []));
      }
      return id;
    });

    if (!named) {
      roots.push(...top);
      continue;
    }
    const id = groupId(bucket.key);
    rows.set(id, {
      id,
      label: bucket.label,
      // Conversations, not roots. A heading answers *how many are under here*,
      // and a family of three that counted as one would make the number
      // disagree with the rows a person can see beneath it.
      count: bucket.entries.length,
      children: top,
    });
    roots.push(id);
  }

  rows.set(ROOT, { id: ROOT, label: "Conversations", children: roots });
  return rows;
}

/** One conversation, whichever half of the list it came from. */
function conversationRow(
  entry: ConversationEntry,
  acting: Acting,
  children: readonly string[],
): SourceTreeItem {
  const id = idOf(entry);
  const tree = entry.at === "live" ? acting.treeOf(entry.row) : null;
  const label =
    titleOf(entry) ?? (entry.at === "live" ? entry.row.agentName : entry.held.agentName);
  return {
    id,
    label,
    // A closed conversation is drawn quieter, which is what `muted` is for: it
    // is real, it is somewhere a person can go back to, and nothing of ours is
    // running in it. Its own glyph rather than the one a running conversation
    // with nothing to say wears: dimming alone made the two look alike down a
    // column, and *closed* and *idle* are not the same news.
    ...(entry.at === "dormant" ? { muted: true, icon: MessageSquareOff } : {}),
    // **A conversation that others came out of is drawn as more than one.**
    // The state glyph is the same for most rows most of the time — nearly
    // everything is ready or closed — so a column of them says nothing about
    // which row is which. What varies is whether a row is a family, and that is
    // worth the leading edge.
    ...(entry.at === "live"
      ? {
          icon: children.length === 0 ? GLYPHS[entry.row.status] : MessagesSquare,
          emphasised: wants(entry.row.status),
        }
      : {}),
    // How many came out of it, at the trailing edge where this window keeps a
    // number. The triangle beside it says there is something folded away; it
    // does not say how much, and the count is the reason to open it.
    ...(children.length === 0 ? {} : { children, count: children.length }),
    tooltip: tooltipFor(entry, tree),
    menu: () => menuFor(entry, acting, tree),
  };
}

/** What the secondary button opens, built when it is asked for. */
function menuFor(
  entry: ConversationEntry,
  acting: Acting,
  tree: Worktree | null,
): readonly NativeMenuEntry[] {
  const about = entry.at === "live" ? entry.row.about : entry.held.about;
  // First, because it is the one thing here that leaves this section: what the
  // work is about is a record, and reading it is what somebody scanning these
  // rows is about to want.
  const record =
    about && acting.openRecord !== null
      ? ([
          {
            label: "Open record",
            onSelect: () => acting.openRecord?.({ key: about.key, kind: about.kind }),
          },
          "separator",
        ] as const)
      : [];

  if (entry.at === "dormant") {
    const held = entry.held;
    return [
      ...record,
      { label: "Reopen", onSelect: () => acting.resume(held.acpSession) },
      "separator",
      {
        label: "Remove from this list",
        onSelect: () => acting.forgetDormant(held.acpSession),
      },
    ];
  }

  const row = entry.row;
  const hasWork = tree !== null && tree.head !== tree.baseCommit;
  return [
    ...record,
    { label: "Rename…", onSelect: () => acting.ask({ at: "renaming", row }) },
    { label: "Add to Memory", onSelect: () => acting.keep(row.key) },
    // Only for a conversation that is in one. Keeping is disabled rather than
    // hidden while there is nothing committed: the gesture exists, and *why not
    // yet* is worth saying by the state of the item.
    ...(tree === null
      ? []
      : ([
          "separator",
          {
            label: "Keep work as branch…",
            enabled: hasWork,
            onSelect: () => acting.ask({ at: "naming", row, tree }),
          },
          {
            label: "Discard working tree…",
            onSelect: () => acting.ask({ at: "discarding", row, tree, hasWork }),
          },
        ] as const)),
    "separator",
    { label: "Stop agent", onSelect: () => acting.stop(row.key) },
    "separator",
    {
      label: tree === null ? "Delete conversation" : "Delete conversation…",
      onSelect: () =>
        tree === null
          ? acting.forget(row.key)
          : acting.ask({ at: "deleting", row, tree, hasWork }),
    },
  ];
}

/**
 * What a row can stop and ask, now that it cannot ask it in place.
 *
 * A row of this tree is a row of the window's own list and not a form, so the
 * four questions that used to unfold inside it are asked over it — which is
 * what this window does with a question anywhere else, and what the column
 * beside this one does with a folder.
 */
export type Asking =
  | { readonly at: "renaming"; readonly row: SessionRow }
  | { readonly at: "naming"; readonly row: SessionRow; readonly tree: Worktree }
  | {
      readonly at: "discarding";
      readonly row: SessionRow;
      readonly tree: Worktree;
      readonly hasWork: boolean;
    }
  | {
      readonly at: "deleting";
      readonly row: SessionRow;
      readonly tree: Worktree;
      readonly hasWork: boolean;
    };

/** What settling one of those questions does. */
export interface Settling {
  readonly rename: (key: string, title: string) => void;
  readonly adopt: (path: string, branch: string) => void;
  readonly discard: (path: string) => void;
  readonly forget: (key: string) => void;
}

/** The one sheet the column raises, on whichever question was asked. */
export function ConversationSheet({
  asking,
  onClose,
  settling,
}: {
  asking: Asking | null;
  onClose: () => void;
  settling: Settling;
}) {
  return (
    <Sheet open={asking !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <SheetContent>
        {/* Mounted only while it is open, so a field holds what was typed for
            this conversation rather than what was typed for the last one. */}
        {asking === null ? null : (
          <Asked asking={asking} onClose={onClose} settling={settling} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Asked({
  asking,
  onClose,
  settling,
}: {
  asking: Asking;
  onClose: () => void;
  settling: Settling;
}) {
  // Empty for a branch, with no name suggested. What a branch is called is this
  // repository's convention and not this window's, and a value already in the
  // field is a suggestion whether or not it was meant as one.
  const [text, setText] = useState(asking.at === "renaming" ? (asking.row.title ?? "") : "");

  if (asking.at === "renaming" || asking.at === "naming") {
    const naming = asking.at === "naming";
    const settle = () => {
      const said = text.trim();
      onClose();
      if (naming) {
        if (said !== "") settling.adopt(asking.tree.path, said);
      } else {
        settling.rename(asking.row.key, said);
      }
    };
    return (
      <>
        <SheetHeader>
          <SheetTitle>{naming ? "Keep work as branch" : "Rename conversation"}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 py-3">
          <SheetDescription>
            {naming
              ? "Names the work done in this tree. The tree stays where it is."
              : "What this conversation is called in the list. Empty leaves it named after its agent."}
          </SheetDescription>
          <input
            autoFocus
            value={text}
            placeholder={naming ? "Branch name" : asking.row.agentName}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") settle();
              if (event.key === "Escape") onClose();
            }}
            className="h-(--control-height-lg) w-full rounded-(--radius-control) border border-separator bg-input px-2 text-base text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <SheetFooter>
          <div className="min-w-0 flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={naming && text.trim() === ""} onClick={settle}>
            {naming ? "Keep" : "Rename"}
          </Button>
        </SheetFooter>
      </>
    );
  }

  if (asking.at === "discarding") {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Discard working tree</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-3">
          <SheetDescription>
            {asking.hasWork
              ? "Throw this tree away? The commits in it go too."
              : "Throw this tree away? Nothing was committed in it."}
          </SheetDescription>
        </div>
        <SheetFooter>
          <div className="min-w-0 flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onClose();
              settling.discard(asking.tree.path);
            }}
          >
            Discard
          </Button>
        </SheetFooter>
      </>
    );
  }

  // Deleting the conversation and deleting the place it worked are two
  // decisions, and the second is not implied by the first: somebody may be
  // finished with the conversation and not with what it wrote. Both are offered
  // rather than one being taken silently.
  return (
    <>
      <SheetHeader>
        <SheetTitle>Delete conversation</SheetTitle>
      </SheetHeader>
      <div className="px-4 py-3">
        <SheetDescription>
          {asking.hasWork
            ? "This conversation worked in a tree that holds commits."
            : "This conversation has a working tree with nothing committed in it."}
        </SheetDescription>
      </div>
      <SheetFooter>
        <div className="min-w-0 flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onClose();
            settling.forget(asking.row.key);
          }}
        >
          Delete, keep the tree
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            onClose();
            settling.discard(asking.tree.path);
            settling.forget(asking.row.key);
          }}
        >
          Delete both
        </Button>
      </SheetFooter>
    </>
  );
}

/**
 * Which rows are open, given every row there is.
 *
 * Kept the other way round — the ones somebody *closed* — because the tree is
 * rebuilt from a list that grows: a conversation delegated a moment ago would
 * arrive collapsed if openness had to be granted, and the person who delegated
 * it is the one person certain to be looking for it.
 */
export function holdersIn(
  rows: ReadonlyMap<string, SourceTreeItem>,
): readonly string[] {
  return [...rows.values()]
    .filter((row) => row.id !== ROOT && (row.children?.length ?? 0) > 0)
    .map((row) => row.id);
}

/** Which of those are open, given the ones somebody shut. */
export function openRows(
  rows: ReadonlyMap<string, SourceTreeItem>,
  closed: ReadonlySet<string>,
): readonly string[] {
  return holdersIn(rows).filter((id) => !closed.has(id));
}

/** Which row the column is showing, as an id of this tree. */
export function activeIdOf(
  entries: readonly ConversationEntry[],
  chosen: { at: string; key: string } | null,
): string | null {
  if (chosen === null) return null;
  const found = entries.find((entry) => {
    if (chosen.at === "live") return entry.at === "live" && entry.row.key === chosen.key;
    return entry.at === "dormant" && entry.held.acpSession === chosen.key;
  });
  return found === undefined ? null : idOf(found);
}

