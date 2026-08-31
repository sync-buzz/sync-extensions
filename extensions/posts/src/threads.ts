/**
 * How this package reaches Threads, and everything about Threads there is.
 *
 * **Publishing is two requests, not one.** The first makes a container holding
 * what the post will be; the second publishes it. Meta's own documentation
 * suggests waiting about thirty seconds between them, which is advice about
 * pictures being fetched and processed — a text container is ready when it is
 * answered for. There is no waiting here to do it with either: the runtime a
 * handler runs in has no timer at all, so a version that slept would work in
 * the window and not in the tool an agent calls.
 *
 * If the second request ever refuses because the first was not ready, that
 * refusal reaches a person as a sentence rather than being retried behind them
 * — a container that was published twice is two posts.
 *
 * **The credential goes in the request, not in a header.** That is what this
 * API documents, and a `Bearer` header is left alone rather than tried: an
 * arrangement that works today because a gateway is lenient is one that breaks
 * on a day nobody changed anything.
 */

import {
  Refused,
  ask,
  form,
  read,
  said,
  scalar,
  text,
  within,
  type Door,
  type NetResponse,
} from "./door";

/** Where the API lives. Also one of the hosts the manifest declares. */
const HOST = "https://graph.threads.net";

/**
 * Which version of the Graph the package speaks.
 *
 * Meta versions the path and keeps a version working for about two years, so
 * this moves with a release of this package rather than being read from a
 * record — a project that pinned itself to a version since switched off would
 * find out at the moment it published.
 */
const VERSION = "v1.0";

/** Who a token belongs to, as Threads answers it. */
export interface Whose {
  /** The user id, which is what a post is created under. */
  readonly author: string;
  /** `@name`, for the row a person reads. */
  readonly account: string;
}

/**
 * Ask Threads who a token is for.
 *
 * The user id is read back rather than typed for the reason it is everywhere
 * else here: it is the network's answer, it is the one thing the next request
 * insists on, and nobody should have to go and look their own up.
 */
export async function whose(net: Door, token: string): Promise<Whose> {
  const answer = await ask(net, {
    url: `${HOST}/${VERSION}/me?${form({ fields: "id,username", access_token: token })}`,
  });

  const parsed = kept(answer);
  const id = scalar(parsed.id);
  if (id === "") {
    throw new Refused("Threads answered without saying who the token belongs to.");
  }
  const username = text(parsed.username);
  return { author: id, account: username === "" ? id : `@${username}` };
}

/** One post, as it goes out. */
export interface Outgoing {
  readonly token: string;
  /** The Threads user id, as `whose` read it back. */
  readonly author: string;
  readonly text: string;
}

/**
 * Publish one text post, and answer with what Threads called it.
 *
 * The identifier is the id of the **published** post, not of the container: the
 * container is scaffolding that stops existing, and a publication carrying its
 * id would be a receipt for something nobody can open.
 */
export async function post(net: Door, outgoing: Outgoing): Promise<string> {
  const made = await ask(net, {
    url: `${HOST}/${VERSION}/${outgoing.author}/threads`,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      media_type: "TEXT",
      text: outgoing.text,
      access_token: outgoing.token,
    }),
  });

  const container = scalar(kept(made).id);
  if (container === "") {
    throw new Refused("Threads accepted the text but did not answer with a container to publish.");
  }

  const published = await ask(net, {
    url: `${HOST}/${VERSION}/${outgoing.author}/threads_publish`,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ creation_id: container, access_token: outgoing.token }),
  });

  // Everything after here has already gone out, so nothing below throws over a
  // missing name: a refusal would lose the record of a post that exists.
  return scalar(kept(published).id);
}

/**
 * The answer, or the reason a person can act on.
 *
 * Meta puts every failure in one shape — an `error` object with a code — and
 * the codes worth translating are the two somebody meets: a token that has run
 * out, and a rate limit. The rest arrive as the sentence Meta wrote, which is
 * usually a good one.
 */
function kept(answer: NetResponse): Record<string, unknown> {
  const parsed = read(answer.body);
  if (answer.ok) return parsed;

  const error = within(parsed.error);
  const code = scalar(error.code);
  const message = text(error.message);

  if (code === "190" || answer.status === 401) {
    throw new Refused(
      "Threads no longer accepts this channel's token. A long-lived token lasts sixty days and stops working sooner if the password changed; connect the channel again with a fresh one.",
    );
  }
  if (code === "4" || code === "17" || code === "32" || answer.status === 429) {
    throw new Refused(
      `Threads is rate-limiting this account: ${message || "too many requests"}. Nothing here retries — sending again is a decision, because a request that timed out may have been performed.`,
    );
  }
  if (code === "10" || code === "200" || answer.status === 403) {
    throw new Refused(
      `Threads will not let this token post: ${message || "the permission is missing"}. The app it came from needs threads_basic and threads_content_publish, and the account has to be the one that authorised it.`,
    );
  }
  if (message !== "") throw new Refused(`Threads would not take this: ${message}`);
  throw new Refused(said("Threads", answer));
}
