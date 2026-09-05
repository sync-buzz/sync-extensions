/**
 * What a tab is, and what one holds.
 *
 * A tab is divided into tiles, and the division is a binary tree: a node is
 * either a terminal or two halves with a share of the space between them. It is
 * ordinary serialisable data, free of React and of the DOM, so an arrangement
 * can be decided at a desk rather than by opening the window.
 *
 * The tree is small enough to rebuild rather than edit: every function here
 * answers with a new one and returns the tree it was given, unchanged and by
 * reference, when there was nothing to do. That is what lets a caller tell "the
 * split happened" from "the tile it named is not in this tab" without a second
 * return value — and the caller that needs the distinction is the one holding a
 * shell it has just raised.
 */

/** What a tab is divided into. */
export type Tile =
  | { readonly kind: "terminal"; readonly name: string }
  | {
      readonly kind: "split";
      /** `row` puts the halves beside each other, `column` one above the other. */
      readonly along: "row" | "column";
      /** The share of the space the first half takes, from 0 to 1. */
      readonly ratio: number;
      readonly first: Tile;
      readonly second: Tile;
    };

/** The half of a tile that is a division rather than a terminal. */
export type Divided = Extract<Tile, { kind: "split" }>;

/** Which half of each division to descend into to reach one node. */
export type Path = readonly ("first" | "second")[];

/**
 * The least a half may be reduced to, in pixels.
 *
 * The far end raises a zero to a one, so nothing here is protecting the process
 * — a terminal one column wide is simply of no use to the person who dragged it
 * there, and this window does not offer states that have to be undone.
 */
const LEAST = 120;

/** A tab holding one terminal and nothing else. */
export function one(name: string): Tile {
  return { kind: "terminal", name };
}

/**
 * The terminals an arrangement holds, in the order they are drawn.
 *
 * Read from the tree rather than from anything live, because the caller that
 * needs it most is the one closing a tab — and by then the reason it wants the
 * list is that it is about to throw the tree away.
 */
export function terminals(tree: Tile): string[] {
  if (tree.kind === "terminal") {
    return [tree.name];
  }
  return [...terminals(tree.first), ...terminals(tree.second)];
}

/**
 * Divide the tile `at` is in, and put `raised` in the half that appears.
 *
 * The new half goes second — to the right of a row and below a column — because
 * that is where the eye of somebody reading this window has just come from, and
 * the halves start equal.
 */
export function split(tree: Tile, at: string, raised: string, along: "row" | "column"): Tile {
  if (tree.kind === "terminal") {
    return tree.name === at
      ? { kind: "split", along, ratio: 0.5, first: tree, second: one(raised) }
      : tree;
  }
  const first = split(tree.first, at, raised, along);
  if (first !== tree.first) {
    return { ...tree, first };
  }
  const second = split(tree.second, at, raised, along);
  return second === tree.second ? tree : { ...tree, second };
}

/**
 * Take one terminal out, and answer `null` when it was the only one.
 *
 * A division that loses a half collapses into the half that is left. Leaving
 * the node behind would leave an empty box holding space that nothing draws in,
 * and the person who closed a terminal would read that box as a failure.
 */
export function remove(tree: Tile, name: string): Tile | null {
  if (tree.kind === "terminal") {
    return tree.name === name ? null : tree;
  }
  const first = remove(tree.first, name);
  if (first === null) {
    return tree.second;
  }
  if (first !== tree.first) {
    return { ...tree, first };
  }
  const second = remove(tree.second, name);
  if (second === null) {
    return tree.first;
  }
  return second === tree.second ? tree : { ...tree, second };
}

/**
 * Where one terminal sits: the division holding it, and which half it is.
 *
 * `null` for a tab that has not been divided, which is the tab where moving a
 * terminal is not a command that means anything.
 */
export function seatOf(
  tree: Tile,
  name: string,
  path: Path = [],
): { path: Path; half: "first" | "second"; along: "row" | "column" } | null {
  if (tree.kind !== "split") {
    return null;
  }
  for (const half of ["first", "second"] as const) {
    const side = tree[half];
    if (side.kind === "terminal" && side.name === name) {
      return { path, half, along: tree.along };
    }
    const deeper = seatOf(side, name, [...path, half]);
    if (deeper) {
      return deeper;
    }
  }
  return null;
}

/**
 * Exchange the two halves of one division.
 *
 * This is the whole of moving a terminal, and it is deliberately not more. A
 * gesture that carried a tile anywhere in the tab would need a model of where
 * it may land and a picture of where it is about to; two neighbours trading
 * places needs neither, and it is what somebody who put the wrong shell on the
 * left actually wants.
 */
export function swap(tree: Tile, path: Path): Tile {
  if (tree.kind !== "split") {
    return tree;
  }
  const [half, ...rest] = path;
  if (half === undefined) {
    return { ...tree, first: tree.second, second: tree.first };
  }
  const replaced = swap(tree[half], rest);
  if (replaced === tree[half]) {
    return tree;
  }
  return half === "first" ? { ...tree, first: replaced } : { ...tree, second: replaced };
}

/** Give one division a new share, leaving every other node as it was. */
export function setRatio(tree: Tile, path: Path, ratio: number): Tile {
  if (tree.kind !== "split") {
    return tree;
  }
  const [half, ...rest] = path;
  if (half === undefined) {
    return ratio === tree.ratio ? tree : { ...tree, ratio };
  }
  const replaced = setRatio(tree[half], rest, ratio);
  if (replaced === tree[half]) {
    return tree;
  }
  return half === "first" ? { ...tree, first: replaced } : { ...tree, second: replaced };
}

/**
 * The share a divider dropped `offset` along a box of `size` gives the first
 * half, with neither half allowed under `LEAST`.
 *
 * Where the box is too small to give both halves that much, the divider stops
 * in the middle rather than refusing to move: a bound that cannot be satisfied
 * is still a bound, and halving is the only answer that treats the two the
 * same.
 */
export function shareAt(offset: number, size: number): number {
  if (size <= 0) {
    return 0.5;
  }
  const least = Math.min(LEAST / size, 0.5);
  const most = Math.max(1 - LEAST / size, 0.5);
  return Math.min(Math.max(offset / size, least), most);
}

/**
 * Where exchanging places would put a terminal, in the words of the window.
 *
 * The label says the direction rather than the gesture, because the command is
 * the only account of where the tile is about to go: there is no picture of the
 * landing place and nothing to aim at.
 */
export function moveLabel(seat: { half: "first" | "second"; along: "row" | "column" }): string {
  if (seat.along === "row") {
    return seat.half === "first" ? "Move Right" : "Move Left";
  }
  return seat.half === "first" ? "Move Down" : "Move Up";
}

/**
 * A name for a new tab that is not already taken.
 *
 * Numbered rather than named after what is running in it: a tab holds several
 * shells and they are running different things, so a name taken from one of
 * them would be wrong as soon as somebody split it. What it is really called is
 * whatever the person types over this.
 */
export function unusedName(taken: readonly string[]): string {
  const base = "Terminal";
  if (!taken.includes(base)) {
    return base;
  }
  for (let ordinal = 2; ; ordinal += 1) {
    const candidate = `${base} ${ordinal}`;
    if (!taken.includes(candidate)) {
      return candidate;
    }
  }
}
