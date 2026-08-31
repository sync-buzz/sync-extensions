/**
 * What this package does with no screen mounted: the tool an agent calls.
 *
 * **The agent asks for a post to go out; it does not send one.** It names a
 * draft by key, and everything after that is this package's — reading the
 * channel, taking the credential out of the vault, making the request, and
 * answering with what the network called the post. The agent never sees the
 * credential, cannot choose the account, and cannot change a word of the text.
 *
 * That division is the point. A brief telling an agent how to call an API is a
 * brief it can follow wrongly: the wrong account, an improved sentence, a
 * hashtag nobody asked for. A tool that takes one key can only do the thing it
 * is named after.
 *
 * # Why the publication is written by the caller and not here
 *
 * A handler may read the project's memory and may not write to it — `OFFERED`
 * in the host's `handlers.rs` is the whole list. So this answers with everything
 * the record needs, including the text exactly as it was sent, and the agent
 * writes it with `sync_apply`. What that costs is stated plainly rather than
 * hidden: the identifier is issued by the network and read from its own answer,
 * so the agent is transcribing a fact rather than reporting one — but the
 * transcription is still its own.
 */

import { memory, net, vault, type Envelope, type Handlers } from "@sync-buzz/extension-api/service";

import { Refused } from "./door";
import { CHANNEL, DRAFT, network } from "./model";
import { post } from "./networks";

/**
 * What an agent gets back when a post has gone out.
 *
 * Everything a `posts.publication` needs and nothing else — including `text`,
 * so the record's body is what was sent rather than what the draft says by the
 * time anybody reads it again.
 */
interface Sent {
  readonly identifier: string;
  readonly network: string;
  readonly channel: string;
  readonly visibility: string;
  readonly sent: string;
  readonly text: string;
  /** What to do next, in the words the answer should be acted on in. */
  readonly next: string;
}

export default function register(): Handlers {
  return { "posts.publish": publish };
}

/**
 * Publish one draft, or say why it did not go.
 *
 * Every refusal names what is missing and where it is fixed, because the reader
 * is an agent that will otherwise try something else: *no channel* has to lead
 * to asking a person, not to picking a channel of its own.
 */
async function publish(payload: unknown): Promise<Sent> {
  const key = asked(payload, "draft");
  if (key === "") {
    throw new Error("Which draft? Call this with `draft` set to a posts.draft key.");
  }

  const draft = await one(key);
  if (text(draft.kind) !== DRAFT) {
    throw new Error(`\`${key}\` is a ${text(draft.kind)}, not a draft.`);
  }

  const body = await memory.content(key);
  const wording = (body.content ?? "").trim();
  if (wording === "") {
    throw new Error(`\`${key}\` has nothing in it to send.`);
  }

  const channelKey = text(draft.channel);
  if (channelKey === "") {
    throw new Error(
      `\`${key}\` names no channel, so there is nowhere for it to go. A person chooses one in the Posts section; do not choose for them.`,
    );
  }

  const channel = await one(channelKey);
  if (text(channel.kind) !== CHANNEL) {
    throw new Error(`\`${channelKey}\` is a ${text(channel.kind)}, not a channel.`);
  }

  const within = network(text(channel.network));
  if (within === null) {
    throw new Error(`\`${channelKey}\` names no network this build knows.`);
  }

  const author = text(channel.author);
  if (author === "") {
    throw new Error(
      `The channel \`${channelKey}\` has not been connected, so nothing knows who would be posting. A person connects it in the Posts section with a token; that is theirs to do.`,
    );
  }

  const chat = text(channel.chat);
  if (within.identity?.kept === "chat" && chat === "") {
    throw new Error(
      `The channel \`${channelKey}\` does not say which chat to post into, and ${within.label} has no default. A person fills that in where they connect the channel.`,
    );
  }

  const name = text(channel.secret);
  if (name === "") {
    throw new Error(
      `The channel \`${channelKey}\` says nothing about where its credential is kept.`,
    );
  }

  let secret: string;
  try {
    secret = await vault.read(name);
  } catch {
    throw new Error(
      `There is nothing to sign for \`${channelKey}\` on this machine. A person connects the channel in the Posts section; you cannot do it for them, and you must not post through a different channel instead.`,
    );
  }

  const visibility = text(draft.visibility);
  let identifier: string;
  try {
    identifier = await post(net, within, {
      secret,
      account: text(channel.account),
      author,
      chat,
      text: wording,
      visibility,
    });
  } catch (refused) {
    // A refusal from a network already reads as a sentence somebody can act on.
    throw new Error(refused instanceof Refused ? refused.message : String(refused));
  }

  return {
    identifier,
    network: within.id,
    channel: channelKey,
    visibility,
    sent: new Date().toISOString(),
    text: wording,
    next: `It is published. Now write a posts.publication with sync_apply: its body is the text above exactly as it is, its fields are network, channel, sent, visibility and identifier from this answer, linked to ${key} with the relation sent_from. Then archive ${key}. If you write nothing, nothing else will: this window did not record it.`,
  };
}

/** One record by key, or a refusal naming the key rather than the shape. */
async function one(key: string): Promise<Envelope> {
  const view = await memory.record(key);
  if (view.record === null) {
    throw new Error(`There is no record \`${key}\` in this project.`);
  }
  return view.record;
}

/** One named argument of the payload, as a trimmed string. */
function asked(payload: unknown, name: string): string {
  if (typeof payload !== "object" || payload === null) return "";
  const held = (payload as Record<string, unknown>)[name];
  return typeof held === "string" ? held.trim() : "";
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");
