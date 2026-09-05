"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  chooseAttachments,
  cn,
  explain,
  type Agent,
  type AgentSession,
  type PastedContent,
  type SessionConfigOption,
  type Worktree,
  type WorktreeChoice,
} from "@sync-buzz/extension-api";
import { ArrowUp, FileText, Paperclip, Square, X } from "lucide-react";

import { committed, spelled, type Handed } from "./addressing";
import { AgentPicker, ModePicker, ModelPicker, WorktreePicker } from "./pickers";

/**
 * What is half-written in one conversation.
 *
 * Held by the area rather than inside the composer, because a person who starts
 * a sentence, goes to look at another conversation and comes back has not
 * abandoned it — and the composer is one instance drawn for whichever
 * conversation is open, so state kept inside it would follow them to the next
 * one instead of staying with the message it belongs to. That was the first
 * version of this, and it carried a half-typed line, its attachments and its
 * pictures into somebody else's conversation.
 */
export interface Draft {
  /**
   * The conversation this message is addressed to, once the name is settled.
   *
   * A member of the draft rather than the first word of `text`, because it is
   * drawn as a token and a token is a thing rather than a spelling: it survives
   * leaving the conversation and coming back, exactly as the half-written
   * sentence beside it does, and nothing has to re-read the text to find it.
   */
  readonly to?: Handed;
  readonly text: string;
  readonly attached: readonly string[];
  readonly pasted: readonly PastedContent[];
}

/** A conversation nobody has started writing in. */
export const EMPTY_DRAFT: Draft = { text: "", attached: [], pasted: [] };

/**
 * What a message will be sent *with*, as the strip above the field draws it.
 *
 * Here rather than in the panel that describes the conversation, and the move
 * is the point. An inspector says what is true of the thing in the workspace and
 * does nothing to it — that is the rule this window states for the column, and
 * the model picker sitting there broke it. It is also the column that collapses,
 * and below a certain width cannot be opened at all, so the choice a person
 * makes most often lived in the one place that can go away.
 *
 * The composer is where it belongs by the same argument the attachment shelf
 * already won: which agent, which model and how freely it may act are all part
 * of what pressing Return does, and they are read in the moment before pressing
 * it.
 */
export interface Settings {
  /** Every agent this machine could raise, for the choice before the first word. */
  readonly agents: readonly Agent[];
  /** Whether the read behind {@link Settings.agents} is still out. */
  readonly agentsLoading: boolean;
  readonly agentId: string;
  readonly agentName: string;
  /** Whether an agent is being raised right now. */
  readonly starting: boolean;
  /**
   * Whether the agent is fixed, which it is the moment anything has been said.
   * A conversation is held *by* a process; changing which one would be a
   * different conversation, and this window has a command for that already.
   */
  readonly settled: boolean;
  readonly onAgent: (agentId: string) => void;
  /** The model option the agent stated, or `null` where it stated none. */
  readonly model: SessionConfigOption | null;
  /**
   * The working trees this project has, for the choice before the first word.
   *
   * Empty where the project is not a repository or has no commit yet — the host
   * refuses to list any, and a choice nothing can honour is one this strip does
   * not draw.
   */
  readonly worktrees: readonly Worktree[];
  /** The tree this conversation is being held in, `null` for the project's. */
  readonly worktree: Worktree | null;
  /**
   * Which conversation is in which tree, by the tree's path.
   *
   * The strip does not hold the list of conversations and must not start: this
   * arrives already answered, so that the menu can say what is in a tree and
   * offer to throw away only the trees nothing is in.
   */
  readonly worktreesHeldBy: ReadonlyMap<string, string>;
  /** Whether trees are possible here at all, which is one read, made once. */
  readonly worktreesOffered: boolean;
  readonly onWorktree: (choice: WorktreeChoice | null) => void;
  /** Throws a tree away, having asked. Only ever one nothing is in. */
  readonly onDiscardWorktree: (path: string) => void;
}

/**
 * What happened to the last send, and which conversation it happened in.
 *
 * The key travels with the answer for the same reason the transcript's reading
 * carries one: a state that belonged to another conversation is not this one's
 * to show, and saying so in the value beats clearing it in an effect.
 */
interface Turn {
  readonly of: string | null;
  readonly refused: string | null;
  readonly sending: boolean;
}

const NO_TURN: Turn = { of: null, refused: null, sending: false };

/**
 * Where a person writes.
 *
 * A band at the foot of the workspace, at the height the window's other bands
 * use, so the column reads as one slab rather than as a page with a widget
 * stuck to the bottom. It grows with what is typed and stops, because a field
 * that grows without limit takes the conversation off the screen it is about.
 *
 * Return sends and Shift-Return breaks a line — the convention every macOS
 * application with a message field uses, and the one a person will try first.
 *
 * There are two gestures here and they are not the same thing.
 *
 * A file **attached** with the paperclip is *named* to the agent, never opened:
 * its path crosses as a resource link and the agent — already running in this
 * project's folder — reads it itself. That is why it needs no filesystem
 * permission the window did not have, and why what is on screen is a name
 * rather than a picture: this application has not seen inside it.
 *
 * An image **pasted** from the clipboard has no file to name. Its bytes cross
 * as image content and are held in the session, in memory, for as long as the
 * conversation lives. Nothing is written to disk — not here, not in a temporary
 * directory, not at all — which is why a pasted image is drawn and is not kept
 * when the conversation is.
 */
export function Composer({
  session,
  projectPath,
  agentName,
  acceptsImages,
  draft,
  onDraft,
  settings,
  onHand,
  standing,
}: {
  session: AgentSession;
  /** Where the system's open panel starts, which is where a person is working. */
  projectPath: string;
  /** Whose refusal to name, when this agent will not take a picture. */
  agentName: string;
  /** Whether the agent said at `initialize` that it reads images. */
  acceptsImages: boolean;
  /** What is half-written in *this* conversation. */
  draft: Draft;
  /**
   * Changes it, from whatever it is when the change lands.
   *
   * A function rather than a value, for the same reason `setState` takes one:
   * reading a pasted file finishes after a wait, and anything typed meanwhile
   * belongs to the same message. A change built from the draft in hand when the
   * read began would delete it.
   */
  onDraft: (change: (held: Draft) => Draft) => void;
  /** What this message will be sent with — see {@link Settings}. */
  settings: Settings;
  /**
   * Hands the message to another conversation, raising it where the name is new.
   *
   * Here as a function passed in rather than done in this file, and the seam is
   * where it is for a reason: handing work over reaches the whole conversation
   * — which agent is holding it, which tree it is in, what it came out of — and
   * none of that is the field's business. The field reads who it is for.
   */
  onHand: (handed: Handed, body: string) => Promise<void>;
  /**
   * Whether a name is already a conversation of this family.
   *
   * Asked so the line below the field can say *goes to* rather than *opens*,
   * which are two different things to somebody about to press Return: one
   * carries on with work, the other starts some.
   */
  standing: (name: string) => boolean;
  /**
   * How to leave for the field that writes a document, drawn as one control
   * beside the paperclip.
   *
   * Absent where this is the only field there is, which is what keeps the
   * control out of a window that has nowhere for it to lead. The field it leads
   * to draws the same control in the same place, pointing back.
   */
}) {
  const { text, attached, pasted } = draft;
  // Held *with* the conversation they are about, rather than reset when it
  // changes. Both are about one conversation and one send, and this component
  // is drawn for whichever one is open: a refusal naming the agent somebody has
  // just left explains nothing, and a send still in flight there would be
  // holding this conversation's button down. Deriving them beats correcting
  // them in an effect, which is a render of the wrong answer followed by a
  // second render of the right one.
  const [turn, setTurn] = useState<Turn>(NO_TURN);
  const { refused, sending } = turn.of === session.key ? turn : NO_TURN;
  // A model or a mode the agent would not take, said in the same line a refused
  // send is said in. The shell's rule is that a command which did not happen
  // says so where it was asked for, and both of these are one gesture with one
  // answer — without this they are a menu that closes and changes nothing.
  //
  // Keyed by session for the same reason the turn is: a refusal belonging to a
  // conversation somebody has left explains nothing where they are now.
  const [denied, setDenied] = useState<{ of: string | null; said: string } | null>(null);
  const said = denied?.of === session.key ? denied.said : null;

  /** Runs one setting change, and keeps whatever the agent said about it. */
  const settle = async (change: Promise<unknown>) => {
    try {
      await change;
      setDenied(null);
    } catch (failure) {
      setDenied({ of: session.key, said: explain(failure) });
    }
  };
  const field = useRef<HTMLTextAreaElement>(null);
  const frame = useRef<HTMLDivElement>(null);

  /**
   * What `@` is about to do, while the name is still being written.
   *
   * One state and no more. The moment the name settles it becomes a token in
   * the band, and a token says where a message is going the way a recipient
   * does — so a sentence saying the same thing beside it would be the interface
   * explaining its own furniture.
   */
  const hint =
    draft.to === undefined && text.trimStart().startsWith("@")
      ? "Name a conversation. A message that starts with a name goes there rather than here."
      : null;

  /**
   * Whether this message is on its way somewhere other than here.
   *
   * True from the first `@` rather than from the settled name, so the row
   * changes once — while somebody is typing the address — instead of twice.
   */
  const elsewhere = draft.to !== undefined || hint !== null;

  const write = (change: (held: Draft) => Partial<Draft>) =>
    onDraft((held) => ({ ...held, ...change(held) }));

  const closed = session.transcript.status === "ended" || session.transcript.status === "failed";
  const asking = session.transcript.question !== null;
  // Attached files and pasted images are a request on their own: "look at this"
  // is a whole thing to say, and refusing it because the field is empty would be
  // this window deciding what counts as asking.
  const empty = text.trim() === "" && attached.length === 0 && pasted.length === 0;

  const send = async () => {
    if (empty || sending || closed) return;
    const sent = draft;
    const of = session.key;
    onDraft(() => EMPTY_DRAFT);
    setTurn({ of, refused: null, sending: true });
    try {
      // Handed away, and it does not also happen here: a message with somebody
      // else's name at the head of it was addressed to them, and saying it in
      // both places would be one sentence turning into two conversations.
      if (sent.to === undefined) {
        await session.prompt(sent.text, sent.attached, sent.pasted);
      } else {
        await onHand(sent.to, sent.text);
      }
      setTurn({ of, refused: null, sending: false });
    } catch (error) {
      // Put back exactly what was about to be sent, and say why it was not. A
      // turn can be refused for reasons that are nobody's mistake — an agent
      // that does not read images, a session that has already ended, more
      // pictures than one conversation may hold — and a message that vanished
      // on any of them would be the failure this window is least allowed to
      // have.
      onDraft(() => sent);
      setTurn({
        of,
        refused: error instanceof Error ? error.message : String(error),
        sending: false,
      });
    }
  };

  const attach = async () => {
    const chosen = await chooseAttachments(projectPath);
    if (chosen.length === 0) return;
    write((held) => ({
      // The same file twice is the same file: attaching it again says nothing
      // the first one did not, and the agent would be handed one path two ways.
      attached: [...held.attached, ...chosen.filter((path) => !held.attached.includes(path))],
    }));
    field.current?.focus();
  };

  /**
   * A picture from the clipboard.
   *
   * The gesture is the system's, so the field keeps every other paste it is
   * given: text goes on behaving as text, and only an image is intercepted.
   *
   * An agent that never said it reads images is told nothing and asked nothing.
   * It is said in a line instead — refusing quietly would leave somebody
   * pressing Command-V at a field that does nothing, and the reason is a fact
   * about the agent rather than about what they did.
   */
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pictures = picturesIn(event.clipboardData);
    if (pictures.length === 0) return;
    event.preventDefault();

    if (!acceptsImages) {
      setTurn({
        of: session.key,
        refused: `${agentName} does not read images, so this one was not attached.`,
        sending: false,
      });
      return;
    }

    setTurn({ of: session.key, refused: null, sending: false });
    void (async () => {
      const read = await Promise.all(pictures.map(asPasted));
      write((held) => ({ pasted: [...held.pasted, ...read] }));
    })();
  };

  // The field is as tall as what is in it, up to the ceiling its class sets.
  // Measured rather than declared: `field-sizing: content` is one line and says
  // exactly this, and it is not in the WebKit that the oldest macOS this build
  // supports carries — so a field written that way would stay one line high on
  // the systems it was written for.
  //
  // Two details the obvious version gets wrong. The height is reset to `auto`
  // first, because `scrollHeight` of an element that is already tall enough is
  // the height it was given, so a field that grew would never shrink again. And
  // the border is added back: everything here is `border-box`, `scrollHeight`
  // counts padding but not border, and setting the height to it exactly would
  // take two pixels off the text — which is a scrollbar on a single line.
  //
  // A third the reset alone gets wrong, and it is the one that shows. Reading
  // `scrollHeight` forces the layout, and for that one pass the field is a
  // single row: the column gives the pixels it let go of to the transcript
  // above, which grows by them, and the browser clamps that scroller's
  // `scrollTop` to a maximum that has just fallen. The height is put straight
  // back — the clamp is not. Left to itself that takes a field a hundred pixels
  // tall and pulls the conversation a hundred pixels off the end on every
  // keystroke, leaving the reader part way up a transcript nobody scrolled.
  //
  // So the box around the field holds its height for the length of the
  // measurement. Nothing outside it moves, the scroller keeps the size it had,
  // and its position is never clamped in the first place. The box rather than
  // the field, because the field is what has to be free to change size for the
  // measurement to mean anything.
  useLayoutEffect(() => {
    const node = field.current;
    const box = frame.current;
    if (node === null || box === null) return;
    const held = box.style.height;
    box.style.height = `${box.offsetHeight}px`;
    node.style.height = "auto";
    const border = node.offsetHeight - node.clientHeight;
    node.style.height = `${node.scrollHeight + border}px`;
    box.style.height = held;
  }, [text]);

  // A conversation with nothing in it is one somebody has just opened in order
  // to say something, so the caret is already where they are about to type.
  // That is the whole of what "the conversation starts immediately" means at
  // the keyboard, and it is the half a button cannot do.
  //
  // Only when nothing has been said. Opening a conversation with a transcript
  // is reading it — a person who clicks a row to see what an agent replied
  // overnight has not asked for the caret, and taking focus would move them off
  // whatever they were about to scroll or select.
  const unspoken = session.transcript.entries.length === 0;
  useEffect(() => {
    if (!unspoken) return;
    field.current?.focus();
  }, [session.key, unspoken]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
      return;
    }
    // Backspace in an empty field takes back the last thing put on the message,
    // which is what a token field on this system does — and what somebody who
    // has just attached the wrong file tries before reaching for the pointer.
    // The most recent first, which is the pasted picture where there is one.
    if (event.key === "Backspace" && text === "") {
      if (pasted.length > 0) {
        event.preventDefault();
        write((held) => ({ pasted: held.pasted.slice(0, -1) }));
        return;
      }
      if (attached.length > 0) {
        event.preventDefault();
        write((held) => ({ attached: held.attached.slice(0, -1) }));
        return;
      }
      // Oldest of all, so last of all: the address was put on the message
      // before anything else was written into it.
      if (draft.to !== undefined) {
        event.preventDefault();
        write(() => ({ to: undefined }));
      }
    }
  };

  return (
    <div className="shrink-0 border-t border-separator px-3 py-2">
      {asking ? (
        <p className="pb-2 text-xs text-fg-tertiary">
          The agent is waiting for an answer above.
        </p>
      ) : null}
      <div className="relative mx-auto flex w-full max-w-(--prose-measure) flex-col gap-1.5">
        {refused === null && said === null ? null : (
          <p className="text-xs text-fg-tertiary">{refused ?? said}</p>
        )}

        <div className="flex w-full items-end gap-2">
          {/* One surface holds the message, everything going with it, and every
              answer to how it travels. The focus ring is drawn here rather than
              on the field, because the well is what a person is writing in — a
              ring around the text alone would cut the shelf and the header out
              of the thing being focused. */}
          <div
            ref={frame}
            className={cn(
              "min-w-0 flex-1 rounded-(--radius-control)",
              "border border-separator bg-raised",
              "has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-1",
              "has-[textarea:focus-visible]:outline-focus",
            )}
          >
            {/* Inside the well and above the line, which is the arrangement a
                compose window uses for the account a message goes out under:
                first what it is being sent with, then what is being sent.

                Inside rather than floating above, and that is the whole of this
                block's argument — the same one the shelf below already makes.
                Held out in a band of its own it read as a row of words that had
                landed near the composer, and it had nothing to line up with:
                the field's own text begins past a button, so a strip starting
                at the band's margin put three different left edges in three
                stacked rows. Sharing the well, there is one edge and one
                object. */}
            <div className="flex w-full min-w-0 items-center gap-0.5 border-b border-separator px-0.5 py-1">
              {/* First in the row, because a compose window puts the recipient
                  before the account it goes out under, and this row is that
                  window's header. It is a token rather than a sentence for the
                  same reason mail draws one: where a message is going is a
                  thing, and a thing is shown. */}
              {draft.to === undefined ? null : (
                <Recipient
                  handed={draft.to}
                  standing={standing(draft.to.to)}
                  // Whoever holds this conversation holds what it delegates,
                  // unless the address named somebody else. Passed in so the
                  // token can say which, now that nothing else in the row does.
                  here={settings.agentName}
                  onRemove={() => write(() => ({ to: undefined }))}
                />
              )}

              {/* Gone with the other three, and for a sharper reason than
                  theirs. This says which agent holds *this* conversation, and
                  beside an address naming another it is two agents on one line
                  with the wrong one drawn as the control — `@test:codex` next
                  to a button reading `Claude Code` is the row contradicting
                  itself. Which agent will hold the message is part of the
                  address, so it is said on the token. */}
              {elsewhere ? null : (
                <AgentPicker
                  agents={settings.agents}
                  loading={settings.agentsLoading}
                  currentId={settings.agentId}
                  currentName={settings.agentName}
                  starting={settings.starting}
                  settled={settings.settled}
                  onChoose={settings.onAgent}
                />
              )}
              {/* Absent rather than empty, in both cases. An agent that states no
                  models and one that states no modes are saying they have none to
                  offer, and a pop-up button over nothing is a promise this build
                  cannot keep. What the agent does offer is the whole of what is
                  drawn — no table in this build decides it. */}
              {/* Nothing is offered on a conversation whose agent has gone. Both
                  calls go to the process, and the host refuses one that is not up —
                  so a picker still drawn here would not be a control that quietly
                  did nothing, it would be a rejected promise nobody is holding. The
                  agent's name stays, because that is a fact and it stays true. */}
              {/* **Gone while the message is addressed elsewhere, not merely
                  moved aside.** These three say how the agent standing here
                  will answer, and a message going to another conversation is
                  not answered here at all — so they are not controls that
                  happen to be crowded, they are controls that do not apply.
                  What is left reads as a compose header does: who it is for,
                  then who it goes out as. */}
              {elsewhere || closed || settings.model === null ? null : (
                <ModelPicker
                  option={settings.model}
                  onChoose={(valueId) => void settle(session.choose(settings.model!.id, valueId))}
                />
              )}
              {elsewhere || closed || session.modes.length === 0 ? null : (
                <ModePicker
                  modes={session.modes}
                  current={session.transcript.mode}
                  onChoose={(modeId) => void settle(session.setMode(modeId))}
                />
              )}
              {/* Last, and behind a rule. Where the work lands is a different
                  question from who does it and how freely, so it is not read as one
                  of the three — and a rule is how this system says that in a row
                  this narrow, the same mark a toolbar uses to part one group of
                  controls from the next.

                  A rule rather than the trailing edge, which is where this sat
                  while the row was the width of the prose. Held apart by everything
                  going spare, one control ended up alone against the far margin
                  with a third of the band empty beside it: not a group of its own,
                  which is what was meant, but a thing that had come loose.

                  Left out entirely where the host will not list trees: a project
                  that is not a repository has nowhere to put one, and a control
                  that could only refuse is worse than no control. The rule goes
                  with it, and goes on the same condition: a settled conversation
                  in the project's own tree says nothing here, and a mark parting
                  a group from an empty space is a hairline the eye has to
                  account for and cannot. */}
              {!elsewhere &&
              settings.worktreesOffered &&
              !(settings.settled && settings.worktree === null) ? (
                <>
                  <Rule />
                  <WorktreePicker
                    trees={settings.worktrees}
                    current={settings.worktree}
                    heldBy={settings.worktreesHeldBy}
                    starting={settings.starting}
                    settled={settings.settled}
                    onChoose={settings.onWorktree}
                    onDiscard={settings.onDiscardWorktree}
                  />
                </>
              ) : null}

              {/* Where this message is going, in the gap this row already has.
                  The paperclip is held against the trailing edge, so everything
                  between it and the pickers is space that exists whether or not
                  anything is written in it — which is the whole reason the text
                  is here rather than in a line of its own above the well. A line
                  that appeared as somebody typed moved the field they were
                  typing in, and a field that moves under the caret is worse than
                  no help at all.

                  It reads as one more caption in a row of captions rather than
                  as a notice, and it is the first thing in the row to give up
                  width: the four pickers are controls and this is help, so it
                  truncates while they keep their labels. Truncates rather than
                  wraps — a band that grew a second line would be the movement
                  this arrangement exists to avoid, one row further down. */}
              {hint === null ? null : (
                <span className="ml-1 min-w-0 truncate text-xs text-fg-tertiary">{hint}</span>
              )}

              {/* The rule is pushed to the trailing edge and the paperclip
                  follows it, so the mark that parts the two groups travels with
                  the group it parts rather than sitting in the middle of the
                  space. */}
              <Rule className="ml-auto" />
              {/* Against the trailing edge, because attaching is the one thing in
                  this row that adds to the message rather than describing how it
                  travels — and it belongs beside the button that sends it rather
                  than among the four that answer *with what*. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void attach()}
                    disabled={closed}
                    aria-label="Attach files"
                    className="text-fg-secondary"
                  >
                    <Paperclip />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach files</TooltipContent>
              </Tooltip>
              {/* Beside the paperclip, because it belongs to the same question:
                  what is being written, and with what. Which of the two fields
                  is on screen is not a setting about the agent, so it is not
                  among the four that answer *with what* — it is against the
                  edge with the one other control that changes the message
                  itself. */}
            </div>
            {attached.length === 0 && pasted.length === 0 ? null : (
              <Shelf
                paths={attached}
                images={pasted}
                onRemovePath={(path) =>
                  write((held) => ({
                    attached: held.attached.filter((kept) => kept !== path),
                  }))
                }
                onRemoveImage={(at) =>
                  write((held) => ({
                    pasted: held.pasted.filter((_, index) => index !== at),
                  }))
                }
              />
            )}

            {/* Set as the messages above it are, `.prose-surface` and all:
                what a person is typing and what they will have said are one
                piece of prose, and a field that stayed at the shell's own size
                made the two read as different documents the moment somebody
                asked for larger text. */}
            <textarea
              ref={field}
              value={text}
              onChange={(event) => {
                const said = event.target.value;
                // The address is taken out of the text the moment it settles,
                // and only while there is not one already: a second `@name`
                // further down the message is somebody naming a conversation.
                const settled = draft.to === undefined ? committed(said) : null;
                write(() =>
                  settled === null
                    ? { text: said }
                    : { to: settled.handed, text: settled.body },
                );
              }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              disabled={closed}
              rows={1}
              placeholder={closed ? "This conversation has ended." : "Message the agent"}
              className={cn(
                "prose-surface block max-h-40 min-h-(--control-height) w-full resize-none overflow-y-auto",
                "border-0 bg-transparent px-2.5 py-1.5 text-fg outline-none",
                "placeholder:text-fg-tertiary disabled:text-fg-tertiary",
                "focus-visible:outline-none",
              )}
            />
          </div>

          {/* One control, and which one it is says what the agent is doing.
              Sending and stopping are the two halves of the same moment — the
              agent is working *because* something was sent — so they take one
              place rather than sitting side by side with one of them always
              dead. It is also where the hand already is: a person who has just
              pressed send and wants it back does not go looking in a panel. */}
          {session.isWorking ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void session.cancel()}
              aria-label="Stop the agent"
            >
              <Square />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void send()}
              disabled={closed || empty || sending}
              aria-label="Send"
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The mark between two groups of controls in one row.
 *
 * A hairline, at the height of the words rather than the height of the row, so
 * it parts the controls without drawing a second border across a well that has
 * one. Announced to nobody: a rule says *these are not those*, which the reader
 * of a screen gets from the order and the labels already, and a decoration in
 * the accessibility tree is one more thing to arrow past for no gain.
 */
/**
 * Where this message is going, drawn the way a recipient is drawn.
 *
 * **Filled once the conversation exists, outlined while it does not.** That is
 * the one distinction worth a person's attention before they press Return: a
 * settled token carries on with work that is already going, an unsettled one
 * starts some. It is the same difference a mail client draws between a
 * recipient it resolved and one it has only been told about, and it is said in
 * the token's own weight rather than in a word beside it — a row this narrow
 * has no room for the word, and the tooltip has the whole sentence for anybody
 * who wants it.
 */
function Recipient({
  handed,
  standing,
  here,
  onRemove,
}: {
  handed: Handed;
  /** Whether a conversation of this name is already going. */
  standing: boolean;
  /** The agent holding this conversation, which a new one inherits. */
  here: string;
  onRemove: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            // **Inset from the well by as much as the band already insets it
            // from the top and the bottom.** The controls beside it are ghost
            // buttons whose ink begins inside their own box, so the band's 2px
            // is enough for them; a token's ink *is* its box, and at 2px it
            // meets the well's rounded corner. `ml-1` makes the gap the same on
            // all three sides, which is what stops it reading as vertically
            // centred and horizontally forgotten.
            //
            // A row shorter than the h-6 controls around it, as a token is: the
            // height belongs to the button beside it, and matching it exactly
            // would draw a filled slab where a capsule was meant.
            "ml-1 flex h-5 min-w-0 shrink-0 items-center gap-1 rounded-full pr-1 pl-2 text-xs",
            standing
              ? "bg-selected text-fg"
              : "border border-separator text-fg-secondary",
          )}
        >
          <span className="truncate">{spelled(handed)}</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Do not send to ${handed.to}`}
            className="flex size-3.5 shrink-0 items-center justify-center rounded-full text-fg-tertiary hover:text-fg"
          >
            <X className="size-2.5" />
          </button>
        </span>
      </TooltipTrigger>
      {/* Which agent, said here rather than on the token. A conversation that
          is already going has one and it cannot be changed, so naming it on the
          face would be offering a choice that does not exist; a new one takes
          the agent from the address or from this conversation, and that is
          worth a sentence rather than a suffix nobody asked for. */}
      <TooltipContent>
        {standing
          ? `Goes to ${handed.to} rather than to this conversation.`
          : `Opens ${handed.to} with ${handed.with ?? here} and sends this there.`}
      </TooltipContent>
    </Tooltip>
  );
}

function Rule({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("mx-1 h-3.5 w-px shrink-0 bg-separator", className)} />
  );
}

/**
 * What is going with the message, drawn on a shelf inside the field.
 *
 * Inside rather than above, because an attachment *is* part of what is being
 * sent — the same reason Messages keeps one in the bubble it is being written
 * into. Held out in its own block above the field, it read as a widget that had
 * landed next to the composer rather than as something the message carries.
 *
 * Files first, then pictures, which is the order Backspace takes them back in.
 *
 * One tile, one size, whichever kind it is. A row that mixed a text chip with a
 * picture would be two answers to the same question — how much of this message
 * is not typed — and neither would be readable at a glance.
 */
function Shelf({
  paths,
  images,
  onRemovePath,
  onRemoveImage,
}: {
  paths: readonly string[];
  images: readonly PastedContent[];
  onRemovePath: (path: string) => void;
  onRemoveImage: (at: number) => void;
}) {
  return (
    // The trailing space is the shelf's own: the field below brings its top
    // padding, and a shelf that also ended in one would sit twice as far from
    // the line it belongs to as it does from the edge above it.
    <ul className="flex flex-wrap items-start gap-2 px-2.5 pt-2.5 pb-1">
      {paths.map((path) => (
        <li key={`file:${path}`}>
          {/* The file's own name is on the tile and the whole path is its
              tooltip. Two screenshots called `Screenshot.png` are told apart by
              where they are and by nothing else, so the answer has to be
              reachable without sitting in the way. */}
          <Tile label={fileName(path)} tip={path} onRemove={() => onRemovePath(path)}>
            {/* A name, because this window has not seen inside the file — it
                only tells the agent where to look. */}
            <span className="flex size-full flex-col items-center justify-center gap-1 bg-selected p-1">
              <FileText className="size-5 shrink-0 text-fg-tertiary" />
              <span className="line-clamp-2 w-full break-all text-center text-[10px] leading-tight text-fg-secondary">
                {fileName(path)}
              </span>
            </span>
          </Tile>
        </li>
      ))}

      {/* Removed by position rather than by anything in the image: two
          screenshots of the same window are byte-identical often enough that a
          key made from them would take away the wrong one. */}
      {images.map((image, at) => (
        <li key={`image:${at}`}>
          {/* No tooltip: every engine invents the same name for a clipboard
              image, so it would say "Pasted image" over a picture of itself. */}
          <Tile label={image.name} onRemove={() => onRemoveImage(at)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the bytes
                are in hand, not at a URL a loader could optimise. */}
            <img
              src={`data:${image.mimeType};base64,${image.data}`}
              alt={image.name}
              className="size-full object-cover"
            />
          </Tile>
        </li>
      ))}
    </ul>
  );
}

/**
 * One thing waiting to go with the message.
 *
 * A square, cropped from the middle. A picture pasted here is usually a
 * screenshot of a window, which is wide enough that keeping its shape would
 * give one attachment three times the shelf of the next — and nothing in it is
 * legible at this size either way, so the shape buys less than the even row
 * costs.
 *
 * The remove control is shown rather than waited for on hover: it is the only
 * way back for a pointer, and a person who has just pasted the wrong picture
 * should not have to discover that hovering it does something.
 */
function Tile({
  label,
  tip,
  onRemove,
  children,
}: {
  /** What the remove control is called, for somebody who cannot see the tile. */
  label: string;
  /** What the tile cannot say at this size, where there is such a thing. */
  tip?: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const face = (
    <span className="block size-16 overflow-hidden rounded-(--radius-control) border border-separator">
      {children}
    </span>
  );

  return (
    <span className="relative block">
      {tip === undefined ? (
        face
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{face}</TooltipTrigger>
          <TooltipContent>{tip}</TooltipContent>
        </Tooltip>
      )}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className={cn(
          "absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full",
          "border border-separator bg-raised text-fg-tertiary",
          "hover:text-danger",
        )}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/**
 * The images on the clipboard, however this webview offers them.
 *
 * Two readings of one clipboard, because the two are not equivalent in every
 * engine: `files` is the straightforward one, and `items` is what a WebKit
 * build hands over for a screenshot taken with the system's own shortcut.
 * Reading only the first was a paste that worked in a browser during
 * development and did nothing in the application.
 *
 * The same picture appearing in both is one picture, so `files` wins where
 * there is anything in it at all.
 */
function picturesIn(clipboard: DataTransfer): File[] {
  const files = Array.from(clipboard.files).filter((file) =>
    file.type.startsWith("image/"),
  );
  if (files.length > 0) return files;

  return Array.from(clipboard.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/**
 * A file from the clipboard, as the bytes a prompt carries.
 *
 * `readAsDataURL` answers `data:<media>;base64,<bytes>` and only the bytes
 * travel: the media type is sent as its own field, and two answers to what a
 * picture is would be one too many.
 */
function asPasted(file: File): Promise<PastedContent> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That image could not be read."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve({
        // Every browser invents the same name for a clipboard image, so this is
        // a label rather than an identity — which is all the agent needs it for.
        name: file.name.trim() === "" ? "Pasted image" : file.name,
        mimeType: file.type,
        data: result.slice(result.indexOf(",") + 1),
      });
    };
    reader.readAsDataURL(file);
  });
}

/** The last part of a path, which is what a person calls the file. */
export function fileName(path: string): string {
  const at = path.lastIndexOf("/");
  return at === -1 ? path : path.slice(at + 1);
}
