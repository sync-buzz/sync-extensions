/**
 * Who a message is addressed to.
 *
 * A person writing in this field is usually talking to the agent in front of
 * them. Sometimes they are handing the work to a second one, and `@name` at the
 * head of the message is how they say so — the name of a conversation, not of
 * an agent: which agent holds a conversation is settled when it opens.
 *
 * **The head of the message and nowhere else.** A name written anywhere further
 * in is somebody mentioning a conversation, which has to stay possible: *see
 * what @checks comes back with* is an ordinary sentence, and it would be
 * unsayable if naming a conversation were the same as handing over to it. The
 * cost is the one message that opens with a mention and means it as one; that
 * was weighed and taken.
 *
 * Nothing here imports the host, so it can be asked a question and checked.
 */

/** The conversation a message is handed to, and optionally what should hold it. */
export interface Handed {
  /** What the conversation is called. Matched without regard to case. */
  readonly to: string;
  /**
   * Which agent to raise, where the name is new. Ignored for a conversation
   * that already exists: which agent holds one is fixed when it opens.
   */
  readonly with?: string;
}

/**
 * `@name`, or `@name:agent`, at the very start.
 *
 * The name has to be followed by a space or be the whole of the line, so an
 * address is never read out of an email or a handle that merely starts the same
 * way. Cyrillic is in the class because the people writing here name things in
 * it, and a name that could not be typed is a name nobody would use.
 */
const HANDS = /^@([A-Za-z0-9Ѐ-ӿ][\wЀ-ӿ-]*)(?::([A-Za-z0-9][\w-]*))?(?=\s|$)/;

/** What a message says, and who it says it to. */
export interface Addressed {
  /** Absent for a message meant for the conversation it was typed in. */
  readonly handed?: Handed;
  /** The message itself, with the address taken off the front. */
  readonly body: string;
}

/**
 * Reads the address off a message, if it carries one.
 *
 * Leading blank space is stepped over first: a line that begins with a space is
 * the same message to whoever typed it, and refusing to read the address there
 * would be the field disagreeing with the person about what they wrote.
 */
export function addressed(text: string): Addressed {
  const said = text.trimStart();
  const found = HANDS.exec(said);
  if (found === null) return { body: text };
  const [whole, to, held] = found;
  return {
    handed: held === undefined ? { to } : { to, with: held },
    body: said.slice(whole.length).trim(),
  };
}

/**
 * The address a message has settled on, for the field that draws it as a token.
 *
 * **Only once something follows the name.** `@check` becomes `@checks` with one
 * more keystroke, so a field that made a token of every prefix would take the
 * address out from under somebody in the middle of typing it. A space is the
 * delimiter a token field commits on, and it is the one used here.
 *
 * `null` while the name is still being written, and for a message that carries
 * no address at all — the field draws nothing in either case, and the two are
 * told apart by whether the text begins with `@`.
 */
export function committed(text: string): Addressed | null {
  const said = text.trimStart();
  const found = HANDS.exec(said);
  if (found === null || found[0].length === said.length) return null;
  return addressed(text);
}

/** The address as somebody typed it, for putting back what a token took. */
export function spelled(handed: Handed): string {
  return handed.with === undefined ? `@${handed.to}` : `@${handed.to}:${handed.with}`;
}
