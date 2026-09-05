import { describe, expect, it } from "vitest";

import {
  type Tile,
  moveLabel,
  one,
  remove,
  seatOf,
  setRatio,
  shareAt,
  split,
  swap,
  terminals,
  unusedName,
} from "./tabs";

/** Two halves beside each other, the second of them divided again. */
function nested(): Tile {
  return split(split(one("a"), "a", "b", "row"), "b", "c", "column");
}

describe("a new tab", () => {
  it("holds exactly one terminal", () => {
    expect(terminals(one("terminal-1"))).toEqual(["terminal-1"]);
  });
});

describe("dividing a tile", () => {
  it("puts the raised shell in the half that appears, and starts them equal", () => {
    const tree = split(one("a"), "a", "b", "row");
    expect(tree).toEqual({
      kind: "split",
      along: "row",
      ratio: 0.5,
      first: { kind: "terminal", name: "a" },
      second: { kind: "terminal", name: "b" },
    });
  });

  it("divides the tile that was named, however deep it is", () => {
    expect(terminals(nested())).toEqual(["a", "b", "c"]);
    const deeper = split(nested(), "c", "d", "row");
    expect(terminals(deeper)).toEqual(["a", "b", "c", "d"]);
  });

  // The caller has a shell in its hand by the time this answers, so "nothing
  // happened" has to be something it can read — otherwise it ends a process it
  // just raised, or leaves one running that nothing draws.
  it("answers with the tree it was given when the tile is not in it", () => {
    const tree = nested();
    expect(split(tree, "gone", "d", "row")).toBe(tree);
  });
});

describe("closing a tile", () => {
  it("collapses the division into the half that is left", () => {
    const tree = split(one("a"), "a", "b", "row");
    expect(remove(tree, "b")).toEqual({ kind: "terminal", name: "a" });
    expect(remove(tree, "a")).toEqual({ kind: "terminal", name: "b" });
  });

  it("leaves no empty box behind when the half that goes was itself divided", () => {
    const tree = nested();
    expect(remove(tree, "a")).toEqual(
      split(one("b"), "b", "c", "column"),
    );
  });

  it("says so when there is nothing left", () => {
    expect(remove(one("a"), "a")).toBeNull();
  });

  it("answers with the tree it was given when the tile is not in it", () => {
    const tree = nested();
    expect(remove(tree, "gone")).toBe(tree);
  });
});

describe("moving a divider", () => {
  it("writes the share of the division the path names", () => {
    const tree = nested();
    const moved = setRatio(tree, ["second"], 0.25);
    // The outer division is untouched, and the inner one carries the new share.
    expect(terminals(moved)).toEqual(["a", "b", "c"]);
    expect(moved.kind === "split" && moved.ratio).toBe(0.5);
    expect(
      moved.kind === "split" && moved.second.kind === "split" && moved.second.ratio,
    ).toBe(0.25);
  });

  it("leaves the tree alone when the share it already has is the one asked for", () => {
    const tree = nested();
    expect(setRatio(tree, [], 0.5)).toBe(tree);
  });
});

describe("where a terminal sits", () => {
  it("says which half of which division holds it, and which way it runs", () => {
    expect(seatOf(nested(), "a")).toEqual({ path: [], half: "first", along: "row" });
    expect(seatOf(nested(), "b")).toEqual({ path: ["second"], half: "first", along: "column" });
    expect(seatOf(nested(), "c")).toEqual({ path: ["second"], half: "second", along: "column" });
  });

  // Moving is exchanging places with a neighbour, and the only terminal in a
  // tab has none. The command has to be absent rather than present and idle.
  it("says nothing of a tab that was never divided", () => {
    expect(seatOf(one("a"), "a")).toBeNull();
    expect(seatOf(nested(), "gone")).toBeNull();
  });
});

describe("moving a terminal", () => {
  it("exchanges the two halves of the division it names", () => {
    expect(terminals(swap(nested(), []))).toEqual(["b", "c", "a"]);
    expect(terminals(swap(nested(), ["second"]))).toEqual(["a", "c", "b"]);
  });

  it("leaves a tab that was never divided alone", () => {
    const tree = one("a");
    expect(swap(tree, [])).toBe(tree);
  });
});

describe("naming the move", () => {
  it("says where the tile is going, not what the gesture is", () => {
    expect(moveLabel({ half: "first", along: "row" })).toBe("Move Right");
    expect(moveLabel({ half: "second", along: "row" })).toBe("Move Left");
    expect(moveLabel({ half: "first", along: "column" })).toBe("Move Down");
    expect(moveLabel({ half: "second", along: "column" })).toBe("Move Up");
  });
});

describe("where a divider may be dropped", () => {
  it("follows the pointer in the middle of a box", () => {
    expect(shareAt(400, 1000)).toBeCloseTo(0.4);
  });

  it("keeps 120 px on each side however far the pointer goes", () => {
    expect(shareAt(0, 1000)).toBeCloseTo(0.12);
    expect(shareAt(1000, 1000)).toBeCloseTo(0.88);
    expect(shareAt(-500, 1000)).toBeCloseTo(0.12);
  });

  // Both bounds cannot be honoured at once, so neither side is preferred.
  it("halves a box too small to hold both", () => {
    expect(shareAt(10, 200)).toBe(0.5);
    expect(shareAt(190, 200)).toBe(0.5);
    expect(shareAt(0, 0)).toBe(0.5);
  });
});

describe("naming a tab", () => {
  it("does not repeat one that is taken", () => {
    expect(unusedName([])).toBe("Terminal");
    expect(unusedName(["Terminal"])).toBe("Terminal 2");
    expect(unusedName(["Terminal", "Terminal 2"])).toBe("Terminal 3");
  });

  it("takes the lowest number nobody is using", () => {
    // Somebody renamed or closed the second one. Counting from the end instead
    // would climb for ever in a window somebody works in all day.
    expect(unusedName(["Terminal", "Terminal 3"])).toBe("Terminal 2");
  });
});
