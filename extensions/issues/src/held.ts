import type { Issue, Repository, SliceId } from "./github";

/**
 * What this machine remembers between one visit and the next.
 *
 * **This is where the list lives, and it is the whole of where it lives.** The
 * project's memory holds claims about this repository's own code; a hundred
 * issues written by other people are neither about it nor verifiable against
 * it, so they stay on the machine that read them. It is the same rule the
 * window keeps for a type filter and for the order of the sections — what
 * somebody is looking at is theirs and does not travel through the repository.
 *
 * One thing is kept: what was read, per repository and slice. Which repository
 * this is was a second thing until the section learned to ask `origin`, and the
 * answer is better for it — a repository stored here could disagree with the
 * project it was stored under, and nothing would have said so.
 *
 * Everything here fails quietly. Storage can be full, disabled, or refused, and
 * none of that is worth a sentence to somebody reading an issue: the cost of
 * losing this is one request and a column that draws a moment later.
 */

/** How long a cached list is worth showing before it is read again. */
const FRESH_FOR = 5 * 60 * 1000;

interface Cached {
  readonly at: number;
  readonly issues: readonly Issue[];
}

const listSlot = (repository: Repository, slice: SliceId) =>
  `issues.list:${repository.owner}/${repository.name}:${slice}`;

/**
 * What was last read, and how long ago.
 *
 * Answers with the list even when it is old, and says so separately. A person
 * with no network is better served by yesterday's issues than by an empty
 * column — the same bargain the marketplace makes with its index — and *how
 * old* is what lets the column say which of the two it is showing.
 */
export function cached(
  repository: Repository,
  slice: SliceId,
): { issues: readonly Issue[]; fresh: boolean } | null {
  try {
    const stored = globalThis.localStorage?.getItem(listSlot(repository, slice));
    if (stored === null || stored === undefined) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as Cached).issues)
    ) {
      return null;
    }
    const held = parsed as Cached;
    return { issues: held.issues, fresh: Date.now() - held.at < FRESH_FOR };
  } catch {
    return null;
  }
}

export function remember(
  repository: Repository,
  slice: SliceId,
  issues: readonly Issue[],
): void {
  try {
    const held: Cached = { at: Date.now(), issues };
    globalThis.localStorage?.setItem(listSlot(repository, slice), JSON.stringify(held));
  } catch {
    // A list too large for storage is a list that is read again next time.
  }
}
