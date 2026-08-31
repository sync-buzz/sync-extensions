/**
 * How this package reaches Bluesky, and everything about Bluesky there is.
 *
 * **The credential is an app password, not the account's own.** It is issued in
 * Bluesky's settings, works with two-factor sign-in on, and is revoked from the
 * same screen without touching anything else — which is why this file asks for
 * one by name everywhere it can be read.
 *
 * **A session is made for each request and kept nowhere.** The token
 * `createSession` answers with lives about two hours, so a stored one would be
 * a value that is usually stale, kept in a vault whose whole purpose is that
 * what is in it works. Making one costs a round trip on the way to a post
 * somebody is already waiting for.
 */

import { Refused, ask, brief, read, said, text, type Door } from "./door";

/**
 * The server this package talks to.
 *
 * The host `bsky.social` is the one the manifest declares, and it is the PDS
 * for accounts made through the app. An account hosted on a server of its own
 * cannot be reached from here at all: the manifest names the hosts a package
 * may dial, a person agrees to that list before installing, and a name typed
 * into a record afterwards would be reach nobody agreed to.
 */
const HOST = "https://bsky.social";

/** What a post is, in the vocabulary of the repository it is written into. */
const COLLECTION = "app.bsky.feed.post";

/** Who an app password belongs to, as Bluesky answers it. */
export interface Whose {
  /** The DID, which is what a post is written under and never changes. */
  readonly author: string;
  /** The handle, which is what a person reads and can change. */
  readonly account: string;
}

/**
 * Open a session, which is both how a credential is checked and how a post is
 * signed.
 *
 * The handle is read back rather than kept as typed: somebody types
 * `@name.bsky.social` or their old handle, and what the channel should say is
 * what the account is called now.
 */
async function session(
  net: Door,
  handle: string,
  password: string,
): Promise<{ did: string; handle: string; jwt: string }> {
  const answer = await ask(net, {
    url: `${HOST}/xrpc/com.atproto.server.createSession`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // A leading `@` is how a handle is written everywhere a person reads one
    // and is not part of it, so it is dropped here rather than refused.
    body: JSON.stringify({
      identifier: handle.replace(/^@/, ""),
      password,
    }),
  });

  const parsed = read(answer.body);

  // Named rather than read off the status: an account with two-factor sign-in
  // answers `401` like a wrong password does, and telling somebody their app
  // password is wrong when it is not costs them a trip to reset it.
  if (text(parsed.error) === "AuthFactorTokenRequired") {
    throw new Refused(
      "This account asks for a sign-in code by email, which an app password cannot answer. Bluesky issues app passwords in Settings ▸ Privacy and security ▸ App passwords, and one of those signs in without a code.",
    );
  }
  if (answer.status === 401) {
    throw new Refused(
      "Bluesky did not accept that handle and app password. An app password is the one made in Settings ▸ Privacy and security ▸ App passwords — the account's own password is refused here even when it is right.",
    );
  }
  if (answer.status === 400 && text(parsed.error) === "AccountTakedown") {
    throw new Refused("Bluesky says this account is suspended, so nothing can be posted as it.");
  }
  if (!answer.ok) throw new Refused(said("Bluesky", answer));

  const did = text(parsed.did);
  const jwt = text(parsed.accessJwt);
  if (did === "" || jwt === "") {
    throw new Refused("Bluesky answered without a session in it.");
  }
  return { did, handle: text(parsed.handle) || handle, jwt };
}

/**
 * Check an app password, and say whose it is.
 *
 * Called before the password is stored rather than after, for the reason every
 * network here is checked that way: one that will not open a session is one
 * that would have failed at the moment somebody pressed Publish.
 */
export async function whose(net: Door, handle: string, password: string): Promise<Whose> {
  const opened = await session(net, handle, password);
  return { author: opened.did, account: opened.handle };
}

/** One post, as it goes out. */
export interface Outgoing {
  readonly password: string;
  /** The handle, which is what opens a session. */
  readonly account: string;
  /** The DID, which is the repository the post is written into. */
  readonly author: string;
  readonly text: string;
}

/**
 * Publish one text post, and answer with the AT URI Bluesky gave it.
 *
 * The URI is the identifier: it names the repository and the record inside it,
 * so it stays valid when the handle changes, which handles do.
 */
export async function post(net: Door, outgoing: Outgoing): Promise<string> {
  const opened = await session(net, outgoing.account, outgoing.password);
  const facets = links(outgoing.text);

  const answer = await ask(net, {
    url: `${HOST}/xrpc/com.atproto.repo.createRecord`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${opened.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // The DID from the channel rather than from the session: they are the
      // same account, and the one in the record is the one somebody connected.
      repo: outgoing.author,
      collection: COLLECTION,
      record: {
        $type: COLLECTION,
        text: outgoing.text,
        createdAt: new Date().toISOString(),
        ...(facets.length > 0 ? { facets } : {}),
      },
    }),
  });

  if (answer.status === 401) {
    throw new Refused(
      "Bluesky stopped accepting this channel's app password. Issue a new one in Settings ▸ Privacy and security ▸ App passwords and connect the channel again.",
    );
  }
  if (answer.status === 400) {
    throw new Refused(`Bluesky would not take this post as written: ${brief(answer.body)}`);
  }
  if (!answer.ok) throw new Refused(said("Bluesky", answer));

  const uri = text(read(answer.body).uri);
  if (uri === "") {
    // The post went out; Bluesky simply did not name it in a shape this reads.
    // Saying so beats failing, which would lose the record of something that
    // has already happened.
    return "";
  }
  return uri;
}

/** One stretch of the text that means something more than its characters. */
interface Facet {
  readonly index: { readonly byteStart: number; readonly byteEnd: number };
  readonly features: readonly { readonly $type: string; readonly uri: string }[];
}

/**
 * The links in a post, spelled the way Bluesky needs them.
 *
 * **Without this a link is not a link.** Bluesky stores the text plainly and
 * takes every piece of meaning from a separate list of ranges, so a post
 * carrying an address and no facet shows the address as prose that nobody can
 * follow — the one failure in this file that produces no error anywhere and is
 * seen only by whoever reads the post.
 *
 * **The ranges are counted in UTF-8 bytes**, which is the format's own unit and
 * not the one JavaScript counts in. A range measured in characters lands inside
 * a letter the moment a post has an emoji or a Cyrillic word before its link,
 * and the link ends up highlighting the wrong stretch of the sentence.
 */
function links(body: string): Facet[] {
  const facets: Facet[] = [];
  const finding = /https?:\/\/[^\s<>]+/g;
  let found: RegExpExecArray | null = finding.exec(body);

  while (found !== null) {
    // Trailing punctuation is the sentence's, not the address's: *see
    // https://example.com.* ends a sentence and does not name a host called
    // `com.`. Parentheses are left alone — they occur inside real addresses.
    const uri = found[0].replace(/[.,;:!?"'”’]+$/, "");
    if (uri !== "") {
      const byteStart = bytes(body.slice(0, found.index));
      facets.push({
        index: { byteStart, byteEnd: byteStart + bytes(uri) },
        features: [{ $type: "app.bsky.richtext.facet#link", uri }],
      });
    }
    found = finding.exec(body);
  }

  return facets;
}

/**
 * How many bytes a string is once encoded, counted rather than encoded.
 *
 * `TextEncoder` is not in the runtime a handler runs in, and the rule is short
 * enough to state: a code point below 0x80 is one byte, below 0x800 is two,
 * anything outside the basic plane is four, and the rest are three.
 */
function bytes(value: string): number {
  let total = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    total += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return total;
}
