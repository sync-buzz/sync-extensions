"use client";

import {
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
  type AgentSession,
  type PastedContent,
} from "@sync-buzz/extension-api";
import { ArrowUp, FileText, Paperclip, Square, X } from "lucide-react";

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
  readonly text: string;
  readonly attached: readonly string[];
  readonly pasted: readonly PastedContent[];
}

/** A conversation nobody has started writing in. */
export const EMPTY_DRAFT: Draft = { text: "", attached: [], pasted: [] };

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
  const field = useRef<HTMLTextAreaElement>(null);

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
      await session.prompt(sent.text, sent.attached, sent.pasted);
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
  useLayoutEffect(() => {
    const node = field.current;
    if (node === null) return;
    node.style.height = "auto";
    const border = node.offsetHeight - node.clientHeight;
    node.style.height = `${node.scrollHeight + border}px`;
  }, [text]);

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
      <div className="mx-auto flex w-full max-w-(--prose-measure) flex-col gap-1.5">
        {refused === null ? null : (
          <p className="text-xs text-fg-tertiary">{refused}</p>
        )}

        <div className="flex w-full items-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void attach()}
                disabled={closed}
                aria-label="Attach files"
              >
                <Paperclip />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach files</TooltipContent>
          </Tooltip>

          {/* One surface holds the message and everything going with it. The
              focus ring is drawn here rather than on the field, because the
              well is what a person is writing in — a ring around the text alone
              would cut the shelf above it out of the thing being focused. */}
          <div
            className={cn(
              "min-w-0 flex-1 rounded-(--radius-control)",
              "border border-separator bg-raised",
              "has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-1",
              "has-[textarea:focus-visible]:outline-focus",
            )}
          >
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
                write(() => ({ text: said }));
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
