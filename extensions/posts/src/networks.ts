/**
 * Which network a channel is for, turned into the file that can reach it.
 *
 * The one place in this package where four networks are in view at once, and it
 * is four lines long per network on purpose: everything that differs — an
 * endpoint, a credential, the shape of a refusal — is in the file for that
 * network, and what is here is only the join. A column that asked *which
 * network is this* before deciding what to draw would put that join in four
 * more places.
 *
 * **Both halves of the package come through here.** The window publishes when
 * somebody presses the button; the handler publishes when an agent calls the
 * tool. They are two callers of these two functions, which is what keeps the
 * two paths making the same request.
 */

import * as bluesky from "./bluesky";
import { Refused, type Door } from "./door";
import * as linkedin from "./linkedin";
import type { Network } from "./model";
import * as telegram from "./telegram";
import * as threads from "./threads";

/** What is typed to connect a channel: a credential, and sometimes a name. */
export interface Credentials {
  /** The token or app password. It goes to the vault and nowhere else. */
  readonly secret: string;
  /** The handle or chat typed beside it, as the network's own `identity` asks. */
  readonly identity: string;
}

/**
 * What a network says about an account once it accepts a credential.
 *
 * Written into the channel record whole, so that what a channel claims about
 * itself is what the network answered rather than what somebody typed.
 */
export interface Connected {
  /** What the network calls the author when it is asked to publish. */
  readonly author: string;
  /** Whose account it is, as the network names it. */
  readonly account: string;
  /** Where inside the network it posts. Empty for the three that have one place. */
  readonly chat: string;
  /** What to tell somebody beyond the account, or `""` when there is nothing. */
  readonly note: string;
}

/**
 * Check a credential against its network, and say what came back.
 *
 * Called before anything is stored, which is the whole point of it: a
 * credential that will not answer here is one that would have failed at the
 * moment somebody pressed Publish, in front of a post they had written.
 */
export async function connect(
  net: Door,
  within: Network,
  credentials: Credentials,
): Promise<Connected> {
  const secret = credentials.secret.trim();
  const identity = credentials.identity.trim();

  switch (within.id) {
    case "linkedin": {
      const found = await linkedin.whose(net, secret);
      return { author: found.author, account: found.account, chat: "", note: "" };
    }
    case "bluesky": {
      const found = await bluesky.whose(net, identity, secret);
      return { author: found.author, account: found.account, chat: "", note: "" };
    }
    case "threads": {
      const found = await threads.whose(net, secret);
      return { author: found.author, account: found.account, chat: "", note: "" };
    }
    case "telegram": {
      const found = await telegram.whose(net, secret, identity);
      return {
        author: found.author,
        account: found.account,
        chat: found.chat,
        // Which chat, said out loud: the account is the bot, and knowing the
        // bot is right says nothing about whether the messages will arrive
        // where somebody meant them to.
        note: found.where === "" ? "" : `It can post into ${found.where}.`,
      };
    }
    default:
      throw new Refused(`This build does not know a network called ${within.id}.`);
  }
}

/** One post and everything the network it is for needs in order to take it. */
export interface Sending {
  readonly secret: string;
  /** The account as the channel records it — a handle, where one signs in. */
  readonly account: string;
  /** The author as the network named it — a URN, a DID, a user id. */
  readonly author: string;
  /** The chat, for the network that posts into one. */
  readonly chat: string;
  readonly text: string;
  /** In the vocabulary of this network, and empty where it offers no choice. */
  readonly visibility: string;
}

/**
 * Publish one post, and answer with what the network called it.
 *
 * An empty answer means it went out and the network did not name it — which is
 * a publication without an identifier, not a failure. Nothing here retries: a
 * request that timed out may have been performed, and a second one is a second
 * post.
 */
export async function post(net: Door, within: Network, sending: Sending): Promise<string> {
  switch (within.id) {
    case "linkedin":
      return linkedin.post(net, {
        token: sending.secret,
        author: sending.author,
        text: sending.text,
        visibility: sending.visibility,
      });
    case "bluesky":
      return bluesky.post(net, {
        password: sending.secret,
        account: sending.account,
        author: sending.author,
        text: sending.text,
      });
    case "threads":
      return threads.post(net, {
        token: sending.secret,
        author: sending.author,
        text: sending.text,
      });
    case "telegram":
      return telegram.post(net, {
        token: sending.secret,
        chat: sending.chat,
        text: sending.text,
      });
    default:
      throw new Refused(`This build does not know a network called ${within.id}.`);
  }
}
