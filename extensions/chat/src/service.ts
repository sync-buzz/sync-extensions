/**
 * What this package does with no screen mounted: the tool an agent calls to
 * hand a piece of work to a second agent.
 *
 * **This orders; Sync performs.** The handler runs for milliseconds and answers
 * with the key of the order, and the agent it asks for may still be rising a
 * second later and still working an hour after that. Nothing here waits, and
 * there is deliberately no companion tool to ask whether the work is done: an
 * answer that takes a day would be asked about thousands of times for one
 * result, and it comes back on its own as an ordinary turn.
 *
 * # What the caller may say, and what it may not
 *
 * It says what the work is, what to call it, and which agent to raise. It does
 * not say what the work is *about* or who ordered it — both are read from the
 * conversation named in `parent`, by the host, which is what keeps a heading
 * unforgeable: an agent reaching this may say what it delegated from and cannot
 * file the result under a record it has nothing to do with. So neither is an
 * argument here, and there is nothing to leave out.
 *
 * # Why `parent` is optional, and why nothing here supplies it
 *
 * A tool call does not carry who is calling. Sync could put the caller's
 * session on the wire and does not — that is one decision, and this is the
 * shape it leaves: the identifier travels in words, through the text of a
 * delegation. A conversation that was delegated is told the one it came out of
 * and can pass that on; a conversation somebody opened themselves was told
 * nothing and delegates flat. Guessing would be worse than flat, because a
 * wrong parent files somebody else's work under somebody else's heading.
 */

import { work, type Handlers } from "@sync-buzz/extension-api/service";

/** What an agent gets back the moment the work is written down. */
interface Delegated {
  /** What the order is called. It comes back on every session the order raises. */
  readonly work: string;
  readonly title: string;
  readonly agent: string;
  /** What to do next, in the words the answer should be acted on in. */
  readonly next: string;
}

export default function register(): Handlers {
  return { "chat.delegate": delegate };
}

/**
 * Order one delegated conversation, or say why it was not ordered.
 *
 * Every refusal names the argument and what to put in it: the reader is an
 * agent that will otherwise try the call again with something else in the same
 * place.
 */
async function delegate(payload: unknown): Promise<Delegated> {
  const title = asked(payload, "title");
  if (title === "") {
    throw new Error(
      "Call this with `title` set: it is what the conversation is called in the list a person reads, " +
        "and nothing but you knows what this piece of work should be called there.",
    );
  }

  const prompt = asked(payload, "prompt");
  if (prompt === "") {
    throw new Error(
      "Call this with `prompt` set to the work itself. The agent you are delegating to reads that and " +
        "nothing else of this conversation.",
    );
  }

  const agent = asked(payload, "agent");
  if (agent === "") {
    throw new Error(
      "Call this with `agent` set to the agent to raise, as Sync names them — `claude`, `codex`, `gemini`. " +
        "Name the one you are, unless the work asks for another.",
    );
  }

  const parent = asked(payload, "parent");

  const key = await work.order({
    kind: "agent.session",
    agent,
    title,
    prompt: { text: told(prompt, parent) },
    // A delegated run is somebody's answer half-written, not a poll that can be
    // skipped: interrupted by a shutdown, it is worth finishing.
    onInterrupted: "continue",
    ...(parent === "" ? {} : { parent }),
  });

  return { work: key, title, agent, next: next(parent) };
}

/**
 * The work as it goes to the agent that will do it.
 *
 * Sync appends the half about answering upwards — that rule holds for every
 * delegated conversation however it was ordered, so it is said where that is
 * true rather than here. What is added here is the one thing only this package
 * knows: the identifier to delegate under, so a conversation that needs a
 * second pair of hands asks for a sibling rather than for a chain.
 *
 * Said only where there is one. A conversation with no parent to name is a
 * conversation that cannot delegate with parentage at all, and a paragraph
 * about an identifier it has not got is a paragraph inviting it to invent one.
 */
function told(prompt: string, parent: string): string {
  if (parent === "") return prompt;
  return `${prompt}

---

If this needs work delegated of its own, call \`chat.delegate\` with \`parent\` set to \`${parent}\` — the conversation this one came out of, not this one. A chain is two conversations deep, so what you delegate stands beside this rather than under it, and waits for this to finish.`;
}

/**
 * What the caller is told to do with the key.
 *
 * The sentence exists because the obliging thing for an agent to do with a key
 * is to look it up, and there is nothing to look it up with. Ending the turn is
 * the instruction, and it is repeated here rather than left to the package's
 * topic: this answer is what is in front of the agent at the moment it decides.
 */
function next(parent: string): string {
  const stood =
    parent === ""
      ? "It stands on its own rather than under a conversation, because no parent was named."
      : "It stands under the conversation you named, and waits if something else is already running there.";
  return `The work is ordered. ${stood} End your turn now: whatever that agent says last comes back here as an ordinary message once you are free, and there is nothing to poll and no way to hurry it.`;
}

/** One named argument of the payload, as a trimmed string. */
function asked(payload: unknown, name: string): string {
  if (typeof payload !== "object" || payload === null) return "";
  const held = (payload as Record<string, unknown>)[name];
  return typeof held === "string" ? held.trim() : "";
}
