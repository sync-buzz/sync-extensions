/**
 * What a post is, apart from how it is drawn.
 *
 * Pure functions over a record, so the columns beside them decide only where
 * things go.
 *
 * **Two words that are easy to confuse, and the whole shape rests on the
 * difference.** A *network* is a fact about the world — LinkedIn allows three
 * thousand characters, Bluesky three hundred — so it lives in this file, in
 * code, and is the same in every project. A *channel* is a fact about this
 * project — which account it publishes as, which chat it posts into, and what
 * to sign with — so it lives in the project's memory as a record. Two projects
 * on one machine publish to one network under different accounts, and nothing
 * in the code has to know.
 */

/** A post somebody is still writing. */
export const DRAFT = "posts.draft";

/** A post that went out, with the text as it went. */
export const PUBLICATION = "posts.publication";

/** One account this project publishes to. */
export const CHANNEL = "posts.channel";

/**
 * The fields a row is drawn from, per kind.
 *
 * A listing brings what it was asked for and nothing else, so a column that
 * says which account a post is for has to ask for the field by name.
 */
export const DRAFT_FIELDS = ["channel", "visibility"] as const;
export const PUBLICATION_FIELDS = [
  "channel",
  "network",
  "identifier",
  "sent",
  "visibility",
] as const;
export const CHANNEL_FIELDS = [
  "network",
  "account",
  "author",
  "chat",
  "secret",
] as const;

/**
 * One way a post can be read: who may see it, in that network's own words.
 *
 * Not shared between networks, and that is why it is held here rather than in
 * one enum on the type. *Public* and *connections* are LinkedIn's pair; the
 * other three here give an ordinary account nothing to choose at all. A single
 * vocabulary covering every network would offer somebody a value the one they
 * chose has never heard of.
 */
export interface Visibility {
  readonly id: string;
  readonly label: string;
  /** What it means, where a menu has room to say so. */
  readonly note: string;
}

/**
 * What somebody types to connect a channel, as the panel asks for it.
 *
 * Two networks need a second value beside the credential — Bluesky signs in
 * with a handle, Telegram posts into a chat it has to be told about — and the
 * panel cannot know which without asking the network. Held as data rather than
 * as a condition in the panel, so a network that needs a second value is a
 * member here and not a branch there.
 */
export interface Asked {
  /** What the field is called above the box. */
  readonly label: string;
  /** What goes in it, where the shape is not obvious from the name. */
  readonly placeholder: string;
}

/**
 * The second value, and where the channel remembers it.
 *
 * A handle *is* the account, so it comes back from the network and is kept as
 * `account`. A chat is nothing a network can answer for — it is where this
 * project decided to post — so it is kept as `chat`. Naming the field here is
 * what lets the panel fill the box in again the next time it is opened without
 * asking which network this is.
 */
export interface Identity extends Asked {
  readonly kept: "account" | "chat";
}

/**
 * One network a post can be written for.
 *
 * **A network is a fact about the world, and every member here is one.** What
 * it is called, how long a post may be, who may read one, and what has to be
 * typed to publish as an account on it. Nothing about a particular account is
 * here; that is the channel record's, and the difference is the whole reason
 * the two are separate.
 *
 * **The limit is checked, not guessed.** It is the number the network states
 * for one post, and it is the only figure here somebody acts on — they shorten
 * a sentence because of it. A guessed limit is worse than none: it is advice
 * that looks measured.
 */
export interface Network {
  readonly id: string;
  readonly label: string;
  /** The longest one post may be, in characters as a reader counts them. */
  readonly longest: number;
  /** Empty where the network gives an ordinary account no choice. */
  readonly visibilities: readonly Visibility[];
  /** What somebody is told about getting the credential this asks for. */
  readonly connecting: string;
  /** The value kept in this machine's vault, as the panel names it. */
  readonly secret: Asked;
  /** What is typed beside it and checked with it, or `null` for most of them. */
  readonly identity: Identity | null;
}

/**
 * The networks this version knows about.
 *
 * A closed list, and closed deliberately: a network decides a limit and a
 * vocabulary, and free text would leave somebody with a network that has no
 * limit to count against — a counter about nothing.
 *
 * **Every network in the list can be published to from here.** A name that
 * could only be written down and not reached was worse than no name at all: it
 * offered a channel, a counter and a Publish button that refused, which reads
 * as a fault in the window rather than as a limit of it. So a network arrives
 * in this list with the file that reaches it, or does not arrive.
 */
export const NETWORKS: readonly Network[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    longest: 3000,
    visibilities: [
      {
        id: "public",
        label: "Anyone",
        note: "Readable by anybody, signed in or not",
      },
      {
        id: "connections",
        label: "Connections",
        note: "Readable by the people this account is connected to",
      },
    ],
    connecting:
      "A token from the LinkedIn developer portal, with the scopes openid, profile and w_member_social. It lasts sixty days.",
    secret: { label: "Token", placeholder: "Paste it here" },
    identity: null,
  },
  {
    id: "bluesky",
    label: "Bluesky",
    longest: 300,
    // An ordinary account posts publicly and has nothing to choose, so the
    // control is not drawn rather than drawn with one option in it.
    visibilities: [],
    connecting:
      "An app password from Settings ▸ Privacy and security ▸ App passwords, and the handle it belongs to. It is not the account's own password, it works with two-factor sign-in on, and it can be revoked on its own.",
    secret: { label: "App password", placeholder: "xxxx-xxxx-xxxx-xxxx" },
    identity: { label: "Handle", placeholder: "name.bsky.social", kept: "account" },
  },
  {
    id: "threads",
    label: "Threads",
    longest: 500,
    visibilities: [],
    connecting:
      "A long-lived token from a Meta app with threads_basic and threads_content_publish. Publishing to the account that authorised the app needs no review. It lasts sixty days.",
    secret: { label: "Token", placeholder: "Paste it here" },
    identity: null,
  },
  {
    id: "telegram",
    label: "Telegram",
    longest: 4096,
    visibilities: [],
    connecting:
      "A bot token from BotFather, and the chat it posts into. The bot has to be in that chat, and an administrator of a channel it posts to — what goes out is said by the bot, not by a person.",
    secret: { label: "Bot token", placeholder: "123456:ABC-DEF…" },
    identity: { label: "Chat", placeholder: "@channel or -1001234567890", kept: "chat" },
  },
];

/** One network by id, or `null` for a channel nobody has chosen one for. */
export function network(id: string | null | undefined): Network | null {
  if (id === null || id === undefined || id === "") return null;
  return NETWORKS.find((entry) => entry.id === id) ?? null;
}

/** What a network is called where somebody reads one, and its id when unknown. */
export function networkLabel(id: string): string {
  return network(id)?.label ?? id;
}

/** One field of a record, as a string, or the fallback. */
export function field(
  fields: Readonly<Record<string, unknown>> | undefined,
  name: string,
  fallback: string,
): string {
  const held = fields?.[name];
  return typeof held === "string" && held.length > 0 ? held : fallback;
}

/** Which channel a draft or a publication is for, by the channel record's key. */
export const channelKeyOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "channel", "");

export const networkOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "network", "");
export const accountOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "account", "");
export const authorOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "author", "");
export const secretOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "secret", "");

/** Which chat a channel posts into, for the network that posts into one. */
export const chatOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "chat", "");

/**
 * What a channel already knows about the second value its network asks for.
 *
 * So that somebody replacing a token is not asked to type their handle again,
 * and so that the box says what is in use rather than starting blank beside a
 * connected account.
 */
export function identityOf(
  within: Network | null,
  fields?: Readonly<Record<string, unknown>>,
): string {
  return within?.identity === undefined || within.identity === null
    ? ""
    : field(fields, within.identity.kept, "");
}
export const visibilityOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "visibility", "");
export const identifierOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "identifier", "");
export const sentAtOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "sent", "");

/**
 * The name a channel's token is kept under in the vault.
 *
 * Derived from the record's key rather than typed, and that is what makes two
 * accounts on one network possible: the key is permanent and unique, so two
 * channels can never name one secret and a renamed channel cannot lose its own.
 * It is written into the record as well, so the section can say what a channel
 * expects on a machine that has not got it.
 */
export const secretName = (channelKey: string) => `channel/${channelKey}`;

/**
 * What a visibility is called, in the vocabulary of the network it belongs to.
 *
 * The network is required rather than searched for across all of them: `public`
 * means something slightly different on two networks, and a lookup that found
 * the first match would put one network's sentence under another's name.
 */
export function visibilityLabel(within: Network | null, id: string): string {
  if (id === "") return "";
  return within?.visibilities.find((entry) => entry.id === id)?.label ?? id;
}

/**
 * How long a post is, as a reader counts it.
 *
 * `Array.from` rather than `.length`, and the difference is not academic: an
 * emoji is two UTF-16 units and one character to anybody reading, so a counter
 * over `.length` tells somebody they have spent twice what they have. What is
 * still wrong here is stated rather than hidden — a family emoji is several
 * code points and is counted as several — because the alternative is a
 * segmenter this package would carry in order to be wrong in a rarer way.
 */
export function length(text: string): number {
  return Array.from(text).length;
}

/**
 * How much room is left, which may be negative.
 *
 * Negative rather than clamped at zero: *over by 40* is what somebody needs to
 * know, and *0 left* said while they keep typing is a counter that has stopped
 * describing anything. `null` where no network is known — there is no limit to
 * be within, and a number invented for that case would be a limit of ours.
 */
export function remaining(within: Network | null, text: string): number | null {
  return within === null ? null : within.longest - length(text);
}

/**
 * A date as this window says one, and the raw string when it is not a date.
 *
 * The locale is the reader's. What is stored is when the post went out, which
 * is a fact about an event rather than anything compared against a record.
 */
export function when(iso: string): string {
  if (iso.length === 0) return "—";
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/**
 * What a new draft starts as.
 *
 * Empty, and that is the decision rather than an omission. A task starts with
 * its three headings because the shape is what makes it checkable; a post has
 * no shape to fill in — it is prose somebody writes to strangers, and a
 * template would be this package putting words in their mouth.
 */
export const EMPTY = "";
