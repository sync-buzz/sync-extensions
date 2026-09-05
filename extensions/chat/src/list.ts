/**
 * How the column is arranged: which conversations are grouped together, and
 * which came out of which.
 *
 * Apart from the screen that draws it, and the reason is testability rather
 * than tidiness. Everything here is a pure function of a list, so it can be
 * asked a question and checked — and it is the half of this package where being
 * wrong is invisible: a row in the wrong group still draws, still opens, and
 * still says everything true about itself. Nothing catches that but a test or a
 * person noticing months later.
 *
 * **Nothing here imports the host.** The two types it names are erased at
 * build, so this module runs anywhere — which is what lets a test load it
 * without a window, an agent or a project.
 */

import type { RememberedConversation, SessionRow, SessionSource } from "@sync-buzz/extension-api";

/**
 * A conversation in the navigator: one this run is holding, or one from before
 * it that the agent can be asked for back.
 *
 * They are the same thing at two moments and are listed together, so what
 * distinguishes them is a tag rather than a heading.
 */
export type ConversationEntry =
  | { readonly at: "live"; readonly at_ms: number; readonly row: SessionRow }
  | {
      readonly at: "dormant";
      readonly at_ms: number;
      readonly held: RememberedConversation;
    };

/**
 * Who asked for a conversation, whichever half of the list it came from.
 *
 * One function because a live row and a pointer answer this the same way and
 * must go on doing so: a conversation that changed groups the moment its agent
 * stopped would be the "Running"/"Not running" mistake again, one field over.
 */
export function orderedBy(entry: ConversationEntry): SessionSource | undefined {
  return entry.at === "live" ? entry.row.source : entry.held.source;
}

/**
 * What a conversation is called when another one names it: the agent's own id
 * for it, which both halves of the list carry.
 *
 * `undefined` on a live row that has said nothing yet — an agent issues the id
 * with the first turn. Such a row is nobody's parent, and that is the truth
 * rather than a gap: nothing has been delegated from a conversation that has
 * not started.
 */
export function namedBy(entry: ConversationEntry): string | undefined {
  return entry.at === "live" ? entry.row.acpSession : entry.held.acpSession;
}

/** The conversation this one was delegated from, whichever half it came from. */
export function delegatedFrom(entry: ConversationEntry): string | undefined {
  return entry.at === "live" ? entry.row.parent : entry.held.parent;
}

/** One conversation and the ones delegated from it. */
export interface Descent {
  readonly entry: ConversationEntry;
  /** Newest first, as they arrived. Empty for most conversations. */
  readonly children: readonly ConversationEntry[];
}

/**
 * The list of one group, arranged as what came out of what.
 *
 * **Inside a group and never across two.** A delegated conversation is filed
 * where its parent is — the host reads both the orderer and the record from the
 * parent rather than from whoever asked — so a child is in its parent's group
 * by construction. Resolving parents within the group is therefore the same
 * answer as resolving them across the column, and it is the answer that cannot
 * pull a row out from under the heading it was drawn beneath.
 *
 * **A parent nothing here names is no parent at all.** A project keeps a
 * hundred pointers and a child may outlive the row it came out of, so a
 * `parent` that resolves to nothing draws the child at the top level rather
 * than hiding it under a row that is not there.
 *
 * The order the entries arrive in is kept, top level and children alike, so
 * "what happened last" stays where it was.
 */
export function descended(entries: readonly ConversationEntry[]): readonly Descent[] {
  const here = new Set<string>();
  for (const entry of entries) {
    const id = namedBy(entry);
    if (id !== undefined) here.add(id);
  }

  // Which row each entry hangs from, before it is known whether that row is
  // itself hanging from something.
  const from = entries.map((entry) => {
    const parent = delegatedFrom(entry);
    return parent !== undefined && here.has(parent) ? parent : null;
  });

  // The rows that may hold children: the ones that hang from nothing. A chain
  // three conversations long is refused by the host, so nothing should hang
  // from a row that hangs from another — and if one ever did, drawing it at the
  // top level is the better of the two failures. The other is a row that is in
  // the list and on no screen.
  const holders = new Set<string>();
  entries.forEach((entry, at) => {
    if (from[at] !== null) return;
    const id = namedBy(entry);
    if (id !== undefined) holders.add(id);
  });

  const children = new Map<string, ConversationEntry[]>();
  const top: ConversationEntry[] = [];
  entries.forEach((entry, at) => {
    const parent = from[at];
    if (parent === null || !holders.has(parent)) {
      top.push(entry);
      return;
    }
    const held = children.get(parent);
    if (held === undefined) children.set(parent, [entry]);
    else held.push(entry);
  });

  return top.map((entry) => {
    const id = namedBy(entry);
    return {
      entry,
      children: (id === undefined ? undefined : children.get(id)) ?? [],
    };
  });
}

/** One heading and the conversations under it. */
export interface Bucket {
  /**
   * What the group is keyed by, which is not what it is named after: two
   * headings can read the same and must still be two headings.
   */
  readonly key: string;

  readonly label: string;
  readonly entries: readonly ConversationEntry[];
}

/**
 * The list, split by the record each conversation is being held under.
 *
 * **A group per record, and the rest together.** Somebody who set an extension
 * working on five tickets is watching five conversations that belong to one
 * thing, and a caption on each row would make them read every row to find out
 * which. A heading answers it once, collapses when they are done with it, and
 * keeps saying how many there are while collapsed.
 *
 * It was the *extension* that named the heading first, and the record is the
 * better answer for a reason the extension could not give: a conversation
 * somebody opened from a task has no orderer at all, so grouping by who asked
 * left every one of those in the undifferentiated heap — which is most of what
 * a section that hands work to an agent produces. "Support worktrees" also says
 * more than "Tasks" to somebody scanning the column, and it is a heading that
 * can be opened.
 *
 * **The orderer is still the answer where there is no record.** Work ordered
 * about nothing in particular — a routine that runs on a clock and reports —
 * has a name for who asked and nothing else, and asking only about records
 * dropped every one of those into the heap of conversations somebody opened
 * themselves. That heap is the one they are least like: nobody typed them.
 * Both facts are set when the conversation is opened and never edited, so
 * neither can move a row out from under somebody reading it, which is the one
 * property this split needs.
 *
 * **Groups are ordered by their newest conversation, and so are the rows inside
 * them.** That is what keeps "what happened last" at the top of the list rather
 * than somewhere inside the third group: splitting the list must not cost the
 * one order it always had.
 *
 * The conversations under no record and nobody's order lead, whether or not
 * anything else is there. They are the ones somebody opened here, and a
 * person's own work does not move down the window because an extension has
 * begun some.
 */
export function bucketed(entries: readonly ConversationEntry[]): readonly Bucket[] {
  const loose: ConversationEntry[] = [];
  const named = new Map<string, { label: string; entries: ConversationEntry[] }>();

  for (const entry of entries) {
    // **The orderer, never the record.** Grouping by the record was tried and
    // it dissolved the list: a section hands work over one record at a time, so
    // five tasks made five headings with one conversation under each — a list
    // of headings is not a list of conversations, and every one of them had to
    // be read to find anything.
    //
    // What the record answers is *which* work, and that is a fact about one
    // conversation rather than about a group of them. It is on the row, where a
    // person reads down a column of them, and the row's own menu opens it.
    const source = orderedBy(entry);
    const heading =
      source !== undefined
        ? { key: `orderer:${source.extensionId}`, label: source.extensionName }
        : null;
    if (heading === null) {
      loose.push(entry);
      continue;
    }
    const held = named.get(heading.key);
    if (held === undefined) {
      // The label from the newest conversation, because the entries arrive
      // newest first and a record that was renamed should be called what the
      // most recent work called it rather than what the first did. A package
      // that was renamed goes stale in the same direction.
      named.set(heading.key, {
        label: heading.label,
        entries: [entry],
      });
    } else {
      held.entries.push(entry);
    }
  }

  const ordered: Bucket[] = [...named]
    .map(([key, held]) => ({
      key,
      label: held.label,
      entries: held.entries,
    }))
    .sort((left, right) => (right.entries[0]?.at_ms ?? 0) - (left.entries[0]?.at_ms ?? 0));

  return loose.length === 0
    ? ordered
    : [{ key: "loose", label: "Conversations", entries: loose }, ...ordered];
}

/** What a conversation is called, whichever half of the list it came from. */
export function titleOf(entry: ConversationEntry): string | undefined {
  const called = entry.at === "live" ? entry.row.title : entry.held.title;
  return called === null || called === undefined || called.trim() === ""
    ? undefined
    : called.trim();
}

/**
 * The conversation a family calls by this name, if one of them does.
 *
 * **A family and not the whole column.** Two people working on two things can
 * each have a `@review`, and a name is only ever typed from inside one
 * conversation — so the question *which review* has an answer without anybody
 * having to disambiguate. Every conversation delegated from `root` is in the
 * family, and so is `root` itself: a child handing work over hands it to a
 * sibling, because a chain is two deep and a third link is refused.
 *
 * **Matched without regard to case.** `@Test` and `@test` are one name to the
 * person who typed them, and treating them as two would open a second
 * conversation for a shift key — the silent branch this whole shape refuses.
 */
export function calledIn(
  entries: readonly ConversationEntry[],
  root: string,
  name: string,
): ConversationEntry | undefined {
  const wanted = name.trim().toLowerCase();
  if (wanted === "") return undefined;
  return entries.find((entry) => {
    const under = delegatedFrom(entry) ?? namedBy(entry);
    if (under !== root) return false;
    return titleOf(entry)?.toLowerCase() === wanted;
  });
}
