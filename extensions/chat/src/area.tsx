"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  Button,
  EMPTY_TRANSCRIPT,
  Markdown,
  PanelFooter,
  PanelHeader,
  PanelPlaceholder,
  PanelSurface,
  ScrollArea,
  cn,
  conversationForRecord,
  conversationKeptAs,
  deleteSession,
  forgetRememberedConversation,
  explain,
  foldTranscript,
  modelOption,
  rememberedConversations,
  renameSession,
  resumeSession,
  sessionBacklog,
  showNativeContextMenu,
  startSession,
  stopSession,
  updateMemoryDocument,
  usageLines,
  withDropped,
  useCorpus,
  useDocument,
  useAgents,
  useAgentSession,
  useBadge,
  useLiveSessions,
  type Agent,
  type AgentSession,
  type OpenProject,
  type AreaIntent,
  type MemoryDocument,
  type MemoryRecord,
  type RememberedConversation,
  type SessionConfigOption,
  type SessionRow,
} from "@sync/extension-api";
import { ChevronDown, ChevronLeft, Play, Plus } from "lucide-react";

import { Composer, EMPTY_DRAFT, type Draft } from "./composer";
import { Conversation } from "./conversation";
import { CONVERSATION_KIND, asMarkdown, facts, suggestTitle } from "./keeping";
import { AgentPicker, ModelPicker } from "./pickers";

/**
 * Chat — talking to an agent, in this project.
 *
 * The product this is a section of is not a chat client, and this is not one.
 * There are no bubbles, no avatars and no coloured fills: a conversation is a
 * transcript, set like the rest of the window's documents, and who said what is
 * carried by a label and by weight — the half of the selection rule that
 * survives greyscale. What makes it a section rather than a page is the frame:
 * the conversations are a source list, one of them is the workspace, and what is
 * true *of* it — which agent, which model, whether it is still running and how
 * to stop it — is the inspector beside it.
 *
 * The extension holds no connection. A session lives in the application, so
 * switching to another section leaves the agents working and coming back finds
 * them where they were, with everything they said in between.
 */

/**
 * What the navigator has selected.
 *
 * Two things live in one list and they are not the same object: a **live**
 * conversation is a process this window is holding, and a **kept** one is a
 * record in the project's memory that outlived it. Distinguishing them in the
 * selection rather than by looking a key up in two places is what keeps the
 * workspace from having to guess which it is showing.
 */
type Chosen =
  | { readonly at: "live"; readonly key: string }
  /** A conversation from before this launch. The key is the agent's session id. */
  | { readonly at: "dormant"; readonly key: string }
  | { readonly at: "kept"; readonly key: string };

/**
 * A conversation in the navigator: one this run is holding, or one from before
 * it that the agent can be asked for back.
 *
 * They are the same thing at two moments and are listed together, so what
 * distinguishes them is a tag rather than a heading.
 */
type ConversationEntry =
  | { readonly at: "live"; readonly at_ms: number; readonly row: SessionRow }
  | {
      readonly at: "dormant";
      readonly at_ms: number;
      readonly held: RememberedConversation;
    };

interface ChatContext {
  readonly project: OpenProject;
  readonly agents: readonly Agent[];
  /** Whether the agent list is still being read from the application. */
  readonly agentsLoading: boolean;
  readonly running: readonly SessionRow[];
  /** The conversations somebody kept, as records. */
  readonly kept: readonly MemoryRecord[];
  readonly chosen: Chosen | null;
  /** The live conversation being read, or `null` when none is. */
  readonly key: string | null;
  readonly session: AgentSession;
  readonly row: SessionRow | null;
  readonly model: SessionConfigOption | null;
  readonly start: (agentId: string) => Promise<void>;
  readonly stop: (key: string) => Promise<void>;
  readonly forget: (key: string) => Promise<void>;
  /** Calls a conversation something. An empty name puts the derived one back. */
  readonly rename: (key: string, title: string) => Promise<void>;
  /** What is half-written in one conversation, and how to change it. */
  readonly draftFor: (key: string) => Draft;
  readonly writeDraft: (key: string, change: (held: Draft) => Draft) => void;
  /**
   * Writes a live conversation into the project's memory, under the name it
   * already has. Nothing is asked first: there is one type it can be written
   * as, and the name is corrected in the row like every other name here.
   */
  readonly keep: (key: string) => Promise<void>;
  /** Calls a kept conversation something else, in its own row. */
  readonly renameKept: (key: string, title: string) => Promise<void>;
  /** Takes a kept conversation out of the project's memory. */
  readonly forgetKept: (key: string) => Promise<void>;
  /** The keys of the conversations being written right now. */
  readonly keeping: ReadonlySet<string>;
  /**
   * Every conversation of this project, newest first, whether or not an agent
   * is attached to one right now.
   *
   * One list rather than two, because a conversation is one thing and whether
   * its agent is up is a state of it. Two lists made a conversation move
   * between them the moment it was continued, and for a moment it was in both.
   */
  readonly conversations: readonly ConversationEntry[];
  /** Raises the agent and asks for a dormant conversation back. */
  readonly resume: (acpSession: string) => Promise<void>;
  /**
   * Starts a fresh conversation from a kept record's transcript, for a record
   * this machine cannot resume natively — a colleague's, or one written on
   * another machine.
   */
  readonly continueFromRecord: (document: MemoryDocument) => Promise<void>;
  /** The session ids being resumed right now. */
  readonly resuming: ReadonlySet<string>;
  /** Stops offering a conversation this machine can no longer get back. */
  readonly forgetDormant: (acpSession: string) => Promise<void>;
  readonly open: (chosen: Chosen | null) => void;
  /** The kept record being read, for the workspace to draw with. */
  readonly document: ReturnType<typeof useDocument>;
  readonly closeKept: () => void;
  readonly starting: string | null;
  /** Why an agent would not start. Held apart from a refused write: the two
      are said in different places and would otherwise wear each other's
      headline. */
  readonly trouble: string | null;
  /** Why the store refused a write of a conversation, or `null`. */
  readonly refused: string | null;
}

const Context = createContext<ChatContext | null>(null);

function useChat(): ChatContext {
  const value = useContext(Context);
  if (value === null) {
    throw new Error("A Chat column was rendered outside the Chat area.");
  }
  return value;
}

export function ChatAreaProvider({
  project,
  active,
  intent,
  children,
}: {
  project: OpenProject;
  active: boolean;
  /** What the window is asking this area to show — a kept conversation, from search. */
  intent?: AreaIntent | null;
  children: ReactNode;
}) {
  const { agents, isLoading: agentsLoading } = useAgents();
  // Read from the application rather than held here, so that an area which was
  // unmounted while agents ran comes back to the list it left.
  //
  // **Watched while this section is frozen too, and only then when there is
  // something to watch.** A frozen area stops reading the store; it does not
  // stop existing, and the one thing it goes on saying is what its row shows —
  // an agent that answered while somebody was in another section is exactly the
  // news a badge is for, and nothing but this list would notice it. When the
  // last conversation ends there is nothing left to hear, and the reading stops
  // with it rather than running for the life of the window.
  const [watching, setWatching] = useState(false);
  const { sessions: running, reload } = useLiveSessions(active || watching);
  const [picked, setKey] = useState<Chosen | null>(null);
  // The last ask this area has stopped honouring. What an intent shows is
  // derived from it rather than copied into state — an area that copied an ask
  // would hold a second answer to "what is open".
  const [settled, setSettled] = useState<AreaIntent | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  // Which conversations are being written, so the control that writes one says
  // so rather than looking as if the click missed.
  const [keeping, setKeeping] = useState<ReadonlySet<string>>(() => new Set());
  const [resuming, setResuming] = useState<ReadonlySet<string>>(() => new Set());
  // The pointers this machine holds for this project. Re-read whenever the
  // running list moves, because the two together are what the navigator draws:
  // opening, keeping or ending a conversation all change which pointers are
  // still dormant.
  const [pointers, setPointers] = useState<readonly RememberedConversation[]>([]);
  // One half-written message per conversation. Here rather than in the composer
  // because the composer is one instance drawn for whichever conversation is
  // open: a draft it held itself would follow somebody to the next one.
  const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
  // Asked for its own kind only. What is wanted from the corpus here is the
  // project's type list and the ability to write one record; reading every
  // record of every kind to get them would be a page load for a menu.
  const corpus = useCorpus(project.path, { kind: CONVERSATION_KIND }, [], active);
  // A conversation this project did not open is not this project's to show.
  const mine = useMemo(
    () => running.filter((row) => row.cwd === project.path),
    [running, project.path],
  );

  // Read from the application whenever the running list moves. What comes back
  // is only what is *dormant*: the application filters out the pointers whose
  // sessions it is already running, because it is the only side that can — a
  // live row is keyed by this run's own key and a pointer by the agent's
  // session id, and the two are not comparable here.
  useEffect(() => {
    if (!active) return;
    let watching = true;
    void rememberedConversations(project.path)
      .then((held) => {
        if (watching) setPointers(held);
      })
      // Quiet: a machine that cannot read its own pointer file has lost the
      // ability to continue old conversations, not the ability to hold one.
      // The list still draws everything that is running.
      .catch(() => {
        if (watching) setPointers([]);
      });
    return () => {
      watching = false;
    };
  }, [project.path, active, running]);



  // One list, newest first. A live conversation is ordered by when it was
  // opened and a dormant one by when this machine last saw it, which are the
  // same question asked of the two states.
  const conversations = useMemo<readonly ConversationEntry[]>(() => {
    const rows: ConversationEntry[] = [
      ...mine.map((row) => ({ at: "live" as const, at_ms: row.openedAtMs, row })),
      ...pointers
        .filter((held) => held.cwd === project.path)
        .map((held) => ({ at: "dormant" as const, at_ms: held.lastSeenMs, held })),
    ];
    return rows.sort((left, right) => right.at_ms - left.at_ms);
  }, [mine, pointers, project.path]);

  // Search asking for a kept conversation outranks whatever was selected, until
  // somebody selects something else — which is what stops the ask being applied
  // again every render.
  const asking =
    intent && intent !== settled && intent.show === "record" ? intent : null;
  const chosen: Chosen | null = asking ? { at: "kept", key: asking.key } : picked;

  // What is selected is whatever is still running under that key. A session can
  // be stopped from somewhere else — another screen, the application closing —
  // and deriving the selection rather than correcting it in an effect means the
  // workspace can never be pointing at something that is gone. A kept
  // conversation is a record and cannot go anywhere.
  const row =
    chosen?.at === "live"
      ? (mine.find((candidate) => candidate.key === chosen.key) ?? null)
      : null;
  const key = row?.key ?? null;
  const session = useAgentSession(key);
  const document = useDocument(project.path, chosen?.at === "kept" ? chosen.key : null);

  // ------------------------------------------------------------------
  // What this section's row says while nobody is looking at it.
  // ------------------------------------------------------------------

  // Whether anything is still worth listening to. Derived from what the last
  // read said rather than from whether the section is open: a conversation
  // running when somebody leaves is one that can still answer.
  useEffect(() => {
    setWatching(mine.length > 0);
  }, [mine.length]);

  // A turn that ended is an agent that answered. It is the finest signal there
  // is without holding a transcript open for every conversation at once, and it
  // is the right one: what a person left was a question, and what they want to
  // know is that it has been answered.
  const before = useRef(new Map<string, SessionRow["status"]>());
  const [answered, setAnswered] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const was = before.current;
    const now = new Map(mine.map((candidate) => [candidate.key, candidate.status]));
    const arrived = [...now].filter(
      ([conversation, status]) =>
        was.get(conversation) === "working" && status !== "working",
    );
    before.current = now;
    if (arrived.length === 0) return;

    setAnswered((held) => {
      const next = new Set(held);
      for (const [conversation] of arrived) {
        // Not news if it is the conversation on screen in the section somebody
        // is looking at: they watched it arrive.
        if (active && conversation === key) continue;
        next.add(conversation);
      }
      return next.size === held.size ? held : next;
    });
  }, [mine, active, key]);

  // Opening one is reading it. Also drops a conversation that has ended and
  // gone from the list, so news never outlives what it was about.
  useEffect(() => {
    setAnswered((held) => {
      const next = new Set(
        [...held].filter(
          (conversation) =>
            conversation !== (active ? key : null) &&
            mine.some((candidate) => candidate.key === conversation),
        ),
      );
      return next.size === held.size ? held : next;
    });
  }, [active, key, mine]);

  // A dot rather than how many, and the difference is the point: how many
  // conversations there are is declared in the manifest and the host counts it,
  // so the row already carries a figure. Answering with a second figure would
  // put two different quantities in one place and leave nobody able to say
  // which. What is being said here is *something happened* — the one thing a
  // number cannot say and a dot says exactly.
  useBadge(answered.size > 0 ? "some" : null);

  // Opening anything is this person answering whatever was asked.
  const open = (next: Chosen | null) => {
    setSettled(intent ?? null);
    setKey(next);
  };

  const start = async (agentId: string) => {
    setStarting(agentId);
    setTrouble(null);
    try {
      const opened = await startSession({ agentId, cwd: project.path });
      open({ at: "live", key: opened.key });
    } catch (error) {
      setTrouble(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(null);
      reload();
    }
  };

  // Stopping keeps the conversation, deleting takes it away. Two commands
  // because they are two intentions: a process spending money is urgent to end,
  // and what it said may still be being read.
  const stop = async (target: string) => {
    await stopSession(target);
    reload();
  };

  // A name is not a key: nothing points at it and no record is written from it,
  // so this is the whole of renaming. The list is re-read afterwards for the
  // same reason it is re-read after starting one — the rows come from the
  // application, and the application is where the name now is.
  const rename = async (target: string, title: string) => {
    await renameSession(target, title);
    reload();
  };

  const forget = async (target: string) => {
    await deleteSession(target);
    if (chosen?.at === "live" && chosen.key === target) open(null);
    // The conversation is gone, so what was half-written in it is not a draft
    // any more — it is a message to nobody.
    setDrafts((held) => {
      const rest = { ...held };
      delete rest[target];
      return rest;
    });
    reload();
  };

  /**
   * Writes one conversation into the project's memory, and says so.
   *
   * Nothing is asked first. There is one type a conversation is written as, the
   * name is the one already on the row, and both of those were questions with a
   * single right answer — so the command does the thing instead of opening a
   * sheet to confirm it. What somebody may want to change afterwards, they
   * change where they would look for it: the kept row renames like a live one.
   *
   * The transcript is read for the key being kept rather than taken from the
   * conversation on screen. They are usually the same and were assumed to be,
   * which meant keeping a row from its own menu wrote whatever the *open*
   * conversation had said, under that row's name.
   */
  const keep = async (target: string) => {
    if (keeping.has(target)) return;
    setKeeping((held) => new Set(held).add(target));
    setRefused(null);
    try {
      const row = mine.find((candidate) => candidate.key === target) ?? null;
      const { events, dropped } = await sessionBacklog(target);
      const read = events.reduce(foldTranscript, EMPTY_TRANSCRIPT);
      const transcript = dropped === 0 ? read : withDropped(read, dropped);
      // Said rather than ignored. The control in the inspector is disabled on
      // an empty conversation, but the row's own menu is not — and a command
      // that quietly did nothing would read as one that failed.
      if (transcript.entries.length === 0) {
        setRefused("Nothing has been said in this conversation yet.");
        return;
      }

      const created = await corpus.createRecord(CONVERSATION_KIND);
      // Two writes because that is what the store offers: an empty record of
      // the type, then everything about it. The fields go here rather than into
      // the prose — which agent, in which directory, when — so the column that
      // says what is true of a record has something to say, and so anything
      // querying the corpus can read them without parsing a transcript.
      await updateMemoryDocument(project.path, created.key, {
        title: suggestTitle(row, transcript),
        content: asMarkdown(row, transcript),
        fields: facts(row, transcript),
      });
      // The record and the conversation are tied together on this machine, so
      // that continuing the record later can ask the agent for the session
      // rather than re-reading the transcript to it. The link is held with the
      // pointer and not in the record: a record travels with the repository,
      // and an agent's session id means nothing wherever it lands.
      //
      // Best effort. A conversation kept in the same run it was opened in may
      // have no pointer yet, and that is worth a slower resume rather than a
      // refused keep.
      await conversationKeptAs(target, created.key).catch(() => false);

      // The workspace is left alone. Keeping is something a person does *to* a
      // conversation, often one the agent is still working in, and a command
      // that answered by navigating away from it would take the conversation
      // off the screen as its reward. The new row appearing under "Memory" is
      // what says it worked.
      corpus.reload();
    } catch (failure) {
      // Said out loud. This used to be swallowed by the sheet, so a write the
      // store refused looked exactly like a click that missed — which is how a
      // schema fault went unnoticed for as long as it did.
      setRefused(explain(failure));
    } finally {
      setKeeping((held) => {
        const rest = new Set(held);
        rest.delete(target);
        return rest;
      });
    }
  };

  /**
   * Calls a kept conversation something else.
   *
   * A record's title, written the way the row above it writes a session's: in
   * the row, on Return, with Escape to abandon. That a live conversation is a
   * process and a kept one is a record is true and is not the person's problem
   * — they are looking at one list of conversations, and renaming works in it.
   */
  const renameKept = async (target: string, title: string) => {
    const named = title.trim();
    if (named === "") return;
    setRefused(null);
    try {
      await updateMemoryDocument(project.path, target, { title: named });
      corpus.reload();
    } catch (failure) {
      setRefused(explain(failure));
    }
  };

  /**
   * Raises the agent and asks for a dormant conversation back.
   *
   * What opens is a session with a new key and the same conversation in it: the
   * agent replays what was said, so the transcript arrives with it. The list is
   * re-read afterwards because the pointer has stopped being dormant.
   */
  const resume = async (acpSession: string) => {
    if (resuming.has(acpSession)) return;
    setResuming((held) => new Set(held).add(acpSession));
    setTrouble(null);
    try {
      const opened = await resumeSession(project.path, acpSession);
      open({ at: "live", key: opened.key });
      reload();
    } catch (failure) {
      // Said where a conversation that would not start is said, because that is
      // what this is. The reasons a resume fails are its own — the agent no
      // longer holds the session, the directory moved, the agent is not
      // installed here — and every one of them is the person's to see.
      setTrouble(explain(failure));
    } finally {
      setResuming((held) => {
        const rest = new Set(held);
        rest.delete(acpSession);
        return rest;
      });
    }
  };

  /**
   * Continues a kept conversation the only way a record alone allows: a new
   * session, with what was said put in front of it.
   *
   * The transcript is placed in the composer rather than sent. A record can run
   * to thousands of lines, and a command that quietly spent that on a turn
   * nobody had read would be spending somebody's money on their behalf — so
   * they see it, cut it to what matters, and add the thing they actually want
   * to ask. It is also the honest shape of what this is: the agent has not
   * remembered anything, it is being told.
   */
  const continueFromRecord = async (document: MemoryDocument) => {
    setRefused(null);
    const named = fieldText(document.fields.agent);
    // Matched on the name the record carries, which is the display name. It is
    // the only handle there is until the type also declares the agent's stable
    // id — see the open question on continuing a conversation.
    const agent =
      agents.find((candidate) => candidate.name === named && candidate.available) ??
      null;
    if (agent === null) {
      setRefused(
        named === undefined
          ? "This record does not say which agent held the conversation."
          : `${named} is not available on this machine, so this conversation cannot be continued here.`,
      );
      return;
    }

    try {
      const opened = await startSession({ agentId: agent.id, cwd: project.path });
      // Named after the record before anything is sent. A conversation is
      // otherwise named from the first words of the first message, and the
      // first message here is a transcript behind a sentence of ours — which
      // put "Below is a transcript of an earlier conversation, kept in" in the
      // list as the name of somebody's work.
      await renameSession(opened.key, document.title);
      setDrafts((held) => ({
        ...held,
        [opened.key]: {
          ...EMPTY_DRAFT,
          text: seedFrom(document.title, document.content),
        },
      }));
      open({ at: "live", key: opened.key });
      reload();
    } catch (failure) {
      setRefused(explain(failure));
    }
  };

  /**
   * Stops offering a conversation, without touching what the agent holds.
   *
   * The pointer can outlive the session it names — an agent prunes its own
   * history, and one it has dropped will not come back however often it is
   * asked. A row that can be neither continued nor removed is a dead end, and
   * this is the way out of it.
   */
  const forgetDormant = async (acpSession: string) => {
    setTrouble(null);
    try {
      await forgetRememberedConversation(project.path, acpSession);
      if (chosen?.at === "dormant" && chosen.key === acpSession) open(null);
      setPointers((held) =>
        held.filter((entry) => entry.acpSession !== acpSession),
      );
    } catch (failure) {
      setTrouble(explain(failure));
    }
  };

  const forgetKept = async (target: string) => {
    setRefused(null);
    try {
      await corpus.deleteRecords([target]);
      if (chosen?.at === "kept" && chosen.key === target) open(null);
    } catch (failure) {
      setRefused(explain(failure));
    }
  };

  return (
    <Context.Provider
      value={{
        project,
        agents,
        agentsLoading,
        running: mine,
        kept: corpus.records,
        chosen,
        key,
        session,
        row,
        model: modelOption(session.configuration),
        start,
        stop,
        forget,
        rename,
        draftFor: (target) => drafts[target] ?? EMPTY_DRAFT,
        writeDraft: (target, change) =>
          setDrafts((held) => ({
            ...held,
            [target]: change(held[target] ?? EMPTY_DRAFT),
          })),
        keep,
        renameKept,
        forgetKept,
        keeping,
        conversations,
        resume,
        resuming,
        forgetDormant,
        continueFromRecord,
        open,
        document,
        closeKept: () => {
          void document.write();
          open(null);
        },
        starting,
        trouble,
        refused,
      }}
    >
      {children}
    </Context.Provider>
  );
}

/**
 * How many rows a group shows before it says how many more there are.
 *
 * A source list is something a person picks out of at a glance. Past a screenful
 * it stops being one, and a project that has held a hundred conversations would
 * turn this column into a scroller nobody reads to the end of. The rest are one
 * click away and the count is stated, so nothing is hidden — it is deferred.
 */
const AT_FIRST = 15;

/** The conversations, and the control that starts another. */
export function ChatNavigator() {
  const chat = useChat();

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Chat" />

      <div className="min-h-0 flex-1">
        {chat.conversations.length === 0 && chat.kept.length === 0 ? (
          <div className="p-3 text-sm text-fg-tertiary">No conversations yet.</div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col p-2">
              {/* One group of conversations, whether or not an agent is
                  attached to one right now. They used to be two — "Running" and
                  "Not running" — which described this application's processes
                  rather than the person's work, and made a conversation jump
                  between groups the moment it was continued: it appeared in one
                  before it left the other, so for a moment there were two of it.
                  Whether an agent is up is a state of the row, and it belongs on
                  the row. */}
              {chat.conversations.length === 0 ? null : (
                <Group label="Conversations" count={chat.conversations.length}>
                  {(shown) =>
                    chat.conversations.slice(0, shown).map((entry) =>
                      entry.at === "live" ? (
                        <LiveRow key={entry.row.key} row={entry.row} />
                      ) : (
                        <DormantRow key={entry.held.acpSession} held={entry.held} />
                      ),
                    )
                  }
                </Group>
              )}
              {chat.kept.length === 0 ? null : (
                <Group label="Memory" count={chat.kept.length}>
                  {(shown) =>
                    chat.kept
                      .slice(0, shown)
                      .map((record) => <KeptRow key={record.key} record={record} />)
                  }
                </Group>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <PanelFooter>
        <AgentPicker
          agents={chat.agents}
          loading={chat.agentsLoading}
          starting={chat.starting}
          onChoose={(agentId) => void chat.start(agentId)}
          trigger={
            <Button variant="ghost" size="sm">
              <Plus />
              New conversation
            </Button>
          }
        />
      </PanelFooter>
    </PanelSurface>
  );
}

/**
 * One heading and the rows under it, collapsible, and capped until asked.
 *
 * The heading is the control: clicking it collapses the group, which is what a
 * source list on this system does with one. Neither the disclosure state nor
 * the cap is remembered anywhere — both are about this glance at this column,
 * not about the project, and layout state in this window is rebuilt on every
 * launch rather than stored.
 */
function Group({
  label,
  count,
  children,
}: {
  label: string;
  /** How many rows there are in total, which is not how many are drawn. */
  count: number;
  children: (shown: number) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [all, setAll] = useState(false);
  const shown = all ? count : Math.min(count, AT_FIRST);

  return (
    <section className="flex flex-col">
      <button
        type="button"
        onClick={() => setCollapsed((held) => !held)}
        className={cn(
          "flex items-center gap-1 rounded-(--radius-control) px-2 pt-2 pb-1 text-left",
          "text-xs font-medium text-fg-tertiary hover:text-fg-secondary",
          "transition-colors duration-(--motion-duration-fast) ease-shell",
        )}
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3 transition-transform duration-(--motion-duration-fast) ease-shell",
            collapsed && "-rotate-90",
          )}
        />
        <span>{label}</span>
        {/* The count is only worth stating when it is more than the eye can
            take in, which is the same threshold that decides whether any of
            them are held back. */}
        {count > AT_FIRST ? <span className="tabular-nums">({count})</span> : null}
      </button>
      {collapsed ? null : (
        <>
          <ul className="flex flex-col">{children(shown)}</ul>
          {shown < count ? (
            <button
              type="button"
              onClick={() => setAll(true)}
              className={cn(
                "rounded-(--radius-control) px-2 py-1.5 text-left text-xs text-fg-tertiary",
                "hover:bg-hover hover:text-fg-secondary",
                "transition-colors duration-(--motion-duration-fast) ease-shell",
              )}
            >
              Show {count - shown} more
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * A conversation from before this launch, and how it is picked up again.
 *
 * **Selecting it does not raise the agent.** That was the first version and it
 * was wrong twice over: a click in a source list selects, and raising an agent
 * costs a process, a wait and somebody's money — nothing that expensive happens
 * because a pointer landed on the wrong row. Opening it shows what it is and
 * offers to continue it, in the workspace, which is the one column that is
 * always there.
 *
 * No mark of its own. The list's rows carry a name and what is true of the
 * conversation, and the shell spends its visual language on typed content
 * rather than on furniture — a play glyph here would be a second vocabulary
 * saying what the second line already says.
 */
function DormantRow({ held }: { held: RememberedConversation }) {
  const chat = useChat();
  const selected =
    chat.chosen?.at === "dormant" && chat.chosen.key === held.acpSession;
  const busy = chat.resuming.has(held.acpSession);

  // One control, both lines of it, as in every other row of this list.
  return (
    <li>
      <button
        type="button"
        onClick={() => chat.open({ at: "dormant", key: held.acpSession })}
        onContextMenu={(event) =>
          // Both are in the workspace as well: a menu that opens under the
          // pointer is invisible to the keyboard, so nothing may be reachable
          // only from one.
          showNativeContextMenu(event, [
            {
              label: "Reopen",
              onSelect: () => void chat.resume(held.acpSession),
            },
            "separator",
            {
              label: "Remove from this list",
              onSelect: () => void chat.forgetDormant(held.acpSession),
            },
          ])
        }
        className={cn(
          "flex w-full min-w-0 flex-col gap-0.5 rounded-(--radius-control) px-2 py-1.5 text-left",
          "transition-colors duration-(--motion-duration-fast) ease-shell",
          selected ? "bg-selected" : "hover:bg-hover",
        )}
      >
        <span
          className={cn(
            "block min-w-0 truncate text-base text-fg",
            selected && "font-semibold",
          )}
        >
          {held.title ?? held.agentName}
        </span>
        <span className="flex min-w-0 items-baseline gap-1.5 text-xs text-fg-tertiary">
          {held.title === null ? null : (
            <>
              <span className="min-w-0 shrink truncate">{held.agentName}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          {/* "Closed", not "not running". A person here is holding a
              conversation, not supervising a process. */}
          <span>{busy ? "Reopening…" : "Closed"}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * A conversation somebody saved: a record, and it reads as one.
 *
 * It renames and it is deleted here, in the row, exactly as a live one does.
 * That one of them is a process and the other a record in the project's memory
 * is true and is this build's problem, not the reader's: they are looking at one
 * list of conversations, and a list where half the rows can be renamed and the
 * other half send you to another section is a list that has made its own
 * plumbing somebody else's business.
 */
function KeptRow({ record }: { record: MemoryRecord }) {
  const chat = useChat();
  const selected = chat.chosen?.at === "kept" && chat.chosen.key === record.key;
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    return (
      <li>
        <div className="flex w-full min-w-0 items-center rounded-(--radius-control) px-2 py-1.5">
          <RenameField
            name={record.title}
            placeholder="Conversation"
            onSettle={(name) => {
              setRenaming(false);
              void chat.renameKept(record.key, name);
            }}
            onAbandon={() => setRenaming(false)}
          />
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => chat.open({ at: "kept", key: record.key })}
        onContextMenu={(event) =>
          showNativeContextMenu(event, [
            { label: "Rename", onSelect: () => setRenaming(true) },
            "separator",
            {
              label: "Delete",
              onSelect: () => void chat.forgetKept(record.key),
            },
          ])
        }
        className={cn(
          "flex w-full min-w-0 items-center rounded-(--radius-control) px-2 py-1.5 text-left",
          "transition-colors duration-(--motion-duration-fast) ease-shell",
          selected ? "bg-selected" : "hover:bg-hover",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-base text-fg",
            selected && "font-semibold",
          )}
        >
          {record.title || "Untitled"}
        </span>
      </button>
    </li>
  );
}

function LiveRow({ row }: { row: SessionRow }) {
  const chat = useChat();
  const selected = row.key === chat.key;
  // Renaming is a state of this row and of no other, so it is held here. Two
  // rows cannot be in it at once, because leaving the field settles it.
  const [renaming, setRenaming] = useState(false);

  // Every conversation with one agent is otherwise called the same thing, which
  // is the whole reason a name exists — so the name leads, and the agent moves
  // down beside the state, where it is a fact about the row rather than its
  // identity. Before anything has been said there is no name and the agent is
  // the only honest answer, so it leads instead, alone.
  const named = row.title !== null;

  // The whole row is the control, both lines of it. It used to be the title
  // alone with the agent and the state sitting outside the button, so half of
  // what looks like one row did nothing when clicked — and it is the lower half,
  // which is where a pointer lands when somebody is aiming at a row rather than
  // at a word.
  return (
    <li>
      {renaming ? (
        <div className="flex w-full min-w-0 flex-col gap-0.5 rounded-(--radius-control) px-2 py-1.5">
          <RenameField
            name={row.title ?? ""}
            placeholder={row.agentName}
            onSettle={(name) => {
              setRenaming(false);
              void chat.rename(row.key, name);
            }}
            onAbandon={() => setRenaming(false)}
          />
          {/* The second line stays while the field is open, so nothing under
              the pointer moves as somebody starts typing. */}
          <span className="flex min-w-0 items-baseline gap-1.5 text-xs text-fg-tertiary">
            {named ? (
              <>
                <span className="min-w-0 shrink truncate">{row.agentName}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <StatusLine status={row.status} />
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => chat.open({ at: "live", key: row.key })}
          onContextMenu={(event) =>
            // Nothing is reachable only from here: adding to Memory is in the
            // conversation's own header, stopping is in the composer, and
            // renaming happens in this row.
            showNativeContextMenu(event, [
              {
                label: "Rename",
                onSelect: () => setRenaming(true),
              },
              {
                label: "Add to Memory",
                onSelect: () => void chat.keep(row.key),
              },
              "separator",
              {
                label: "Stop agent",
                onSelect: () => void chat.stop(row.key),
              },
              "separator",
              {
                label: "Delete conversation",
                onSelect: () => void chat.forget(row.key),
              },
            ])
          }
          className={cn(
            "flex w-full min-w-0 flex-col gap-0.5 rounded-(--radius-control) px-2 py-1.5 text-left",
            "transition-colors duration-(--motion-duration-fast) ease-shell",
            // Selection is a surface shift and a weight change, and nothing else.
            selected ? "bg-selected" : "hover:bg-hover",
          )}
        >
          <span
            className={cn(
              "block min-w-0 truncate text-base text-fg",
              selected && "font-semibold",
            )}
          >
            {row.title ?? row.agentName}
          </span>
          <span className="flex min-w-0 items-baseline gap-1.5 text-xs text-fg-tertiary">
            {named ? (
              <>
                <span className="min-w-0 shrink truncate">{row.agentName}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <StatusLine status={row.status} />
          </span>
        </button>
      )}
    </li>
  );
}

function RenameField({
  name,
  placeholder,
  onSettle,
  onAbandon,
}: {
  name: string;
  placeholder: string;
  onSettle: (name: string) => void;
  onAbandon: () => void;
}) {
  const [text, setText] = useState(name);
  // Escape and blur both fire, in that order, and the second must not undo the
  // first by settling what the first abandoned. A ref rather than state,
  // because both of them happen before anything re-renders.
  const done = useRef(false);

  const settle = () => {
    if (done.current) return;
    done.current = true;
    onSettle(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      settle();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      done.current = true;
      onAbandon();
    }
  };

  return (
    <input
      // The row was just asked to be renamed; the field is what the command
      // opened, so it is where the caret belongs.
      autoFocus
      aria-label="Name of this conversation"
      value={text}
      placeholder={placeholder}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={settle}
      onFocus={(event) => event.currentTarget.select()}
      className={cn(
        "h-(--control-height-sm) w-full min-w-0 rounded-(--radius-control)",
        "border border-separator bg-raised px-1.5 text-base text-fg",
        "placeholder:text-fg-tertiary",
      )}
    />
  );
}

/**
 * Where a session is, as a word.
 *
 * Deliberately a word rather than a dot. Colour is reserved for status and this
 * *is* status, but a coloured dot alone fails the greyscale test the rest of the
 * window passes — so the word carries it and the weight marks the two states
 * that mean something is waiting on a person.
 */
function StatusLine({ status }: { status: SessionRow["status"] }) {
  const said = {
    starting: "Starting",
    ready: "Ready",
    working: "Working",
    asking: "Waiting for you",
    ended: "Ended",
    failed: "Failed",
  }[status];

  return (
    <span
      className={cn(
        "text-xs text-fg-tertiary",
        status === "asking" && "font-semibold text-fg-secondary",
        status === "failed" && "text-danger",
      )}
    >
      {said}
    </span>
  );
}

/**
 * A conversation this application is not holding, and the two things that can
 * be done with it.
 *
 * Continuing raises the agent and asks for the session back; the agent replays
 * what was said, so the transcript arrives with it. Removing it says only that
 * this machine has stopped offering the conversation — nothing of the agent's
 * is touched — and it exists because a pointer outlives what it points at: an
 * agent prunes its own history, and a row that can be neither continued nor
 * removed is a dead end.
 */
function DormantConversation({ acpSession }: { acpSession: string }) {
  const chat = useChat();
  const held = chat.conversations.find(
    (entry) => entry.at === "dormant" && entry.held.acpSession === acpSession,
  );
  const busy = chat.resuming.has(acpSession);
  const name =
    held?.at === "dormant" ? (held.held.title ?? held.held.agentName) : "Conversation";

  return (
    <section className="flex h-full min-w-0 flex-col">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator px-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">{name}</h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
        {/* The shell's placeholder states what the column is holding and takes
            no control of its own, so the commands sit beneath it rather than
            inside it. Changing the shared component to carry one would give
            every empty column in the window a slot for a button. */}
        <PanelPlaceholder
          headline={
            chat.trouble === null ? "This conversation is closed" : "It could not be reopened"
          }
          detail={
            chat.trouble ??
            "The words are with the agent rather than here. Reopening raises it again and asks for them back."
          }
        />
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => void chat.resume(acpSession)}>
            {busy ? "Reopening…" : "Reopen"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void chat.forgetDormant(acpSession)}
          >
            Remove from this list
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ChatWorkspace() {
  const chat = useChat();

  // A kept conversation is drawn here, by this extension, and not handed to the
  // record editor. The type belongs to Chat, so what one *is* is Chat's answer:
  // a transcript is a thing that happened, read from the top, and the editor
  // would offer to rewrite what somebody said — which is the one thing a record
  // of a conversation must not invite. It is not reconstructed as a live chat
  // either: the process is gone, and a composer under it would be a fiction.
  if (chat.chosen?.at === "kept") {
    return <KeptConversation />;
  }

  // A conversation from before this launch. There is nothing to draw — Sync
  // holds no transcript of one and deliberately keeps none — so the workspace
  // says what it is and offers the two things that can be done with it.
  //
  // Here rather than in the inspector, and that is the whole reason it moved:
  // the inspector collapses, and below a certain window width it cannot be
  // opened at all. A command reachable only from a column that can go away is a
  // command that goes away with it. The workspace is the one column that is
  // always present.
  if (chat.chosen?.at === "dormant") {
    return <DormantConversation acpSession={chat.chosen.key} />;
  }

  if (chat.key === null) {
    return (
      <section className="flex h-full min-w-0 flex-col">
        <div className="flex h-(--panel-header-height) shrink-0 items-center border-b border-separator px-3">
          <h2 className="min-w-0 truncate text-sm font-semibold text-fg">Chat</h2>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <PanelPlaceholder
            headline={chat.trouble === null ? "No conversation open" : "That agent did not start"}
            detail={
              chat.trouble ??
              "Start one from the foot of the list. The agent runs in this project's folder, and keeps running while you are somewhere else."
            }
          />
        </div>
      </section>
    );
  }

  const open = chat.key;

  return (
    <section className="flex h-full min-w-0 flex-col">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator px-3">
        {/* The header names what is being shown, which is this conversation —
            and what a conversation is called is its name once it has one. Which
            agent is running it is in the column beside this, where what is true
            *of* it belongs. */}
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">
          {chat.row?.title ?? chat.row?.agentName ?? "Conversation"}
        </h2>
        {/* "Add to Memory", not "Keep" and not "Save".
            
            Save is taken: in this window saving is not a button at all — a
            record writes itself, and the header band says `Saving…` and
            `Saved`. A second, manual Save meaning something else entirely
            would be the same word for two mechanisms. Archive is taken too:
            it is a record's own reversible flag.
            
            What the command does is put the conversation somewhere — the
            project's memory, the same store Records reads — so it names the
            place it goes to. The group in the list is called after that place
            for the same reason.
            
            It is here, beside the conversation's name, because it is a command
            on this conversation. Stopping used to be here and has moved into
            the composer, where it takes the place of sending. */}
        <Button
          size="sm"
          variant="ghost"
          disabled={chat.keeping.has(open) || chat.session.transcript.entries.length === 0}
          onClick={() => void chat.keep(open)}
        >
          {chat.keeping.has(open) ? "Adding…" : "Add to Memory"}
        </Button>
      </div>

      <Conversation session={chat.session} sessionKey={open} />
      <Composer
        session={chat.session}
        projectPath={chat.project.path}
        agentName={chat.row?.agentName ?? "This agent"}
        // Not yet answered while the session is being raised — it arrives with
        // `initialize`, a moment later — and taken as yes until it is, because
        // refusing a paste then would be refusing it for a reason that is not
        // true yet. If the answer turns out to be no, the send is refused with
        // the agent's own name and the message is handed straight back.
        acceptsImages={
          chat.row === null || chat.row.status === "starting" || chat.row.acceptsImages
        }
        draft={chat.draftFor(open)}
        onDraft={(change) => chat.writeDraft(open, change)}
      />
    </section>
  );
}

/**
 * What is true of a conversation somebody kept, and the one command it takes.
 *
 * The facts come from the record's own fields — the ones `chat.conversation`
 * declares — rather than from a panel built for records in general. A kept
 * conversation cannot be archived here, tagged here or given a scope here, and
 * that is not an omission: those are things a person does to a claim about the
 * code, in Records, and a transcript is not one.
 */
function KeptInspector() {
  const chat = useChat();
  const document = chat.document.document;

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Conversation" />
      {document === null ? (
        <div className="p-3 text-sm text-fg-tertiary">Reading the record…</div>
      ) : (
        <>
          <ScrollArea className="min-h-0 flex-1">
            {/* The padding and the scroller belong to whoever places the panel,
                which is here. */}
            <div className="flex flex-col gap-4 p-3">
              <Field label="Agent" value={fieldText(document.fields.agent) ?? "—"} />
              <Field
                label="Held in"
                value={
                  <span className="break-all">
                    {fieldText(document.fields.workdir) ?? "—"}
                  </span>
                }
              />
              {fieldText(document.fields.model) === undefined ? null : (
                <Field label="Model" value={fieldText(document.fields.model)} />
              )}
              {fieldText(document.fields.opened) === undefined ? null : (
                <Field
                  label="Opened"
                  value={new Date(String(document.fields.opened)).toLocaleString()}
                />
              )}
              {typeof document.fields.tokens === "number" ? (
                <Field
                  label="Tokens"
                  value={document.fields.tokens.toLocaleString()}
                />
              ) : null}
              {/* Only when it is false. "This is the whole conversation" is what
                  a transcript already claims by being one; that it is *not* is
                  the thing nobody would guess. */}
              {document.fields.complete === false ? (
                <p className="text-xs text-warning">
                  This record begins part way through. The earlier events had
                  already been dropped when it was written.
                </p>
              ) : null}
            </div>
          </ScrollArea>

          {/* Said here too: this column is beside the one the command is in,
              and a refusal belongs next to what was asked for. */}
          {chat.refused === null ? null : (
            <p className="border-t border-separator px-3 py-2 text-xs text-warning">
              {chat.refused}
            </p>
          )}
        </>
      )}
    </PanelSurface>
  );
}

/**
 * Continuing a kept conversation, by whichever of the two routes is open.
 *
 * **Native**, when this machine still holds a pointer to the agent's own
 * session: the agent is raised and replays the conversation, so it comes back
 * with everything it knew — the files it read, the commands it ran.
 *
 * **From the transcript**, when it does not: a record travels with the
 * repository, so one written by a colleague or on another machine has nothing
 * here to resume. That is the ordinary case rather than a fault, and it is why
 * the control says which of the two it is about to do before it does it. The
 * difference is not cosmetic — after the first the agent remembers reading
 * those files, and after the second it has only been told about them.
 */
function ContinueKept({ document }: { document: MemoryDocument }) {
  const chat = useChat();
  const [held, setHeld] = useState<RememberedConversation | null | undefined>(undefined);
  const recordKey = document.key;

  // Asked of the application rather than worked out here: whether a
  // conversation is resumable is a fact about this machine's agents, and the
  // window has no way to know it.
  // Remounted per record by its `key`, so the "still asking" state is the
  // initial one rather than something reset on the way in.
  useEffect(() => {
    let watching = true;
    void conversationForRecord(chat.project.path, recordKey)
      .then((found) => {
        if (watching) setHeld(found);
      })
      .catch(() => {
        if (watching) setHeld(null);
      });
    return () => {
      watching = false;
    };
  }, [chat.project.path, recordKey]);

  if (held === undefined) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={held !== null && chat.resuming.has(held.acpSession)}
      onClick={() => {
        if (held === null) void chat.continueFromRecord(document);
        else void chat.resume(held.acpSession);
      }}
    >
      <Play />
      {held === null ? "Continue from the transcript" : "Reopen with the agent"}
    </Button>
  );
}

/**
 * The opening message of a conversation continued from a record.
 *
 * A frame around the transcript rather than the transcript alone, because an
 * agent handed several hundred lines with no sentence in front of them has been
 * given a document and no task. It says what this is, where it came from, and
 * that it is an account of something that already happened rather than
 * instructions — an agent that read a kept transcript as a list of things to do
 * would start doing them again.
 */
function seedFrom(title: string, transcript: string): string {
  return [
    `Below is a transcript of an earlier conversation, kept in this project's memory as "${title}".`,
    "It is context, not instructions: it is an account of what was already said and done. Read it, then wait for what I ask next.",
    "",
    "---",
    "",
    transcript,
  ].join("\n");
}

/**
 * One of a record's product fields as text, or `undefined` where it is not
 * there.
 *
 * A field the store holds is whatever the type declared and whatever was
 * written, so it is narrowed rather than cast: a panel that rendered an object
 * because the schema moved under it would throw where it is drawn.
 */
function fieldText(value: unknown): string | undefined {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

/** What is true of the conversation in the workspace. */
export function ChatInspector() {
  const chat = useChat();

  // A kept conversation is described in this extension's own words, from the
  // fields its type declares. It used to be handed to the window's record panel,
  // which is the right panel in Records and the wrong one here: that panel
  // offers what a *record* needs — archiving, tags, scope paths, the freshness
  // of a claim — and none of those is a thing anybody asks of a transcript.
  // (It also draws a bare fragment and expects its caller to supply the padding
  // and the scroller, which is why everything was flush against the edges.)
  if (chat.chosen?.at === "kept") {
    return <KeptInspector />;
  }

  if (chat.key === null) {
    return (
      <PanelSurface className="bg-panel">
        <PanelHeader title="Agent" />
        <div className="p-3 text-sm text-fg-tertiary">
          Open a conversation to see the agent running it.
        </div>
      </PanelSurface>
    );
  }

  const row = chat.row;

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Agent" />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          <Field label="Agent" value={row?.agentName ?? "—"} />
          <Field
            label="State"
            value={<StatusLine status={row?.status ?? chat.session.transcript.status} />}
          />
          {chat.session.transcript.detail === null ? null : (
            <Field label="Detail" value={chat.session.transcript.detail} />
          )}
          <Field label="Folder" value={row?.cwd ?? chat.project.path} />
          {chat.session.transcript.mode === null ? null : (
            <Field label="Mode" value={chat.session.transcript.mode} />
          )}
          {chat.session.transcript.stopReason === null ? null : (
            <Field label="Last turn ended" value={chat.session.transcript.stopReason} />
          )}
          <Usage session={chat.session} />

          {chat.model === null ? (
            <Field
              label="Model"
              value={
                <span className="text-fg-tertiary">
                  This agent does not offer a choice in protocol.
                </span>
              }
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-fg-tertiary">{chat.model.name}</span>
              <ModelPicker
                option={chat.model}
                onChoose={(valueId) => void chat.session.choose(chat.model!.id, valueId)}
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* A refusal is said beside the control that caused it. The placeholder
          in the workspace only ever draws when nothing is open, so a keep the
          store turned down while a conversation was on screen would have been
          said in the one place nobody could be looking. */}
      {chat.refused === null ? null : (
        <p className="border-t border-separator px-3 py-2 text-xs text-warning">
          {chat.refused}
        </p>
      )}

      {/* No commands. Both that were here have gone to where the conversation
          is rather than to where it is described: keeping is in the header
          beside its name, and stopping is in the composer in place of sending.
          This column says what is true of the conversation and does nothing to
          it, which is what an inspector is. Ending a session outright is still
          on the row's own context menu, next to renaming and deleting. */}
    </PanelSurface>
  );
}

/**
 * What the turn cost, when the agent said.
 *
 * Only the figures it reported. Two of the measured agents report none at all,
 * and a row of zeros would be a claim about spending that nobody made.
 */
function Usage({ session }: { session: AgentSession }) {
  const rows = usageLines(session.transcript.usage);
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-fg-tertiary">Tokens</span>
      <dl className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-sm text-fg-secondary">{row.label}</dt>
            <dd className="font-mono text-sm text-fg tabular-nums">
              {row.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A conversation that was kept, read as the transcript it is. */
function KeptConversation() {
  const chat = useChat();
  const document = chat.document.document;

  return (
    <section className="flex h-full min-w-0 flex-col">
      <div className="flex h-(--panel-header-height) shrink-0 items-center gap-2 border-b border-separator px-3">
        <Button variant="ghost" size="sm" onClick={chat.closeKept}>
          <ChevronLeft />
          Chat
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
          {document?.title || "Conversation"}
        </h2>
        {/* In the workspace rather than the inspector, because the inspector
            collapses and below a certain window width cannot be opened at all:
            a command only reachable there is one that disappears with it. */}
        {document === null ? null : <ContinueKept key={document.key} document={document} />}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="prose-surface mx-auto w-full max-w-(--prose-measure) px-6 py-5">
          {document === null ? (
            <p className="text-sm text-fg-tertiary">Reading the record…</p>
          ) : (
            /* The shell's own reading view, so a kept conversation and a record
               read anywhere else in this window are one document. */
            <Markdown>{document.content ?? ""}</Markdown>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-fg-tertiary">{label}</span>
      <span className="min-w-0 break-words text-sm text-fg">{value}</span>
    </div>
  );
}
