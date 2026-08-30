"use client";

import type { Entry, SessionRow, Transcript } from "@sync-buzz/extension-api";

import { fileName } from "./composer";

/**
 * Keeping a conversation, when somebody decides one is worth keeping.
 *
 * Nothing here happens by itself, and that is the design rather than a stage it
 * has not reached. Everything else in this project's memory is a claim that was
 * reconciled against the code that it describes; a transcript cannot be, and a
 * corpus filling with unreviewed ones would make every honest record in it
 * count for less. So a conversation is written when a person says it is worth
 * writing — which makes the record their claim rather than a side effect of
 * having talked to something.
 *
 * It is written under one type and there is no choice of another. Offering the
 * project's whole vocabulary was a question with one right answer: a transcript
 * filed as a decision is a decision nobody can trust, because the engine
 * reconciles a decision against the code and cannot reconcile this. So the
 * command asks nothing at all — it writes, under the name the conversation
 * already has, and the name is corrected in the row like every other name in
 * this window.
 *
 * This file is what a conversation *is* as a record: the fields that are true
 * of it, and the Markdown that is it. Nothing here draws anything.
 */

/** The one type a conversation is written as. */
export const CONVERSATION_KIND = "chat.conversation";

/**
 * A title from the conversation itself.
 *
 * Whatever the conversation is already called, which is the name in the list
 * beside it: derived from the first thing said, or typed by whoever renamed it.
 * A second answer worked out here would let a conversation somebody had
 * deliberately named be kept under a different title — and the one they chose
 * is the one they meant.
 *
 * The transcript is the fallback, for a session the application no longer
 * lists. Nothing asks anybody to confirm it, because there is nothing here they
 * have not already seen: the name is the one in front of them, and the record
 * is renamed in its own row the moment they disagree.
 */
export function suggestTitle(row: SessionRow | null, transcript: Transcript): string {
  if (row?.title != null && row.title !== "") return row.title;
  const asked = transcript.entries.find((entry) => entry.voice === "person");
  if (asked === undefined || asked.voice !== "person") return "Conversation";
  const line = asked.text.trim().split("\n")[0];
  return line.length > 72 ? `${line.slice(0, 71)}…` : line;
}

/**
 * What is true *of* the conversation, as the type's own fields.
 *
 * Not pasted at the top of the body. Which agent, in which directory and when
 * are facts about the record rather than part of what was said — so they belong
 * where the window shows what is true of a record, and where anything querying
 * the corpus can read them. A header in the prose would be neither, and would
 * be re-parsed by every reader that wanted one of them back.
 */
export function facts(
  row: SessionRow | null,
  transcript: Transcript,
): Record<string, unknown> {
  const written: Record<string, unknown> = {
    agent: row?.agentName ?? "Unknown",
    // `workdir`, never `folder`: the record's own envelope has a `folder`, so a
    // type declaring one as a product field describes a record the store
    // cannot hold — and every write of it is refused, twice.
    workdir: row?.cwd ?? "",
    // Whether the transcript is the whole conversation. `false` is the
    // load-bearing value: a record that begins in the middle and does not say
    // so reads as the whole of it.
    complete: transcript.dropped === 0,
  };
  if (row !== null) written.opened = new Date(row.openedAtMs).toISOString();
  if (transcript.mode !== null) written.model = transcript.mode;
  if (transcript.usage?.totalTokens !== undefined) {
    written.tokens = transcript.usage.totalTokens;
  }
  return written;
}

/**
 * The conversation as Markdown, because Markdown is what the store holds.
 *
 * Everything that was said is written, including what the window draws quietly:
 * a tool the agent ran and a plan it stated are part of what happened, and a
 * transcript that kept only the prose would be a record of a conversation that
 * did not take place. An update this build could not read is kept as its raw
 * JSON for the same reason.
 */
export function asMarkdown(row: SessionRow | null, transcript: Transcript): string {
  void row;
  return transcript.entries
    .map(block)
    .filter((text) => text !== "")
    .join("\n\n");
}

/**
 * The pictures pasted into a message, as the sentence that says they are gone.
 *
 * A pasted image has no file: it was held in the session and written nowhere,
 * and the conversation ending is the end of it. So the record says one was here
 * rather than showing nothing — a transcript that quietly omitted half of what
 * was sent would be a record of a conversation that did not happen. This is
 * the only place it is said, now that keeping asks nothing first — so it is
 * said in the record itself, where it stays.
 */
function pastedImages(images: readonly { readonly name: string }[]): string[] {
  if (images.length === 0) return [];
  return [
    "",
    ...images.map((image) => `- *${image.name} — pasted image, not saved*`),
  ];
}

/**
 * The files that went with a message, as links.
 *
 * Links rather than images, and that is the store's rule rather than a
 * preference: the record editor holds exactly what Markdown survives, and an
 * image is on the list of what it does not — a block that vanished the next
 * time the record was opened is worse than one that was never offered. A link
 * is a first-class part of the format, and it says the same true thing: this
 * conversation was about that file, which is at that path.
 *
 * The path is left absolute, because it is what was actually sent to the agent
 * and a record that rewrote it would be describing a different message. That it
 * names one machine's disk is a fact about attaching a file from outside the
 * repository, and it is the sender's to decide, not this function's to hide.
 */
function attached(paths: readonly string[]): string[] {
  if (paths.length === 0) return [];
  return ["", ...paths.map((path) => `- [${fileName(path)}](${encodeURI(path)})`)];
}

function block(entry: Entry): string {
  const at = entry.at === 0 ? "" : ` — ${new Date(entry.at).toLocaleTimeString()}`;
  switch (entry.voice) {
    case "person":
      return [
        `### You${at}`,
        "",
        entry.text,
        ...attached(entry.attachments),
        ...pastedImages(entry.images),
      ]
        .join("\n")
        .trim();
    case "agent":
      return `### Agent${at}\n\n${entry.text}`;
    case "thought":
      return `### Thinking${at}\n\n> ${entry.text.split("\n").join("\n> ")}`;
    // The same sentence a pasted picture gets, for the same reason: the record
    // travels with the repository, and the bytes are in a session that ends.
    // Saying a picture was here is the true thing that survives; embedding it
    // is the one thing this must not do.
    case "picture":
      return `### Picture${at}\n\n*a picture the agent made — not saved*`;
    case "tool":
      return `- \`${entry.title}\` — ${entry.status}`;
    case "plan":
      return [
        `### Plan${at}`,
        "",
        ...entry.steps.map((step) => `- [${step.status === "completed" ? "x" : " "}] ${step.title}`),
      ].join("\n");
    case "unread":
      return [
        `### ${entry.update ?? "Unrecognised update"}${at}`,
        "",
        "```json",
        JSON.stringify(entry.payload, null, 2),
        "```",
      ].join("\n");
    case "trouble":
      return `### Trouble${at}\n\n${entry.text}`;
  }
}
