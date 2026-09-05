"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  adoptWorktree,
  conversationKeptAs,
  deleteSession,
  discardWorktree,
  forgetRememberedConversation,
  explain,
  foldTranscript,
  modelOption,
  rememberedConversations,
  renameSession,
  resumeSession,
  sessionBacklog,
  SourceTree,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  startSession,
  stopSession,
  updateMemoryDocument,
  usageLines,
  withDropped,
  useCorpus,
  useDocument,
  useAgents,
  useAgentSession,
  useAppMenu,
  useBadge,
  useLiveSessions,
  worktreesIn,
  type Agent,
  type AgentSession,
  type OpenProject,
  type AreaIntent,
  type MemoryRecord,
  type RememberedConversation,
  type SessionConfigOption,
  type SessionConfigValue,
  type SessionRow,
  type Worktree,
  type WorktreeChoice,
  useOpenRecord,
} from "@sync-buzz/extension-api";
import { ChevronLeft, Plus } from "lucide-react";

import { Composer, EMPTY_DRAFT, type Draft } from "./composer";
import {
  ConversationSheet,
  ROOT,
  WORDS,
  activeIdOf,
  holdersIn,
  openRows,
  opened,
  treeRows,
  type Acting,
  type Asking,
} from "./navigator";
import { Conversation } from "./conversation";
import { type Handed } from "./addressing";
import { bucketed, calledIn, type ConversationEntry } from "./list";
import { CONVERSATION_KIND, asMarkdown, facts, suggestTitle } from "./keeping";

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
  /** Raises one, answering with its key, or `null` when it would not start. */
  readonly start: (agentId: string) => Promise<string | null>;
  /** Every command this project's packages offer, for the list a `/` opens. */
  /**
   * Opens a conversation, with no question asked first.
   *
   * `null` for {@link ChatContext.preferredAgent} is the one case this cannot
   * do — a machine with no agent installed at all — and the command that calls
   * it is disabled rather than made to explain itself in a menu nobody opened.
   */
  readonly begin: () => Promise<void>;
  /**
   * The agent a new conversation opens with: the one this project was last held
   * with, and failing that the first this machine can raise.
   *
   * Read from the list rather than remembered anywhere, because the list is
   * already the answer and already survives a restart. A preference file for it
   * would be a second place to keep a fact this window can see, and it would be
   * wrong the first time somebody used a different agent from another screen.
   *
   * `null` on a machine that can raise nothing.
   */
  readonly preferredAgent: string | null;
  /**
   * Replaces the agent of a conversation nothing has been said in.
   *
   * Only ever reached before the first word — the strip stops offering the
   * choice after it — so there is nothing to carry over and nothing to lose.
   * What is half-written *is* carried, because it is the person's sentence and
   * it is about to be sent to whoever they have just chosen instead.
   */
  readonly switchAgent: (key: string, agentId: string) => Promise<void>;
  /**
   * Moves an unstarted conversation to another working tree, the way
   * {@link ChatContext.switchAgent} moves it to another agent — and for the
   * same reason it has to: where the work happens reaches the agent when the
   * session opens, so changing it is raising another session, not editing this
   * one. `null` is the project's own tree.
   */
  readonly switchWorktree: (key: string, choice: WorktreeChoice | null) => Promise<void>;
  /** Every working tree this project has, for the choice before the first word. */
  readonly worktrees: readonly Worktree[];
  /**
   * The conversation in each tree, by the tree's path.
   *
   * What a menu needs to say which tree is which — two made from `main` this
   * afternoon are otherwise identical — and what tells it which trees nothing
   * is in, those being the only ones it offers to throw away.
   */
  readonly worktreeHolders: ReadonlyMap<string, string>;
  /**
   * Whether this project can have trees at all.
   *
   * One read answers both this and the list: the host refuses to list them for
   * a folder that is not a repository or has nothing committed, and a refusal
   * is the answer rather than an error to show.
   */
  readonly worktreesOffered: boolean;
  /** Keeps the work done in a tree, under the branch name somebody chose. */
  readonly adopt: (path: string, branch: string) => Promise<void>;
  /** Throws a tree away, and the commits in it with it. */
  readonly discard: (path: string) => Promise<void>;
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
  /** Takes a kept conversation out of the project's memory. */
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
  /**
   * Hands a message to another conversation of this family, raising one under
   * that name where none is going.
   *
   * Not a second way of sending: what is handed over is said there and not
   * here, so one sentence stays one conversation's.
   */
  readonly hand: (handed: Handed, body: string) => Promise<void>;
  /** Whether a name already names a conversation of the open one's family. */
  readonly standing: (name: string) => boolean;
  /** Raises the agent and asks for a dormant conversation back. */
  readonly resume: (acpSession: string) => Promise<void>;
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
  // The project's working trees, and whether it can have any.
  //
  // `null` is *not asked yet*, which is neither of the two answers: a strip
  // drawn before the read came back would offer a choice and then take it away,
  // or hide one that was there all along.
  const [trees, setTrees] = useState<readonly Worktree[] | null>(null);
  const [offered, setOffered] = useState(true);
  const [resuming, setResuming] = useState<ReadonlySet<string>>(() => new Set());
  // The conversation this person opened and has not spoken in yet, or `null`.
  //
  // Held here because nothing else can answer it. A session that has been
  // raised and not prompted writes no pointer and is otherwise an ordinary row,
  // and the host does not say on the row whether anything was said — so what is
  // remembered is the narrower and sufficient fact: which key *this column*
  // opened for somebody who had not typed yet. A conversation an extension
  // ordered is never one, which is the whole reason it is remembered rather
  // than derived from an empty transcript.
  const [draft, setDraft] = useState<string | null>(null);
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
  // **By the project, not by the directory.** A conversation held in a working
  // tree runs in that tree, so `cwd` is the tree and matching on it dropped the
  // conversation out of this list the moment it was made — the column emptied
  // and there was nothing left to choose from.
  const mine = useMemo(
    () => running.filter((row) => row.project === project.path),
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

  /**
   * Which conversation is in which tree, by the tree's path.
   *
   * Both halves of the list, because a dormant conversation is in its tree as
   * much as a running one: resuming it lands in those files, and a tree thrown
   * away underneath it takes the pointer's answer with it.
   *
   * A tree no conversation names is the case this exists for. It is the tree
   * left behind when somebody moved a conversation elsewhere or deleted it, and
   * without a name against it the menu could neither say what was in it nor
   * safely offer to throw it away.
   */
  const worktreeHolders = useMemo(() => {
    const held = new Map<string, string>();
    for (const entry of conversations) {
      const tree = entry.at === "live" ? entry.row.worktree : entry.held.worktree;
      if (tree === undefined) continue;
      const name =
        entry.at === "live"
          ? (entry.row.title ?? entry.row.agentName)
          : (entry.held.title ?? entry.held.agentName);
      // Newest first, and the first one wins: two conversations may share a
      // tree, and the one somebody is most likely to mean is the recent one.
      if (!held.has(tree.path)) held.set(tree.path, name);
    }
    return held;
  }, [conversations]);

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

  // A draft stops being one the moment anything is said in it. That is the
  // whole rule, and the absence of the other half is deliberate: a draft is
  // *not* forgotten because its key has left the running list.
  //
  // It would read as the tidier version and it is a race. The list is polled,
  // and the moment after one is opened it does not hold it yet — so a draft
  // would be forgotten by the first render after it was made, every time.
  // Nothing is bought by the branch either: a key pointing at a conversation
  // that has ended is only ever used to end it again, which fails and is
  // caught. Keys are minted and never reused, so it can never name another.
  useEffect(() => {
    if (draft === null || key !== draft) return;
    if (session.transcript.entries.length > 0) setDraft(null);
  }, [draft, key, session.transcript.entries.length]);

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

  /**
   * Reads the project's working trees.
   *
   * A refusal is an answer and not a fault to report: the host declines to list
   * trees for a folder that is not a repository or has nothing committed, which
   * is the same as saying this project cannot have them. Either way the read is
   * over, and an empty list with the choice withdrawn is what the strip draws.
   */
  const readTrees = useCallback(async () => {
    try {
      setTrees(await worktreesIn(project.path));
    } catch {
      setTrees(null);
      setOffered(false);
    }
  }, [project.path]);

  useEffect(() => {
    void readTrees();
  }, [readTrees]);

  // Opening anything is this person answering whatever was asked.
  const open = (next: Chosen | null) => {
    setSettled(intent ?? null);
    setKey(next);
  };

  // A conversation raised to be handed a piece of work, and the work itself.
  // Two steps rather than one because the host has no way to say the first
  // thing to a session except through the hook below: raising answers with a
  // key, and the turn is sent once this window is holding that session.
  const [handing, setHanding] = useState<{ key: string; text: string } | null>(null);
  const handed = useAgentSession(handing?.key ?? null);
  useEffect(() => {
    if (handing === null || handed.key !== handing.key) return;
    const said = handing.text;
    // Cleared before the turn rather than after it. This effect runs again on
    // everything the session reports back, and a turn sent from it twice is two
    // turns — the one failure that cannot be taken back.
    setHanding(null);
    void handed.prompt(said).catch(() => {});
  }, [handing, handed]);

  /**
   * Hand one piece of work to a second agent, in a conversation of its own.
   *
   * **The same agent, the same tree, and the parent's own place in the list.**
   * None of it is asked for: a person writing a block is saying what to do, not
   * who should do it or where, and every one of these answers is already true
   * of the conversation they are writing in.
   *
   * **A child delegates a sibling, not a grandchild.** A chain is two
   * conversations deep, so a conversation that was itself delegated hands its
   * work to the one *it* came out of — which the queue then runs one at a time,
   * under the same parent. Passing its own id instead would be refused, and the
   * refusal would be right: what somebody wanted was the work done, not a
   * lecture about depth.
   */
  const delegate = async (body: string, called?: Handed): Promise<string> => {
    if (row === null) {
      throw new Error("There is no conversation here to delegate from.");
    }
    if (body.trim() === "") {
      throw new Error(`There is nothing to send to @${called?.to ?? "that conversation"}.`);
    }
    const root = row.parent ?? row.acpSession ?? null;

    // **A name already in this family is that conversation, not a second one.**
    // Saying the same name twice is how somebody carries on with work they
    // started, and it is the whole of continuing: there is no second gesture to
    // learn and nothing to pick from a list.
    const standing =
      called === undefined || root === null
        ? undefined
        : calledIn(conversations, root, called.to);
    if (standing !== undefined) {
      // Naming an agent for a conversation that has one is not *switch*: which
      // agent holds a conversation is fixed when it opens, so this is two
      // instructions that cannot both be followed and it is said rather than
      // silently half-obeyed.
      const holding = standing.at === "live" ? standing.row.agentId : standing.held.agentId;
      if (called?.with !== undefined && called.with !== holding) {
        throw new Error(
          `\`${called.to}\` is already being held by ${holding}, and which agent holds a conversation is fixed when it opens. Leave the agent off to go on with it, or hand this to a name nobody is using.`,
        );
      }
      const key = standing.at === "live" ? standing.row.key : standing.held.acpSession;
      setHanding({ key, text: body });
      reload();
      return `Handed to ${called?.to}, which was already going. Whatever it says last comes back here as a message of its own, once this conversation is free.`;
    }

    const opened = await startSession({
      // Named, it is the tool somebody asked for; unnamed, it is the one
      // already in the room — a person saying what to do has not been asked who
      // should do it, and the conversation they are writing in has answered.
      agentId: called?.with ?? row.agentId,
      cwd: project.path,
      worktree: row.worktree === undefined ? null : { path: row.worktree.path },
      parent: root,
    });
    // The name is what makes it findable again, and it is set before the work
    // is sent: a conversation that took a turn under no name could not be
    // carried on with, and the second `@test` would open a third one.
    if (called !== undefined) {
      await renameSession(opened.key, called.to).catch(() => {});
    }
    setHanding({ key: opened.key, text: body });
    reload();
    const under = called === undefined ? "in a conversation of its own" : `to ${called.to}`;
    return `Delegated to ${opened.agentName}, ${under}. Whatever it says last comes back here as a message of its own, once this conversation is free; there is nothing to wait for.`;
  };


  /**
   * One message, addressed to a conversation rather than to whoever is here.
   *
   * The sentence `delegate` answers with is dropped on purpose. It was written
   * for a block that showed its own answer underneath it, and there is no such
   * block now: what says the work went somewhere is the row appearing in the
   * column, which is where somebody looking for it is already looking.
   */
  const hand = async (handed: Handed, body: string): Promise<void> => {
    await delegate(body, handed);
  };

  /**
   * Whether a name is one this family already answers to.
   *
   * The same question `delegate` asks before opening anything, asked early so
   * the field can say which of the two is about to happen. One function would
   * be better than two callers agreeing; they agree because both go through
   * `calledIn`, which is where the rule about case and family lives.
   */
  const standing = (name: string): boolean => {
    const root = row === null ? null : (row.parent ?? row.acpSession ?? null);
    return root !== null && calledIn(conversations, root, name) !== undefined;
  };

  const start = async (agentId: string): Promise<string | null> => {
    setStarting(agentId);
    setTrouble(null);
    try {
      const opened = await startSession({ agentId, cwd: project.path });
      open({ at: "live", key: opened.key });
      return opened.key;
    } catch (error) {
      setTrouble(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setStarting(null);
      reload();
    }
  };

  /**
   * The other agent, for a conversation that has not begun.
   *
   * The new one is raised *before* the old one is deleted, and that order is
   * the whole of it: a raise that fails leaves the person where they were, with
   * the agent they had and the sentence they were writing, rather than with
   * nothing. Only once there is somewhere to move to does the empty session go.
   */
  // The newest conversation's agent, whichever half of the list it came from,
  // and the first raisable one before there is a list. The catalogue's order is
  // the registry's; nothing here reorders it, because a preference this build
  // invented would be a preference nobody stated.
  // Every command the project's packages declare, rebuilt only when the
  // declaration moves — which is when somebody installs or removes something.

  const preferredAgent =
    conversations[0] === undefined
      ? (agents.find((agent) => agent.available)?.id ?? null)
      : conversations[0].at === "live"
        ? conversations[0].row.agentId
        : conversations[0].held.agentId;

  /**
   * Opens one, and leaves the choosing to the strip beside the field.
   *
   * A conversation raised and not spoken in writes no pointer — the host is
   * explicit about that — so an abandoned one costs a row in this list and
   * nothing on disk. What it does cost is a process, which is why only one of
   * them is allowed to be waiting at a time: pressing this three times used to
   * leave three agents running for three sentences nobody wrote.
   */
  const begin = async () => {
    if (preferredAgent === null) return;
    const abandoned = draft;
    const opened = await start(preferredAgent);
    if (opened === null) return;
    setDraft(opened);
    if (abandoned !== null && abandoned !== opened) {
      // Best effort and after the new one is up, for the same reason switching
      // agents deletes in that order: what a person asked for is the new
      // conversation, and tidying is not allowed to cost them one.
      await deleteSession(abandoned).catch(() => {});
      reload();
    }
  };

  /**
   * The same conversation, in another tree.
   *
   * Written as `switchAgent` is, and for a reason that is not style: the tree
   * reaches the agent in `session/new`, so this raises a new session and ends
   * the old one. The new one comes up before the old one goes, so a tree that
   * cannot be made leaves the person where they were.
   *
   * What is left behind is a tree, when the one being moved out of was made a
   * moment ago and nothing was said in it. It is not removed here: this column
   * cannot tell a tree it caused from one somebody made yesterday and chose,
   * and throwing away the second would be deleting work on a guess. It stays in
   * the menu, and *Discard working tree* is how it goes.
   */
  const switchWorktree = async (target: string, choice: WorktreeChoice | null) => {
    const replacing = mine.find((candidate) => candidate.key === target);
    const held = replacing?.worktree?.path ?? null;
    const wanted = choice === null ? null : choice === "new" ? "new" : choice.path;
    if (wanted === held || (wanted === null && held === null)) return;

    setStarting(replacing?.agentId ?? null);
    setTrouble(null);
    try {
      const opened = await startSession({
        agentId: replacing?.agentId ?? preferredAgent ?? "",
        cwd: project.path,
        about: replacing?.about ?? null,
        worktree: choice,
      });
      // Everything that travels when the agent changes travels here too: the
      // sentence, the marker that says nothing has been said yet, and what the
      // conversation is about.
      setDrafts((drafts) => {
        const carried = drafts[target];
        if (carried === undefined) return drafts;
        const rest = { ...drafts, [opened.key]: carried };
        delete rest[target];
        return rest;
      });
      open({ at: "live", key: opened.key });
      setDraft((current) => (current === target ? opened.key : current));
      await deleteSession(target).catch(() => {});
      await readTrees();
    } catch (error) {
      setTrouble(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(null);
      reload();
    }
  };

  /** Keeps what was done in a tree, under the name this person chose for it. */
  const adopt = async (path: string, branch: string) => {
    setTrouble(null);
    try {
      await adoptWorktree({ project: project.path, path, branch });
    } catch (error) {
      setTrouble(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Throws a tree away.
   *
   * The commits in it go too unless somebody kept them first, which is why the
   * row asks before calling this rather than after.
   */
  const discard = async (path: string) => {
    setTrouble(null);
    try {
      await discardWorktree({ project: project.path, path });
      await readTrees();
    } catch (error) {
      setTrouble(error instanceof Error ? error.message : String(error));
    }
  };

  const switchAgent = async (target: string, agentId: string) => {
    const replacing = mine.find((candidate) => candidate.key === target);
    if (agentId === replacing?.agentId) return;
    setStarting(agentId);
    setTrouble(null);
    try {
      // What the conversation is about moves with it, like the sentence below.
      // Switching agents raises a new session and ends the old one, so a
      // conversation handed over from a task would come back under no record at
      // all — a row changing group because somebody changed their mind about
      // which agent should read it, which is the one thing this split promises
      // cannot happen.
      const opened = await startSession({
        agentId,
        cwd: project.path,
        about: replacing?.about ?? null,
      });
      // The sentence moves with the person. It was written to be sent, and
      // which process ends up reading it is not something they had said yet.
      setDrafts((held) => {
        const carried = held[target];
        if (carried === undefined) return held;
        const rest = { ...held, [opened.key]: carried };
        delete rest[target];
        return rest;
      });
      open({ at: "live", key: opened.key });
      // The marker moves with the conversation. Switching agents is only ever
      // reached before the first word, so what is replaced is a draft and what
      // replaces it is one too — and a marker left pointing at the old key
      // would let the next `begin` believe there was no draft waiting.
      setDraft((held) => (held === target ? opened.key : held));
      await deleteSession(target).catch(() => {
        // The old session outliving this is a stray row in the list, which is
        // something a person can end themselves. Refusing the switch over it
        // would be the larger failure by a wide margin.
      });
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


  // The menu bar is the application's, and this area is what can write
  // something while it is selected. `⌘N` opens a conversation, which is the
  // command this section exists for and the one thing in it a keyboard had no
  // way of reaching: the `+` is in a column that collapses, and below a certain
  // window width cannot be opened at all.
  //
  // No `⇧⌘N`. That command names a *type*, and Chat has one type it did not
  // invent and nobody adds another — so it keeps its place in the menu and is
  // disabled, which is what this window does with a command that has nothing to
  // act on rather than removing the item and teaching nobody where it lives.
  useAppMenu(
    {
      selected:
        preferredAgent === null
          ? null
          : { kind: CONVERSATION_KIND, title: "Conversation" },
      // The kind is ignored: there is one thing this section makes, the menu
      // named it a moment ago, and asking again would be asking about the
      // answer already on screen.
      createRecord: () => void begin(),
      createType: null,
      table: null,
    },
    active,
  );

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
        begin,
        preferredAgent,
        switchAgent,
        switchWorktree,
        worktrees: trees ?? [],
        worktreeHolders,
        // Withdrawn while the read is out as well as after a refusal: a choice
        // that appeared a second late is one somebody has already decided
        // without.
        worktreesOffered: offered && trees !== null,
        adopt,
        discard,
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
        keeping,
        conversations,
        hand,
        standing,
        resume,
        resuming,
        forgetDormant,
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
/** The conversations, and the control that starts another. */
export function ChatNavigator() {
  const chat = useChat();
  const openRecord = useOpenRecord();
  // Which rows somebody shut, by the id the tree calls them. Remembered
  // nowhere: this is about this glance at this column, and layout state in
  // this window is rebuilt at every launch rather than stored.
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  // What a row stopped to ask. One at a time, because a sheet is one at a time.
  const [asking, setAsking] = useState<Asking | null>(null);

  const acting = useMemo<Acting>(
    () => ({
      open: (id) => {
        const at = opened(id);
        if (at !== null) chat.open(at);
      },
      openRecord,
      resume: (session) => void chat.resume(session),
      forgetDormant: (session) => void chat.forgetDormant(session),
      keep: (key) => void chat.keep(key),
      stop: (key) => void chat.stop(key),
      forget: (key) => void chat.forget(key),
      ask: setAsking,
      // The tree as it stands now rather than as it stood when the session
      // opened: the row's own copy has the commit it started from for ever,
      // and whether there is work in it is what both tree gestures turn on.
      treeOf: (row) =>
        row.worktree === undefined
          ? null
          : (chat.worktrees.find((candidate) => candidate.path === row.worktree?.path) ??
            row.worktree),
    }),
    [chat, openRecord],
  );

  const rows = useMemo(
    () => treeRows(bucketed(chat.conversations), acting),
    [chat.conversations, acting],
  );
  const expanded = useMemo(() => openRows(rows, closed), [rows, closed]);

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Chat" />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {/* Whether an agent is attached right now is *not* what splits these.
              There were two groups once — "Running" and "Not running" — which
              described this application's processes rather than the person's
              work, and made a conversation jump between groups the moment it
              was continued. What a conversation is about, and where it is about
              nothing, who ordered it, are set when it opens and never edited,
              so a row cannot change group. */}
          <SourceTree
            label="Conversations"
            items={rows}
            rootId={ROOT}
            activeId={activeIdOf(chat.conversations, chat.chosen)}
            expanded={expanded}
            onExpandedChange={(next: readonly string[]) => {
              const open = new Set(next);
              setClosed(new Set(holdersIn(rows).filter((id) => !open.has(id))));
            }}
            onSelect={acting.open}
          />

          {chat.conversations.length === 0 ? (
            <div className="px-2 pt-1">
              <PanelPlaceholder headline="No conversations yet" />
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <ConversationSheet
        asking={asking}
        onClose={() => setAsking(null)}
        settling={{
          rename: (key, title) => void chat.rename(key, title),
          adopt: (path, branch) => void chat.adopt(path, branch),
          discard: (path) => void chat.discard(path),
          forget: (key) => void chat.forget(key),
        }}
      />

      <PanelFooter>
        {/* A command, not a menu. Choosing an agent used to stand between
            wanting to say something and being able to: five rows, opened every
            time, answering a question most people answer the same way every
            day. The conversation now opens with the agent this project was last
            held with, and changing it is a pop-up in the composer.

            One `+`, acting on the list it sits beneath, which is what this band
            is for — and drawn as the column beside this one draws its own. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New conversation"
              disabled={chat.starting !== null || chat.preferredAgent === null}
              onClick={() => void chat.begin()}
              className="text-fg-tertiary hover:text-fg"
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New conversation</TooltipContent>
        </Tooltip>
      </PanelFooter>
    </PanelSurface>
  );
}

/**
 * A conversation's state, in words.
 *
 * The column says it with a glyph, because a column is read down; the inspector
 * says it with the word, because it is read across. One table behind both, so
 * the two can never drift into naming the same state differently.
 */
function StatusLine({ status }: { status: SessionRow["status"] }) {
  return <span>{WORDS[status]}</span>;
}

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
        {/* The command is here as well as in the bottom bar, and this is the
            copy that matters: the navigator collapses, and below a certain
            window width cannot be opened at all, so a placeholder whose only
            instruction was "start one from the foot of the list" was pointing
            at a column that can go away. The same argument moved Reopen and
            Continue into this column already.

            Beneath the placeholder rather than inside it, because the shell's
            placeholder takes no control of its own — giving it one would give
            every empty column in the window a slot for a button. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
          <PanelPlaceholder
            headline={chat.trouble === null ? "No conversation open" : "That agent did not start"}
            detail={
              chat.trouble ??
              // Three answers, and the third is why this is not two. While the
              // catalogue is still being read this window does not know what
              // the machine has — and "nothing is installed" is a claim, not a
              // way of saying so. Saying it and taking it back a moment later
              // is worse than the sentence that is true either way.
              (chat.agentsLoading
                ? "The agent runs in this project's folder, and keeps running while you are somewhere else."
                : chat.preferredAgent === null
                  ? "No agent this window can run is installed on this machine. Settings ▸ Agents lists every one Sync knows."
                  : "The agent runs in this project's folder, and keeps running while you are somewhere else.")
            }
          />
          {/* Present and disabled while the catalogue is being read, rather
              than absent: a control that appears a moment after the column did
              is one nobody saw arrive. */}
          {!chat.agentsLoading && chat.preferredAgent === null ? null : (
            <Button
              size="sm"
              disabled={chat.starting !== null || chat.preferredAgent === null}
              onClick={() => void chat.begin()}
            >
              New conversation
            </Button>
          )}
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
      {/* Two fields, one draft: an ordinary message, or a document written in
          the language that runs. Which one is on screen is the field's own
          business — everything either of them needs is here. */}
      <Composer
        session={chat.session}
        projectPath={chat.project.path}
        agentName={chat.row?.agentName ?? "This agent"}
        settings={{
          agents: chat.agents,
          agentsLoading: chat.agentsLoading,
          agentId: chat.row?.agentId ?? "",
          agentName: chat.row?.agentName ?? "Agent",
          starting: chat.starting !== null,
          // The agent is fixed by the first thing said and by nothing else.
          // Not by the session existing: a conversation raised and not spoken
          // in is not yet held by anything a person would mind replacing, and
          // it is exactly the moment somebody realises they wanted the other
          // agent.
          settled: chat.session.transcript.entries.length > 0,
          onAgent: (agentId) => void chat.switchAgent(open, agentId),
          model: chat.model,
          worktrees: chat.worktrees,
          worktree: chat.row?.worktree ?? null,
          worktreesHeldBy: chat.worktreeHolders,
          worktreesOffered: chat.worktreesOffered,
          onWorktree: (choice) => void chat.switchWorktree(open, choice),
          // Asked in the menu before it gets here, and only ever about a tree
          // no conversation is in — the menu is the one place that knows both.
          onDiscardWorktree: (path) => void chat.discard(path),
        }}
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
        onHand={chat.hand}
        standing={chat.standing}
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
 * One of a record's product fields as text, or `undefined` where it is not
 * there.
 *
 * A field the store holds is whatever the type declared and whatever was
 * written, so it is narrowed rather than cast: a panel that rendered an object
 * because the schema moved under it would throw where it is drawn.
 */
/**
 * The model's name as the agent stated it, or `undefined` where it stated none.
 *
 * The *value* rather than the option's own name: an option is called "Model"
 * and its current value is called "Sonnet 4.5", and a panel that printed the
 * former would answer "Model" under the word `Model`. That is what this column
 * said before the picker beneath it was moved away and stopped covering for it.
 */
function modelName(option: SessionConfigOption | null): string | undefined {
  if (option === null) return undefined;
  const values = (option.options ?? []).flatMap((entry) =>
    "options" in entry ? entry.options : [entry as SessionConfigValue],
  );
  return (
    values.find((value) => value.value === option.currentValue)?.name ??
    option.currentValue ??
    undefined
  );
}

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
            <Field
              label="Mode"
              value={
                chat.session.modes.find(
                  (mode) => mode.id === chat.session.transcript.mode,
                )?.name ?? chat.session.transcript.mode
              }
            />
          )}
          {chat.session.transcript.stopReason === null ? null : (
            <Field label="Last turn ended" value={chat.session.transcript.stopReason} />
          )}
          <Usage session={chat.session} />

          {/* Stated, not chosen. The picker that used to be here has gone to
              the composer, where the choice is made in the moment it matters —
              and its leaving is what puts this column back inside its own rule,
              stated at the foot of this file and broken by the one control that
              was still here. What a person reads here is the same fact the
              strip shows, in the column whose job is facts. */}
          <Field
            label="Model"
            value={
              modelName(chat.model) ?? (
                <span className="text-fg-tertiary">
                  This agent does not offer a choice in protocol.
                </span>
              )
            }
          />
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
