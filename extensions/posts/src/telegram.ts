/**
 * How this package reaches Telegram, and everything about Telegram there is.
 *
 * **A post here is said by a bot, not by a person.** Telegram's API belongs to
 * bots: the credential comes from BotFather, and what goes out is a message
 * from that bot into a chat it has been added to. So a Telegram channel record
 * carries something none of the others need — which chat — and this file
 * refuses to send without it rather than guessing a destination.
 *
 * **The token is in the path, not in a header.** That is Telegram's design and
 * not a choice available here: every method is addressed as `/bot<token>/name`.
 */

import { Refused, ask, read, scalar, said, text, within, type Door } from "./door";

/** Where the API lives. Also one of the hosts the manifest declares. */
const HOST = "https://api.telegram.org";

/** Which bot a token belongs to, as Telegram answers it. */
export interface Whose {
  /** The bot's numeric id, which is what actually posts. */
  readonly author: string;
  /** `@name`, for the row a person reads. */
  readonly account: string;
  /** The chat as it should be kept — what was typed, tidied. */
  readonly chat: string;
  /** What that chat is called, which is Telegram's answer and not the address. */
  readonly where: string;
}

/**
 * Check a bot token — and the chat with it, when there is one.
 *
 * **Both halves are checked here on purpose.** A token that is right and a chat
 * the bot was never added to fail at the same moment and look identical from
 * the window: nothing goes out. Asking Telegram about the chat while somebody
 * is still on the panel turns the second of those into a sentence they can act
 * on — *add the bot to the chat and make it an administrator*.
 */
export async function whose(net: Door, token: string, chat: string): Promise<Whose> {
  const me = await call(net, token, "getMe", {});
  const bot = within(me.result);
  const id = scalar(bot.id);
  if (id === "") {
    throw new Refused("Telegram answered without saying which bot the token is for.");
  }

  const account = text(bot.username) === "" ? id : `@${text(bot.username)}`;
  const address = chat.trim();
  if (address === "") return { author: id, account, chat: "", where: "" };

  const found = await call(net, token, "getChat", { chat_id: address });
  const chatting = within(found.result);
  return {
    author: id,
    account,
    // Kept as it was typed. `getChat` also answers with a numeric id, and
    // storing that instead would replace a name somebody recognises with a
    // number they cannot check against anything in Telegram's own interface.
    chat: address,
    // What a person recognises, in Telegram's own order of preference: a group
    // has a title, a channel may have only a username, and a direct chat has
    // neither.
    where: text(chatting.title) || text(chatting.username) || scalar(chatting.id) || address,
  };
}

/** One post, as it goes out. */
export interface Outgoing {
  readonly token: string;
  /** The chat it is posted into, as the channel record carries it. */
  readonly chat: string;
  readonly text: string;
}

/**
 * Send one message, and answer with what Telegram called it.
 *
 * **The identifier is the chat and the message together.** Telegram numbers
 * messages inside a chat and nowhere else, so `41` on its own names nothing —
 * a publication carrying it would be a receipt that cannot be looked up.
 */
export async function post(net: Door, outgoing: Outgoing): Promise<string> {
  if (outgoing.chat.trim() === "") {
    throw new Refused(
      "This channel does not say which chat to post into, and Telegram has no default.",
    );
  }

  const answer = await call(net, outgoing.token, "sendMessage", {
    chat_id: outgoing.chat.trim(),
    text: outgoing.text,
  });

  const message = within(answer.result);
  const number = scalar(message.message_id);
  const where = scalar(within(message.chat).id) || outgoing.chat.trim();
  if (number === "") {
    // It went out; Telegram simply did not number it in a shape this reads.
    // Saying so beats failing, which would lose the record of something that
    // has already happened.
    return "";
  }
  return `${where}/${number}`;
}

/**
 * One method of the Bot API, with the refusals a person can do something about.
 *
 * Telegram answers `200` with `ok: false` for some of what other APIs put in a
 * status, so the body is what decides — a check on the status alone would read
 * *the bot is not in that chat* as a success.
 */
async function call(
  net: Door,
  token: string,
  method: string,
  parameters: Readonly<Record<string, string>>,
): Promise<Record<string, unknown>> {
  const answer = await ask(net, {
    url: `${HOST}/bot${token}/${method}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parameters),
  });

  const parsed = read(answer.body);
  if (parsed.ok === true) return parsed;

  const description = text(parsed.description);
  if (answer.status === 401) {
    throw new Refused(
      "Telegram did not accept that bot token. BotFather issues one per bot and reissues it on request — a reissued token makes the old one stop working immediately.",
    );
  }
  if (answer.status === 403) {
    throw new Refused(
      `Telegram will not let this bot post there: ${description || "it has no access to that chat"}. A bot has to be added to the chat, and to a channel it has to be an administrator with permission to post.`,
    );
  }
  if (description.includes("chat not found")) {
    throw new Refused(
      "Telegram has no chat by that name for this bot. A channel is named `@name`; a group is a numeric id beginning `-100`, which a bot only learns after it has been added.",
    );
  }
  if (answer.status === 429) {
    throw new Refused(
      `Telegram is rate-limiting this bot: ${description || "too many requests"}. Nothing was sent, and nothing here retries — sending again is a decision, because a request that timed out may have been performed.`,
    );
  }
  throw new Refused(said("Telegram", answer));
}
