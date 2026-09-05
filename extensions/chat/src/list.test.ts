/**
 * What the column must go on doing, said as questions rather than as prose.
 *
 * These are the cases that are invisible when they break: a row in the wrong
 * group draws perfectly, opens perfectly and says everything true about itself.
 * Nothing here needs a window, an agent or a project — the module under test
 * imports no host — so the fixtures are the two shapes the list is made of and
 * nothing else.
 */

import { describe, expect, test } from "vitest";

import { bucketed, calledIn, descended, titleOf, type ConversationEntry } from "./list";

/** A live row, with only what the arrangement reads. */
function live(
  key: string,
  at: {
    ms?: number;
    session?: string;
    parent?: string;
    orderedBy?: { id: string; name: string };
  } = {},
): ConversationEntry {
  return {
    at: "live",
    at_ms: at.ms ?? 0,
    row: {
      key,
      agentId: "claude",
      agentName: "Claude",
      acceptsImages: true,
      title: key,
      project: "/repo",
      cwd: "/repo",
      status: "ready",
      openedAtMs: at.ms ?? 0,
      acpSession: at.session,
      parent: at.parent,
      source:
        at.orderedBy === undefined
          ? undefined
          : {
              work: "w1",
              extensionId: at.orderedBy.id,
              extensionName: at.orderedBy.name,
              handler: "h",
            },
    },
  };
}

/** A pointer to a conversation from a previous run. */
function dormant(
  session: string,
  at: { ms?: number; parent?: string; orderedBy?: { id: string; name: string } } = {},
): ConversationEntry {
  return {
    at: "dormant",
    at_ms: at.ms ?? 0,
    held: {
      acpSession: session,
      agentId: "claude",
      agentName: "Claude",
      cwd: "/repo",
      title: session,
      openedAtMs: at.ms ?? 0,
      lastSeenMs: at.ms ?? 0,
      parent: at.parent,
      source:
        at.orderedBy === undefined
          ? undefined
          : {
              work: "w1",
              extensionId: at.orderedBy.id,
              extensionName: at.orderedBy.name,
              handler: "h",
            },
    },
  };
}

describe("descended", () => {
  test("a delegated conversation is drawn under the one it came out of", () => {
    // Newest first, which is how the list arrives: the child is younger than
    // its parent, so it is seen before the row it hangs from.
    const roots = descended([
      live("child", { ms: 2, parent: "parent-session" }),
      live("parent", { ms: 1, session: "parent-session" }),
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.entry).toMatchObject({ at: "live", row: { key: "parent" } });
    expect(roots[0]?.children.map((child) => child.at === "live" && child.row.key)).toEqual([
      "child",
    ]);
  });

  test("both halves of the list answer to each other", () => {
    // The case the tree exists for: the parent was stopped and is a pointer
    // now, the child is still running. Neither is a reason for the descent to
    // flatten — that would be the "Running"/"Not running" mistake again.
    const roots = descended([
      live("child", { ms: 2, parent: "parent-session" }),
      dormant("parent-session", { ms: 1 }),
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.entry).toMatchObject({ at: "dormant" });
    expect(roots[0]?.children).toHaveLength(1);
  });

  test("a parent nothing in the list names is no parent at all", () => {
    // A project keeps a hundred pointers and a child may outlive the row above
    // it. The child is still a conversation somebody can open.
    const roots = descended([live("orphan", { ms: 1, parent: "pruned-long-ago" })]);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.children).toEqual([]);
  });

  test("a third conversation in a chain is drawn rather than lost", () => {
    // The host refuses to make one. If one ever arrived, the failure to prefer
    // is a row in the wrong place — never a row on no screen.
    const drawn = descended([
      live("grandchild", { ms: 3, session: "c", parent: "b" }),
      live("child", { ms: 2, session: "b", parent: "a" }),
      live("parent", { ms: 1, session: "a" }),
    ]);

    const keys = drawn.flatMap((node) => [
      node.entry.at === "live" && node.entry.row.key,
      ...node.children.map((child) => child.at === "live" && child.row.key),
    ]);
    expect(keys).toContain("grandchild");
    expect(keys).toContain("child");
    expect(keys).toContain("parent");
  });

  test("the order the entries arrived in is kept, above and below", () => {
    const roots = descended([
      live("younger-child", { ms: 4, parent: "p" }),
      live("older-child", { ms: 3, parent: "p" }),
      live("parent", { ms: 2, session: "p" }),
      live("other", { ms: 1 }),
    ]);

    expect(roots.map((node) => node.entry.at === "live" && node.entry.row.key)).toEqual([
      "parent",
      "other",
    ]);
    expect(roots[0]?.children.map((child) => child.at === "live" && child.row.key)).toEqual([
      "younger-child",
      "older-child",
    ]);
  });

  test("a conversation that has said nothing yet holds no children", () => {
    // It has no id for another row to name, which is the truth rather than a
    // gap: nothing is delegated from a conversation that has not started.
    const roots = descended([live("silent", { ms: 1 }), live("other", { ms: 2 })]);

    expect(roots).toHaveLength(2);
    expect(roots.every((node) => node.children.length === 0)).toBe(true);
  });
});

describe("bucketed", () => {
  test("a delegated conversation lands in its parent's group", () => {
    // Not an arrangement this makes: the host reads the orderer from the
    // parent, so the two arrive carrying the same one. The descent relies on
    // it, which is why it is asked here rather than assumed.
    const groups = bucketed([
      live("child", { ms: 2, parent: "p", orderedBy: { id: "chat", name: "Chat" } }),
      live("parent", { ms: 1, session: "p", orderedBy: { id: "chat", name: "Chat" } }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries).toHaveLength(2);
  });

  test("what nobody ordered leads, whatever else is there", () => {
    const groups = bucketed([
      live("ordered", { ms: 2, orderedBy: { id: "routines", name: "Routines" } }),
      live("mine", { ms: 1 }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["loose", "orderer:routines"]);
  });
});

describe("calledIn", () => {
  test("a name finds the conversation of that family called it", () => {
    const root = live("parent", { session: "root" });
    const child = live("Review", { session: "s-review", parent: "root" });

    expect(calledIn([root, child], "root", "review")).toBe(child);
  });

  test("a name of another family is not this family's", () => {
    // Two people working on two things can each have a review, and a name is
    // only ever typed from inside one conversation.
    const mine = live("parent", { session: "root" });
    const theirs = live("Review", { session: "s-other", parent: "elsewhere" });

    expect(calledIn([mine, theirs], "root", "review")).toBeUndefined();
  });

  test("a name nobody in the family carries is nobody", () => {
    const root = live("parent", { session: "root" });

    // The whole of *an opening is a choice, not a typo*: this answering with
    // something would be how a shift key opens a second conversation.
    expect(calledIn([root], "root", "reveiw")).toBeUndefined();
  });

  test("a dormant conversation answers to its name as a live one does", () => {
    const root = live("parent", { session: "root" });
    const held = dormant("s-review", { parent: "root" });

    expect(calledIn([root, held], "root", titleOf(held)!)).toBe(held);
  });
});
