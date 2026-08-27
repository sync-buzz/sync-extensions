import type { ExtensionNet, NetAnswer } from "@sync-buzz/extension-api";

/**
 * What an issue is here, and what is deliberately not.
 *
 * GitHub answers with some ninety fields per issue. What survives into this
 * shape is what one of the three columns actually draws — everything else would
 * be data this package carries because it arrived, which is how a reader ends
 * up with a panel of identifiers nobody can act on.
 *
 * Nothing in this file writes anything anywhere. That is the decision this
 * extension exists inside: an issue is somebody else's text about your work,
 * and putting it in the project's memory would make every external sentence a
 * claim the engine has to reconcile against code it is not about — as well as
 * being the obvious way to get text into the corpus that nobody here wrote.
 */
export interface Issue {
  readonly number: number;
  readonly title: string;
  /** Who opened it. GitHub can answer with none — a deleted account. */
  readonly author: string;
  readonly state: string;
  readonly labels: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly comments: number;
  /** The body as Markdown, and empty for an issue whose author wrote none. */
  readonly body: string;
  readonly url: string;
}

/** One repository, as GitHub addresses it. */
export interface Repository {
  readonly owner: string;
  readonly name: string;
}

/**
 * The slices of a repository's issues, which are GitHub's own three.
 *
 * Not this package's invention and deliberately not extended: `state` is what
 * the API takes, so a slice here is one request rather than a filter applied to
 * whatever happened to be fetched. A fourth slice — *mine*, *unanswered* —
 * would need an account, and there is none.
 */
export const SLICES = [
  { id: "open", label: "Open", note: "What is still to be dealt with." },
  { id: "closed", label: "Closed", note: "What was dealt with, however it ended." },
  { id: "all", label: "Everything", note: "Both, newest first." },
] as const;

export type SliceId = (typeof SLICES)[number]["id"];

/** How many are read in one request, which is one page and no more. */
const PAGE = 50;

export const HOST = "api.github.com";

/**
 * What this project's `origin` turns out to be.
 *
 * Two answers rather than one, because *this repository is on GitHub* and *this
 * repository is somewhere else* are different news and a person is owed the
 * difference: one is a list, the other is a sentence saying which forge the
 * project actually uses. Neither of them is a failure.
 */
export type Origin =
  | { readonly kind: "github"; readonly repository: Repository }
  | { readonly kind: "elsewhere"; readonly said: string };

/**
 * Reads `origin` as git states it, in every spelling git states it in.
 *
 * The core hands the URL over whole and unparsed — it does not know what GitHub
 * is, and it must not — so this is where a URL becomes a repository. The
 * spellings are the ordinary four and they are not interchangeable to a naive
 * split:
 *
 * ```text
 * git@github.com:owner/name.git        the scp-like form, whose separator is a colon
 * ssh://git@github.com/owner/name.git  the same remote, written as a URL
 * https://github.com/owner/name.git    what the clone button gives you
 * https://user@github.com/owner/name   with credentials, which are not the host
 * ```
 *
 * `github.com` and nothing else. An enterprise install answers on its own host,
 * and reaching one would need that host in `net.hosts` — which is the manifest's
 * to say, not this function's to assume.
 */
export function readOrigin(url: string): Origin {
  const elsewhere: Origin = { kind: "elsewhere", said: url.trim() };
  const trimmed = url.trim();
  if (trimmed.length === 0) return elsewhere;

  // The scp-like form is not a URL: `git@host:owner/name` has no scheme, and
  // its colon separates the host from the path rather than naming a port.
  const asUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.replace(/^([^/]+?):(?!\/)/, "$1/");

  const withoutScheme = asUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  // Credentials are not the host, and a password may contain anything at all,
  // so everything before the last `@` of the authority goes.
  const authority = withoutScheme.split("/")[0] ?? "";
  const host = (authority.split("@").pop() ?? "").split(":")[0]?.toLowerCase();
  if (host !== "github.com") return elsewhere;

  const path = withoutScheme.slice(authority.length).replace(/^\/+/, "");
  const [owner, name] = path.replace(/\.git$/, "").replace(/\/+$/, "").split("/");
  if (owner === undefined || name === undefined) return elsewhere;
  if (!isSegment(owner) || !isSegment(name)) return elsewhere;
  return { kind: "github", repository: { owner, name } };
}

/**
 * What GitHub allows in an owner or a repository name.
 *
 * Checked because these two words become path segments in the URL that is then
 * requested: a slash or a dot-dot inside one would make the request name a
 * different endpoint than this file believes it is calling. The host check in
 * Rust would still hold — it is the same host — so this is the part only the
 * package can be responsible for.
 */
function isSegment(candidate: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(candidate) && candidate !== "." && candidate !== "..";
}

/** How a repository is written wherever a person reads one. */
export const named = (repository: Repository): string =>
  `${repository.owner}/${repository.name}`;

/**
 * Why a read did not answer, in a sentence rather than in a number.
 *
 * A status is what came back and it is not what a person needs to be told:
 * `404` is *no such public repository*, and `403` from this endpoint is almost
 * always the hour's sixty unauthenticated requests being spent. Each of those
 * is something somebody can act on; the number is not.
 */
export class ReadFailed extends Error {}

/**
 * Reads one slice of one repository, or says why it could not.
 *
 * The `net` handed in is the package's own door — closed over its id, checked
 * in Rust against the hosts this manifest declares — so there is nothing here
 * that decides what may be reached, and nothing here that could widen it.
 */
export async function read(
  net: ExtensionNet,
  repository: Repository,
  slice: SliceId,
): Promise<readonly Issue[]> {
  const url =
    `https://${HOST}/repos/${repository.owner}/${repository.name}/issues` +
    `?state=${slice}&per_page=${PAGE}&sort=updated&direction=desc`;

  let answer: NetAnswer;
  try {
    answer = await net.read(url);
  } catch (refused) {
    // A rejection here is a request that never happened — a host this package
    // did not declare, no network, an answer too large. Rust's sentence is
    // better than anything this could write over it.
    throw new ReadFailed(refused instanceof Error ? refused.message : String(refused));
  }

  if (answer.status === 404) {
    throw new ReadFailed(
      `GitHub has no public repository at ${named(repository)}. A private one answers the same way to a request with no account, which is the only kind this makes.`,
    );
  }
  if (answer.status === 403 || answer.status === 429) {
    throw new ReadFailed(
      "GitHub is not answering any more requests from this machine for now. Reading without an account is allowed sixty times an hour, and the count is per machine rather than per repository.",
    );
  }
  if (answer.status !== 200) {
    throw new ReadFailed(`GitHub answered ${answer.status}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(answer.body);
  } catch {
    throw new ReadFailed("GitHub's answer was not readable as JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new ReadFailed("GitHub answered with something that is not a list of issues.");
  }

  return parsed
    .filter(isRecord)
    // **Every pull request is an issue on this endpoint**, and a list that
    // showed them would be answering a question nobody asked: the section is
    // called Issues, and a review is a different piece of work in a different
    // place. The API marks one with a member rather than with a type, so this
    // is the only way to tell them apart.
    .filter((entry) => entry.pull_request === undefined)
    .map(asIssue);
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null;
}

/**
 * One entry of GitHub's answer, as this package reads it.
 *
 * Every member is defended, and not out of ceremony: this is text from outside
 * the window, and a field that is `null` where a string was expected takes a
 * column down while somebody is reading. What cannot be read reads as absent.
 */
function asIssue(entry: Record<string, unknown>): Issue {
  const user = isRecord(entry.user) ? entry.user : {};
  return {
    number: typeof entry.number === "number" ? entry.number : 0,
    title: text(entry.title, "Untitled"),
    author: text(user.login, "somebody whose account is gone"),
    state: text(entry.state, "open"),
    labels: Array.isArray(entry.labels)
      ? entry.labels
          .map((label) => (isRecord(label) ? text(label.name, "") : ""))
          .filter((label) => label.length > 0)
      : [],
    createdAt: text(entry.created_at, ""),
    updatedAt: text(entry.updated_at, ""),
    comments: typeof entry.comments === "number" ? entry.comments : 0,
    body: text(entry.body, ""),
    url: text(entry.html_url, ""),
  };
}

const text = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

/**
 * A date as this window says one, and the raw string when it is not a date.
 *
 * The locale is the reader's, because this is a timestamp on somebody else's
 * work rather than anything the project stores — nothing about it has to be
 * comparable with a record.
 */
export function when(iso: string): string {
  if (iso.length === 0) return "—";
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
