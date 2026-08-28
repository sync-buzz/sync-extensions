/**
 * What a question is, apart from how it is drawn.
 *
 * Everything here is a pure function over a record, so the columns beside it
 * decide only where things go. The vocabulary is the type's own — a value
 * outside it is a write the engine refuses — and it is stated once here rather
 * than in each column that reads it.
 */

/** The kind this area reads, and the only one it opens. */
export const KIND = "project-memory.question";

/**
 * The fields a row is drawn from, and the whole reason a list can group at all.
 *
 * A listing brings what it is asked for and nothing else, so this is exactly
 * what a row says about itself. `answer` is deliberately not here: it is prose,
 * it can run to paragraphs, and no row shows it.
 */
export const ROW_FIELDS = ["status", "options", "chosen", "multi_select"] as const;

/**
 * The two states a question has, and there is no third.
 *
 * *Deferred* was considered and refused: a question nobody is going to answer
 * this month is still open, and a state that says so would be a mood rather
 * than a fact about the fork. What is true of it is written in the body.
 */
export const STATUSES = [
  { id: "open", label: "Open", note: "Nobody has settled it yet" },
  { id: "answered", label: "Answered", note: "Settled, with the answer on the record" },
] as const;

export type StatusId = (typeof STATUSES)[number]["id"];

type Fields = Readonly<Record<string, unknown>> | undefined;

export function statusOf(fields: Fields): StatusId {
  return fields?.["status"] === "answered" ? "answered" : "open";
}

export function isAnswered(fields: Fields): boolean {
  return statusOf(fields) === "answered";
}

/** What a status is called where somebody reads it. */
export function statusLabel(id: string): string {
  return STATUSES.find((status) => status.id === id)?.label ?? id;
}

/**
 * A list of strings out of a field, and nothing else.
 *
 * The engine validates an array of strings as one, but a record written before
 * a field existed carries nothing at all, and a record written by hand can
 * carry anything. What is read here is what can be drawn: a list of non-empty
 * strings. Anything else is absence, which every column already knows how to
 * show.
 */
function strings(fields: Fields, name: string): readonly string[] {
  const held = fields?.[name];
  if (!Array.isArray(held)) return [];
  return held.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim() !== "",
  );
}

export const optionsOf = (fields: Fields) => strings(fields, "options");
export const chosenOf = (fields: Fields) => strings(fields, "chosen");

export function multiOf(fields: Fields): boolean {
  return fields?.["multi_select"] === true;
}

export function answerOf(fields: Fields): string {
  const held = fields?.["answer"];
  return typeof held === "string" ? held : "";
}

/**
 * An option that was chosen and is no longer offered.
 *
 * `chosen` holds the option's own words rather than a position in the list,
 * because a record has to be readable without the list beside it — a stored `2`
 * means nothing to anybody reading the memory in a text editor, and it means
 * something *wrong* the moment somebody reorders the options. The cost of that
 * is exactly this case: an option edited after it was taken no longer matches,
 * and the window says so rather than dropping the answer somebody gave.
 */
export function orphanedChoices(fields: Fields): readonly string[] {
  const options = optionsOf(fields);
  if (options.length === 0) return [];
  return chosenOf(fields).filter((choice) => !options.includes(choice));
}

/**
 * Whether a question was written so that it can be answered.
 *
 * The same idea as a task's shape and for the same reason: the person who
 * answers is not the person who asked, cannot ask a follow-up, and sees only
 * what is on the record. An agent writing through the memory server never sees
 * this window at all, so the check has to be a fact about the record rather
 * than a form somebody fills in.
 *
 * **Read by shape, not by heading.** A project writes its records in its own
 * language, so nothing here matches an English word: what is checked is that
 * something was said, that something is pointed at, and that a choice offered
 * is a choice. The one exception is the question mark, which is punctuation
 * rather than vocabulary — every language this window writes in ends a question
 * with one.
 */
export interface Asked {
  /**
   * What is wrong with it, in the words that would be said to whoever wrote it.
   *
   * Sentences rather than codes, because they are read by a person deciding
   * whether they can answer at all.
   */
  readonly faults: readonly string[];
}

export function asked(input: {
  readonly title: string;
  readonly body: string;
  readonly links: readonly { readonly relation: string }[];
  readonly scope: readonly string[];
  readonly options: readonly string[];
}): Asked {
  const faults: string[] = [];

  if (!input.title.trim().endsWith("?")) {
    faults.push(
      "The title is not a question. It is what somebody is asked, so it should be answerable as it stands.",
    );
  }
  if (!saysSomething(input.body)) {
    faults.push(
      "Nothing says what raised it or what is waiting on it, so it is answered from whatever the reader happens to remember.",
    );
  }
  if (input.links.length === 0 && input.scope.length === 0) {
    faults.push(
      "Nothing says what it is about: no record is linked and no code is scoped, so there is nothing to read beside it.",
    );
  }
  if (input.options.length === 1) {
    faults.push(
      "One option is a proposal rather than a choice. Offer the alternative, or ask for prose instead.",
    );
  }

  return { faults };
}

/**
 * Whether a body says anything at all.
 *
 * Fenced code is stepped over, so a question whose body is one example of the
 * very thing being asked about does not count as having been explained. A
 * heading is not prose either: what a question is called is the title, and a
 * `#` in the body is somebody quoting rather than saying.
 */
function saysSomething(body: string): boolean {
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (line.trim() !== "" && !/^\s*#/.test(line)) return true;
  }
  return false;
}

/**
 * The opening line of a body, for a strip one line tall.
 *
 * Markdown's own marks are stepped over: showing the hash would be the window
 * quoting syntax at somebody who asked to read a sentence.
 */
export function firstLines(content: string, count: number): string {
  const lines: string[] = [];
  let fenced = false;
  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const text = line.replace(/^#+\s*/, "").replace(/^\s*[-*+]\s+/, "").trim();
    if (text === "") continue;
    lines.push(text);
    if (lines.length === count) break;
  }
  return lines.join(" ");
}
