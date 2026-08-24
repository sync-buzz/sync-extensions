"use client";

import { useEffect, useRef, useState } from "react";

import {
  Button,
  Markdown,
  ScrollArea,
  cn,
  sessionImage,
  showNativeContextMenu,
  type AgentSession,
  type Entry,
  type OpenQuestion,
  type PastedImage,
} from "@sync/extension-api";
import { ChevronRight, Paperclip } from "lucide-react";

import { fileName } from "./composer";

/**
 * The conversation, set like a document rather than like a chat.
 *
 * One measure, one type scale — the geometry a record is read in, and the
 * renderer a record is read with: an agent writes Markdown, so its answer is
 * drawn by the shell's own reading view rather than as the characters it
 * happens to be made of. Prose in this section and prose in a record are one
 * document, which is the point of taking the renderer rather than writing a
 * second one.
 *
 * Who is speaking is carried by three things that all survive greyscale: a
 * label, a rule down the leading edge of what a person said, and the surface
 * their block sits on. Not by a coloured bubble on alternating sides — the
 * shell's colour rule forbids it outright, and the first version of this leaned
 * on a label alone, which read as one undifferentiated column.
 */
export function Conversation({
  session,
  sessionKey,
}: {
  session: AgentSession;
  /** Which session's images to ask for. `null` when none is open. */
  sessionKey: string | null;
}) {
  const { entries, question, dropped } = session.transcript;
  const foot = useRef<HTMLDivElement>(null);

  // Follow the answer as it is written. Anchored to a node at the end rather
  // than by setting a scroll offset, so the panel owns its own scrolling.
  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  if (entries.length === 0 && question === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <p className="max-w-prose text-center text-sm text-fg-tertiary">
          The agent is running in this project&apos;s folder. Say something to it.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-(--prose-measure) flex-col gap-6 px-6 py-5">
        {dropped > 0 ? (
          <p className="text-xs text-fg-tertiary">
            {dropped} earlier {dropped === 1 ? "event is" : "events are"} no longer kept.
          </p>
        ) : null}

        {runs(entries).map((run) =>
          run.kind === "tools" ? (
            <ToolRun key={run.id} entries={run.entries} />
          ) : (
            <Block key={run.id} entry={run.entry} sessionKey={sessionKey} />
          ),
        )}

        {question === null ? null : <Question question={question} session={session} />}

        <div ref={foot} />
      </div>
    </ScrollArea>
  );
}

/**
 * The entries, with consecutive tool calls gathered into one.
 *
 * An agent working through a task emits a run of them — eight in a row is
 * ordinary — and eight rows that each say `completed` push the conversation off
 * the screen while saying almost nothing. Gathered, the run occupies one line
 * that names what is happening **now** and opens to the whole list when
 * somebody wants it.
 *
 * Only *consecutive* ones, because the gap between two runs is the agent having
 * said something in between, and merging across that would claim they were one
 * piece of work.
 */
type Run =
  | { kind: "one"; id: string; entry: Entry }
  | { kind: "tools"; id: string; entries: Extract<Entry, { voice: "tool" }>[] };

function runs(entries: readonly Entry[]): Run[] {
  const built: Run[] = [];
  for (const entry of entries) {
    const last = built.at(-1);
    if (entry.voice === "tool") {
      if (last?.kind === "tools") {
        last.entries.push(entry);
        continue;
      }
      built.push({ kind: "tools", id: entry.id, entries: [entry] });
      continue;
    }
    built.push({ kind: "one", id: entry.id, entry });
  }
  return built;
}

/**
 * A run of tool calls: the current one, and the rest on request.
 *
 * Closed by default and open by the same disclosure the rest of the system
 * uses — a triangle that turns. What it shows closed is the **last** call
 * rather than a count, because while the agent is working the last one is what
 * is happening now, and a count is a fact about the past.
 */
function ToolRun({ entries }: { entries: readonly Extract<Entry, { voice: "tool" }>[] }) {
  const [open, setOpen] = useState(false);
  const current = entries[entries.length - 1];
  const running = entries.filter((entry) => entry.status !== "completed" && entry.status !== "failed");

  return (
    <div className="flex flex-col gap-1 border-l border-separator pl-3">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex min-w-0 items-baseline gap-1.5 text-left"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3 shrink-0 translate-y-px text-fg-tertiary",
            "transition-transform duration-(--motion-duration-fast) ease-shell",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
          {current.title}
        </span>
        {entries.length > 1 && !open ? (
          <span className="shrink-0 text-xs text-fg-tertiary">
            {running.length > 0
              ? `${entries.length} steps`
              : `${entries.length} steps, done`}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-fg-tertiary">{current.status}</span>
        )}
      </button>

      {open ? (
        <ul className="flex flex-col gap-0.5 pl-4.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary">
                {entry.title}
              </span>
              <span className="shrink-0 text-xs text-fg-tertiary">{entry.status}</span>
              <Time at={entry.at} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Block({
  entry,
  sessionKey,
}: {
  entry: Entry;
  sessionKey: string | null;
}) {
  switch (entry.voice) {
    case "person":
      return (
        <Said
          entry={entry}
          who="You"
          text={entry.text}
          mine
          attachments={entry.attachments}
          images={entry.images}
          sessionKey={sessionKey}
        />
      );
    case "agent":
      return <Said entry={entry} who="Agent" text={entry.text} />;
    case "thought":
      return <Said entry={entry} who="Thinking" text={entry.text} quiet />;
    case "tool":
      // Reached only for a lone call; a run of them is drawn by `ToolRun`.
      return <ToolRun entries={[entry]} />;
    case "plan":
      return (
        <Aside entry={entry} who="Plan">
          <ul className="flex flex-col gap-0.5">
            {entry.steps.map((step, index) => (
              <li key={`${entry.id}-${index}`} className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 text-fg-secondary">{step.title}</span>
                <span className="shrink-0 text-xs text-fg-tertiary">{step.status}</span>
              </li>
            ))}
          </ul>
        </Aside>
      );
    case "unread":
      // Shown rather than dropped: an update no build has a reading for is
      // exactly the thing worth having in front of somebody.
      return (
        <Aside entry={entry} who={entry.update ?? "Unrecognised update"}>
          <pre className="overflow-x-auto font-mono text-xs text-fg-tertiary">
            {JSON.stringify(entry.payload, null, 2)}
          </pre>
        </Aside>
      );
    case "trouble":
      return <Said entry={entry} who="Trouble" text={entry.text} trouble />;
  }
}

/**
 * One thing that was said.
 *
 * What a person said is set apart by a surface and a rule rather than by
 * position or colour: it is the same column, the same measure and the same type
 * as the answer, because a question and its answer are one document. What tells
 * them apart is that one of them is inset and lifted — the treatment a quotation
 * gets in a document, which is what a person's own words are once the agent has
 * replied to them.
 */
function Said({
  entry,
  who,
  text,
  mine,
  quiet,
  trouble,
  attachments,
  images,
  sessionKey,
}: {
  entry: Entry;
  who: string;
  text: string;
  mine?: boolean;
  quiet?: boolean;
  trouble?: boolean;
  /** The files sent with it, as absolute paths. */
  attachments?: readonly string[];
  /** The images pasted into it, which the session holds the bytes of. */
  images?: readonly PastedImage[];
  sessionKey?: string | null;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        mine && "rounded-(--radius-control) border-l-2 border-separator bg-raised px-3 py-2",
      )}
      onContextMenu={(event) =>
        // The system's own menu, as everywhere else in this window. Copy is the
        // one thing a person wants from a block of somebody else's text, and a
        // menu drawn in the document would be the one place the application
        // stopped looking native.
        showNativeContextMenu(event, [
          { label: "Copy", onSelect: () => void navigator.clipboard.writeText(text) },
        ])
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-xs text-fg-tertiary",
            mine && "font-semibold text-fg-secondary",
            trouble && "text-danger",
          )}
        >
          {who}
        </span>
        <Time at={entry.at} />
      </div>
      {/* No size of its own, deliberately. What a person set in Settings has to
          reach a message the same way it reaches a record — through
          `.prose-surface` — and a `text-base` here was a utility winning the
          cascade over that variable, which is how this section spent a while
          ignoring the type scale while Records honoured it. */}
      <div
        className={cn(
          "prose-surface min-w-0 text-fg",
          (quiet || trouble) && "text-fg-secondary",
        )}
      >
        {/* The shell's own reading view. An agent writes Markdown — lists,
            fences, tables — and showing the characters instead would be this
            section reading a record differently from the rest of the window. */}
        <Markdown>{text}</Markdown>
      </div>
      {images === undefined || images.length === 0 || !sessionKey ? null : (
        <ul className="flex flex-wrap items-end gap-1.5">
          {images.map((image) => (
            <li key={image.id}>
              <PastedPicture sessionKey={sessionKey} image={image} />
            </li>
          ))}
        </ul>
      )}
      {attachments === undefined || attachments.length === 0 ? null : (
        <Attachments paths={attachments} />
      )}
    </div>
  );
}

/**
 * A picture that was pasted into a message.
 *
 * The bytes are asked for when this is drawn rather than carried in the
 * transcript: the history is replayed whole to every screen that returns to the
 * conversation, and a picture in it would be paid for on each one.
 *
 * They live in the session and nowhere else, so this is also what a conversation
 * losing them looks like — the session is gone, the fetch fails, and the message
 * says a picture was here rather than showing a gap.
 */
function PastedPicture({
  sessionKey,
  image,
}: {
  sessionKey: string;
  image: PastedImage;
}) {
  // The reading is held *with* what it is a reading of, so a picture from the
  // conversation this component was last drawn for cannot be shown under the
  // one it is drawn for now. React reuses a component whose key matches, and
  // the ids here are the same in every session — `p0` is the first picture of
  // whichever conversation it belongs to.
  const [read, setRead] = useState<{
    readonly of: string;
    readonly source: string | null;
  } | null>(null);
  const of = `${sessionKey}/${image.id}`;
  const source = read?.of === of ? read.source : undefined;

  useEffect(() => {
    let current = true;
    sessionImage(sessionKey, image.id)
      .then((found) => {
        if (current) setRead({ of, source: `data:${found.mimeType};base64,${found.data}` });
      })
      .catch(() => {
        if (current) setRead({ of, source: null });
      });
    return () => {
      current = false;
    };
  }, [sessionKey, image.id, of]);

  if (source === null) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-fg-tertiary">
        <Paperclip className="size-3 shrink-0" />
        {image.name} — no longer held
      </span>
    );
  }
  if (source === undefined) {
    return <span className="block h-20 w-28 rounded-(--radius-control) bg-raised" />;
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- the bytes are in
       hand, not at a URL a loader could optimise. */
    <img
      src={source}
      alt={image.name}
      className="h-20 w-auto rounded-(--radius-control) border border-separator object-cover"
    />
  );
}

/**
 * The files that went with a message.
 *
 * Names, not pictures. The agent was handed a path and opened the file itself —
 * this application never did, and has no permission to — so a thumbnail here
 * would be the window showing something it has not seen. The whole path is the
 * tooltip, because two screenshots are told apart by where they are.
 */
function Attachments({ paths }: { paths: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {paths.map((path) => (
        <li key={path} className="flex min-w-0 items-center gap-1.5">
          <Paperclip className="size-3 shrink-0 text-fg-tertiary" />
          <span className="min-w-0 truncate font-mono text-xs text-fg-secondary" title={path}>
            {fileName(path)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Something that happened rather than something that was said. */
function Aside({
  entry,
  who,
  children,
}: {
  entry: Entry;
  who: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-l border-separator pl-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-fg-tertiary">{who}</span>
        <Time at={entry.at} />
      </div>
      {children}
    </div>
  );
}

/**
 * When a block was written, at the precision a conversation needs.
 *
 * The hour and the minute, in the reader's own locale and their own clock
 * convention. Seconds would be noise — the pause rule already separates what
 * happened at different times, and this only has to answer "when was that".
 */
function Time({ at }: { at: number }) {
  if (at === 0) return null;
  return (
    <time
      dateTime={new Date(at).toISOString()}
      className="shrink-0 font-mono text-xs text-fg-tertiary tabular-nums"
    >
      {new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}

/**
 * The agent asking to be allowed to do something.
 *
 * Its options are drawn in the order and with the names the agent sent, and no
 * button is added that it did not offer: one measured agent offers no "allow
 * always" at all and another puts the refusal first, and a window that tidied
 * that would be offering choices the agent will not accept.
 */
function Question({ question, session }: { question: OpenQuestion; session: AgentSession }) {
  const message = question.request.toolCall?._meta?.message;
  const rawInput = question.request.toolCall?.rawInput;
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-separator p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-fg-secondary">Asking permission</span>
        <Time at={question.at} />
      </div>
      <p className="text-sm text-fg">
        {question.request.toolCall?.title ?? question.toolName ?? "An operation"}
      </p>
      {message ? <p className="text-sm text-fg-secondary">{message}</p> : null}
      {hasInput(rawInput) ? (
        <pre className="max-h-40 overflow-auto rounded-(--radius-control) bg-surface-secondary p-2 font-mono text-xs text-fg-secondary">
          {formatInput(rawInput)}
        </pre>
      ) : null}
      {question.request.toolCall?.locations?.length ? (
        <p className="truncate font-mono text-xs text-fg-tertiary">
          {question.request.toolCall.locations.map((place) => place.path).join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {question.request.options.map((option) => (
          <Button
            key={option.optionId}
            size="sm"
            variant={option.kind.startsWith("reject") ? "ghost" : "default"}
            onClick={() => void session.answer(option.optionId)}
          >
            {option.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

function hasInput(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return true;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}

function formatInput(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
