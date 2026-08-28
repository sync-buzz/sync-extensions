/**
 * What a post is, apart from how it is drawn.
 *
 * Pure functions over a record, so the columns beside them decide only where
 * things go. The vocabulary is the type's own — a value outside it is a write
 * the engine refuses — and it is stated once here rather than in each column
 * that draws a pop-up over it.
 */

/** A post somebody is still writing. */
export const DRAFT = "posts.draft";

/** A post that went out, with the text as it went. */
export const PUBLICATION = "posts.publication";

/**
 * The fields a row is drawn from, per kind.
 *
 * A listing brings what it was asked for and nothing else, so a column that
 * says which network a post is for has to ask for the field by name. Two lists
 * because the two kinds carry different fields, and asking for a field a kind
 * has not got is asking a question with no answer.
 */
export const DRAFT_FIELDS = ["channel", "visibility"] as const;
export const PUBLICATION_FIELDS = [
  "channel",
  "identifier",
  "sent",
  "visibility",
] as const;

/**
 * One way a post can be read: who may see it, in that network's own words.
 *
 * Not shared between channels, and that is the point of holding it here rather
 * than in one enum on the type. *Public* and *connections* are LinkedIn's pair;
 * Mastodon has four and one of them is a direct message; X has none at all for
 * an ordinary account. A single vocabulary covering all of them would offer
 * somebody a value the network they chose has never heard of.
 */
export interface Visibility {
  readonly id: string;
  readonly label: string;
  /** What it means, where a menu has room to say so. */
  readonly note: string;
}

/**
 * One network a post can be written for.
 *
 * **A channel is a description, not an integration.** Nothing here connects to
 * anything: the fields are what a person needs while writing — what it is
 * called, how long a post may be, who may read one — and one sentence for the
 * agent that will actually deliver it. Adding a network is a row in the list
 * below and a paragraph in the prompt, which is the whole reason the section
 * can carry six of them without carrying six API clients.
 *
 * **The limit is checked, not guessed.** It is the number the network states
 * for one post, and it is the only figure here a person will act on — they
 * shorten a sentence because of it. A guessed limit is worse than none: it is
 * advice that looks measured.
 */
export interface Channel {
  readonly id: string;
  readonly label: string;
  /** The longest one post may be, in characters as a reader counts them. */
  readonly longest: number;
  /** Empty where the network gives an ordinary account no choice. */
  readonly visibilities: readonly Visibility[];
  /** What the agent is told about getting a post to this network. */
  readonly delivery: string;
}

/**
 * The networks this version knows about.
 *
 * A closed list, and closed deliberately: a channel decides a limit and a
 * vocabulary, and free text would give somebody a network with no limit to
 * count against and no visibility to choose — a counter about nothing. Adding
 * one is a row here and a release of this package, which is the same bargain
 * Sync makes for the agents it will write itself into.
 */
export const CHANNELS: readonly Channel[] = [
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
    delivery: "LinkedIn calls a post's identifier a URN, like `urn:li:share:…`.",
  },
  {
    id: "x",
    label: "X",
    longest: 280,
    // An ordinary account posts publicly and has nothing to choose, so the
    // control is not drawn rather than drawn with one option in it.
    visibilities: [],
    delivery: "X calls a post's identifier a tweet id, which is a number.",
  },
  {
    id: "bluesky",
    label: "Bluesky",
    longest: 300,
    visibilities: [],
    delivery: "Bluesky identifies a post by an AT URI, like `at://…/app.bsky.feed.post/…`.",
  },
  {
    id: "mastodon",
    label: "Mastodon",
    longest: 500,
    visibilities: [
      { id: "public", label: "Public", note: "On the public timelines" },
      {
        id: "unlisted",
        label: "Unlisted",
        note: "Readable by anybody, but off the public timelines",
      },
      { id: "followers", label: "Followers", note: "Followers of this account only" },
      {
        id: "direct",
        label: "Direct",
        note: "Only the people named in it — a message rather than a post",
      },
    ],
    delivery:
      "Mastodon is many servers: which instance this account is on is part of what the agent needs to know, and it is not stored here.",
  },
  {
    id: "threads",
    label: "Threads",
    longest: 500,
    visibilities: [],
    delivery: "Threads identifies a post by a numeric media id.",
  },
  {
    id: "telegram",
    label: "Telegram",
    longest: 4096,
    visibilities: [],
    delivery:
      "Telegram posts into a chat or a channel, and which one is part of what the agent needs to know rather than something stored here.",
  },
];

export type ChannelId = (typeof CHANNELS)[number]["id"];

/** One channel by id, or `null` for a draft nobody has chosen one for. */
export function channel(id: string | null): Channel | null {
  if (id === null || id === "") return null;
  return CHANNELS.find((entry) => entry.id === id) ?? null;
}

/** What a channel is called where somebody reads one, and its id when it is unknown. */
export function channelLabel(id: string): string {
  return channel(id)?.label ?? id;
}

/** One field of a record, as a string, or the default the type declares. */
export function field(
  fields: Readonly<Record<string, unknown>> | undefined,
  name: string,
  fallback: string,
): string {
  const held = fields?.[name];
  return typeof held === "string" && held.length > 0 ? held : fallback;
}

/** Which network a record is for, or `""` where nobody has said. */
export const channelOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "channel", "");

export const visibilityOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "visibility", "");

export const identifierOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "identifier", "");

export const sentAtOf = (fields?: Readonly<Record<string, unknown>>) =>
  field(fields, "sent", "");

/**
 * What a visibility is called, in the vocabulary of the channel it belongs to.
 *
 * The channel is required rather than searched for across all of them: `public`
 * means something slightly different on two networks, and a lookup that found
 * the first match would put one network's sentence under another's name.
 */
export function visibilityLabel(within: Channel | null, id: string): string {
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
 * How much room is left in this channel, which may be negative.
 *
 * Negative rather than clamped at zero: *over by 40* is what somebody needs to
 * know, and *0 left* said while they keep typing is a counter that has stopped
 * describing anything. `null` where no channel has been chosen — there is no
 * limit to be within, and a number invented for that case would be a limit of
 * ours.
 */
export function remaining(within: Channel | null, text: string): number | null {
  return within === null ? null : within.longest - length(text);
}

/**
 * Why this draft cannot go out, or `null` when nothing is in the way.
 *
 * One function rather than a condition in each of the three places that ask —
 * the button, the sentence under it, and the brief — so that a draft the window
 * offers to send is a draft the brief will accept.
 */
export function unsendable(
  within: Channel | null,
  text: string,
): string | null {
  if (text.trim().length === 0) return "There is nothing in this draft to send.";
  if (within === null) {
    return "No channel is chosen, so there is nowhere for this to go.";
  }
  const left = remaining(within, text);
  if (left !== null && left < 0) {
    return `Longer than ${within.label} accepts, by ${-left} characters.`;
  }
  return null;
}

/**
 * A date as this window says one, and the raw string when it is not a date.
 *
 * The locale is the reader's. What is stored is when the post went out, which
 * is a fact about an event rather than anything compared against a record, so
 * there is nothing here that has to sort next to something else.
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
 * template would be this package putting words in their mouth. The prompt is
 * the sentence above the editor instead, which says nothing once typing starts.
 */
export const EMPTY = "";
