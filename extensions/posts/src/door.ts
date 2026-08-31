/**
 * The way out of this package, and what everything on the other side has in
 * common.
 *
 * One file per network, and this is what those four files share: the shape of
 * the door, the refusal a person reads, and the two or three lines of parsing
 * that every JSON API needs. Nothing here knows a network — a name in this file
 * would be the first crack in the arrangement it exists to hold.
 *
 * **The door is described rather than imported.** Both halves of this package
 * reach the network and are handed two different objects to do it with: the
 * window gets `host.net`, a handler gets the service module's `net`. They are
 * the same shape and neither type knows about the other, so this file names the
 * shape and takes whichever arrives — which is what lets one description of a
 * network serve a screen and an agent's tool without being written twice.
 */

export interface Door {
  fetch(request: {
    readonly url: string;
    readonly method?: string;
    readonly headers?: { readonly [name: string]: string };
    readonly body?: string;
  }): Promise<NetResponse>;
}

/** What came back, as much of it as this package reads. */
export interface NetResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: { readonly [name: string]: string };
  readonly body: string;
}

/**
 * Why a request did not do what was asked, in a sentence rather than a number.
 *
 * A status is what came back and it is not what a person needs to be told: a
 * `401` from any of these APIs is almost always a credential that has run out,
 * and *your access expired, connect the channel again* is something somebody
 * can act on where *401* is not.
 */
export class Refused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Refused";
  }
}

/**
 * Make the request, and turn a door's refusal into this package's own.
 *
 * A rejection from `net.fetch` is a request that never happened — a host the
 * manifest does not name, no network, an answer too large. Rust's sentence is
 * better than anything written over it, so it is carried through rather than
 * replaced.
 */
export async function ask(
  net: Door,
  request: Parameters<Door["fetch"]>[0],
): Promise<NetResponse> {
  try {
    return await net.fetch(request);
  } catch (refused) {
    throw new Refused(refused instanceof Error ? refused.message : String(refused));
  }
}

/** A JSON body, or an empty object where there was none to read. */
export function read(body: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** One member of a parsed answer, as a string, and `""` for anything else. */
export const text = (value: unknown): string =>
  typeof value === "string" ? value : "";

/** One member as a string, including the numbers an API answers with. */
export const scalar = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

/** One member that is an object, for an error nested inside one. */
export const within = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

/**
 * The part of an error body worth showing somebody.
 *
 * Every one of these APIs puts a sentence in its error, and each puts it under
 * a name of its own — `message` for LinkedIn and Bluesky, `description` for
 * Telegram, `error.message` for Threads. They are read in turn rather than
 * per-network, because the alternative is four near-identical functions whose
 * only difference is which of four names they try first.
 *
 * Anything with no sentence in it is shown as itself, shortened. A panel is not
 * a place to print a page of JSON, and a person reading it wants the sentence.
 */
export function brief(body: string): string {
  const parsed = read(body);
  const sentence =
    text(parsed.message) ||
    text(parsed.description) ||
    text(within(parsed.error).message) ||
    text(parsed.error_description);
  if (sentence !== "") return sentence;
  const trimmed = body.trim();
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
}

/** What to say about a status the file above has no sentence for. */
export function said(label: string, answer: NetResponse): string {
  const detail = brief(answer.body);
  return detail === ""
    ? `${label} answered ${answer.status}.`
    : `${label} answered ${answer.status}: ${detail}`;
}

/**
 * A form body, for the API here that takes its arguments that way.
 *
 * `encodeURIComponent` and a `+` for a space, which is what
 * `application/x-www-form-urlencoded` means and what `encodeURIComponent` alone
 * does not do — it spells a space `%20`, which most servers accept and the
 * specification does not ask for.
 */
export function form(values: Readonly<Record<string, string>>): string {
  return Object.entries(values)
    .map(([name, value]) => `${escape_(name)}=${escape_(value)}`)
    .join("&");
}

const escape_ = (value: string) =>
  encodeURIComponent(value).replace(/%20/g, "+");
