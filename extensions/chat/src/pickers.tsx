"use client";

import { useState, type ReactNode } from "react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type Agent,
  type SessionConfigOption,
  type SessionConfigValue,
  type SessionMode,
  type Worktree,
  type WorktreeChoice,
} from "@sync-buzz/extension-api";
import { ChevronDown, Trash2 } from "lucide-react";

/**
 * The three choices a person makes about a conversation, drawn the one way
 * macOS draws a choice between mutually exclusive states: a **pop-up button**.
 *
 * Not a pull-down, which the guidelines reserve for a list of commands. Which
 * agent, which model and which mode are each a flat set of states that change
 * what happens to the person's content, which is the pop-up button's own
 * definition — and the button shows the current one, which is the other half of
 * it.
 *
 * # Saying what a button chooses before it is opened
 *
 * The guidelines ask for a way to predict a pop-up button's options without
 * opening it, and offer two: an introductory label, or a button label that
 * describes the effect. Neither survives here as written — three labels in a
 * band this narrow would leave no room for the values they introduce, and a
 * value *is* the label on a pop-up button. So the third carrier this window
 * already uses does it: a tooltip, exactly as the `+` in the workspace header
 * says which kind it writes, with the same word repeated as the menu's own
 * heading when it opens.
 *
 * That word is the whole of the label, and it is why `Plan` alone is legible
 * here: on its own it is a word, and under a pointer it is a mode.
 */

/** One pop-up button, at the size and tone the composer's strip is set in. */
function Popup({
  /** What this button chooses, said under the pointer and again in the menu. */
  of,
  /** The current selection, which is what a pop-up button shows. */
  shown,
  disabled,
  /**
   * Told when the menu opens and closes, for a menu holding a question of its
   * own: a question left standing would be what somebody sees when they open
   * the button next, having asked for the list.
   */
  onOpenChange,
  children,
}: {
  of: string;
  shown: string;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <Button
              variant="ghost"
              size="xs"
              className="max-w-44 text-fg-secondary"
              aria-label={`${of}: ${shown}`}
            >
              <span className="min-w-0 truncate">{shown}</span>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{of}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>{of}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * What a conversation is being held with.
 *
 * **Only the agents this machine can raise.** Every row used to be listed,
 * including the ones that are not installed, on the argument that "Codex is not
 * installed" is an answer a person can act on and an absence is not. That is
 * still true, and it is still said — but once, under the list, rather than four
 * times inside the list somebody opened to pick one of the two that work.
 *
 * The filter is here and not in the catalogue the host answers with, which goes
 * on listing every agent. It has to: an extension ordering work names an agent
 * without consulting this column, and the settings window lists the ones that
 * are missing in order to offer connecting them. What is narrowed is this menu,
 * which is the only place the noise was.
 *
 * A choice, and then a fact. An agent is a process, and a conversation that has
 * been spoken in is being held by one — so once anything has been said the
 * button is not a button. It says which agent, in the same place, at the same
 * height, without the chevron: a disabled pop-up would promise that the choice
 * comes back, and it never does.
 */
export function AgentPicker({
  agents,
  loading,
  currentId,
  currentName,
  starting,
  settled,
  onChoose,
}: {
  agents: readonly Agent[];
  /** Whether the two reads behind {@link agents} are still out. */
  loading: boolean;
  /** The id of the agent this conversation is with, which is what is chosen. */
  currentId: string;
  /**
   * What that agent is called, which is what is shown.
   *
   * Taken from the conversation rather than looked up here: a session names its
   * own agent, and the catalogue may not have answered yet — a button that read
   * the id until a read came back would say `claude` for a moment and then
   * `Claude Code`, under the pointer, for no reason a person could see.
   */
  currentName: string;
  starting: boolean;
  /** Whether anything has been said, which is what fixes the agent. */
  settled: boolean;
  onChoose: (agentId: string) => void;
}) {
  if (settled) {
    // Set as the buttons beside it are, so the strip is one line rather than a
    // line with a gap in it. The padding matches a `size="xs"` button's, which
    // is what keeps the words in the same place they were a moment ago.
    return (
      <span className="max-w-44 truncate px-2 text-xs text-fg-tertiary">
        {currentName}
      </span>
    );
  }

  const raisable = agents.filter((agent) => agent.available);

  return (
    <Popup of="Agent" shown={currentName} disabled={starting}>
      {loading ? (
        // The one punctuation this shell allows: an action in progress. An
        // empty menu is a claim that this machine can raise nothing, which is a
        // different answer from not knowing yet.
        <div className="px-2 py-1.5 text-sm text-fg-tertiary">Looking for agents…</div>
      ) : null}
      <DropdownMenuRadioGroup
        value={currentId}
        onValueChange={(value) => onChoose(value)}
      >
        {raisable.map((agent) => (
          <DropdownMenuRadioItem key={agent.id} value={agent.id}>
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="text-sm">{agent.name}</span>
              <Note agent={agent} />
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      {loading || agents.length === raisable.length ? null : (
        <>
          <DropdownMenuSeparator />
          {/* Explanatory text under the list, which is what the guidelines
              offer for exactly this — a pop-up button whose options are the
              useful ones and whose full set lives elsewhere. Text and not an
              item: nothing here can open the settings window, and a row that
              looked like a command and did nothing would be worse than the four
              refusals this replaced.

              It says the count and it names the place. Reaching it is the
              gesture this system already has for reaching it. */}
          <p className="px-2 py-1.5 text-xs text-fg-tertiary">
            {agents.length - raisable.length === 1
              ? "One more agent is not installed on this machine."
              : `${agents.length - raisable.length} more agents are not installed on this machine.`}{" "}
            Settings ▸ Agents lists every one.
          </p>
        </>
      )}
    </Popup>
  );
}

/**
 * The one line under an agent's name.
 *
 * Whichever fact is most worth knowing before choosing it, and only when there
 * is one. Nothing is said about an agent not being installed any more, because
 * one that is not installed is no longer in this list.
 */
function Note({ agent }: { agent: Agent }) {
  if (agent.adapterReady === false) {
    return (
      <span className="text-xs text-fg-tertiary">
        Downloads its adapter on first use
      </span>
    );
  }
  if (!agent.verified) {
    return <span className="text-xs text-fg-tertiary">Not proven end to end</span>;
  }
  return null;
}

/**
 * Where the conversation works.
 *
 * The project's own working tree, or one made to be thrown away: an agent in a
 * disposable tree edits files nobody else has open, and the whole of it can be
 * undone in the morning with one command. What it does **not** buy is safety —
 * an agent has a shell wherever it runs — so nothing here says protected, and
 * the menu is about where the work lands rather than about what it may reach.
 *
 * Every entry is a state and not a command, which is what keeps this a pop-up
 * button like the three beside it. *New working tree* included: it is not an
 * action performed on the spot but an answer to *where should this work* — the
 * tree is made when the conversation moves into it, the same way choosing
 * another agent raises one.
 *
 * # Throwing one away, without a row that deletes
 *
 * A tree whose conversation is gone is reachable from nowhere else, and the
 * disk fills with copies of a repository nobody can name. So it goes from here
 * — but not as an entry. A row that deleted would be a command dressed as a
 * state, one keystroke from the tree somebody meant to choose. It is a mark at
 * the end of the row instead, and pressing it replaces the whole list with the
 * question: while that stands there is no row under the pointer to hit by
 * accident, and the answer says what discarding costs before it is given.
 *
 * A choice, and then a fact, exactly as the agent is. The directory reaches the
 * agent when the session opens and it reads files from there, so once anything
 * has been said this is where the work *is*: the button becomes a word, without
 * a chevron promising a choice that cannot come back.
 */
export function WorktreePicker({
  trees,
  /** The tree this conversation is in, or `null` for the project's own. */
  current,
  /**
   * What is in each tree, by its path: the name of the conversation held there.
   *
   * A tree nothing names is one whose conversation is gone — the case the list
   * used to have no answer for, and the only case this menu throws anything
   * away in.
   */
  heldBy,
  starting,
  settled,
  onChoose,
  onDiscard,
}: {
  trees: readonly Worktree[];
  current: Worktree | null;
  heldBy: ReadonlyMap<string, string>;
  starting: boolean;
  /** Whether anything has been said, which is what fixes where the work is. */
  settled: boolean;
  onChoose: (choice: WorktreeChoice | null) => void;
  onDiscard: (path: string) => void;
}) {
  const shown = current === null ? "Project" : worktreeName(current);
  // The tree this menu is asking about, when it is asking. One at a time,
  // because the question replaces the list: while it stands there is nothing to
  // mis-click, which is the whole reason a deletion is not a row here.
  const [asking, setAsking] = useState<Worktree | null>(null);

  if (settled) {
    // Said only where it is not the ordinary answer. Every conversation in this
    // window is in the project unless somebody moved it, and a row of them each
    // repeating "Project" would spend a line on the absence of news.
    if (current === null) return null;
    return (
      <span className="max-w-44 truncate px-2 text-xs text-fg-tertiary">{shown}</span>
    );
  }

  return (
    <Popup
      of="Working tree"
      shown={shown}
      disabled={starting}
      onOpenChange={(open) => {
        if (!open) setAsking(null);
      }}
    >
      {asking !== null ? (
        <div className="flex flex-col gap-1 px-2 py-1.5">
          <span className="text-xs text-fg-secondary">
            Throw {worktreeName(asking)} away?{" "}
            {asking.head === asking.baseCommit
              ? "Nothing was committed in it."
              : "The commits in it go too."}
          </span>
          <span className="flex gap-1">
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                onDiscard(asking.path);
                setAsking(null);
              }}
            >
              Discard
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setAsking(null)}>
              Cancel
            </Button>
          </span>
        </div>
      ) : (
        <DropdownMenuRadioGroup
          value={current?.path ?? PROJECT}
          onValueChange={(value) => {
            if (value === PROJECT) onChoose(null);
            else if (value === NEW) onChoose("new");
            else onChoose({ path: value });
          }}
        >
          <DropdownMenuRadioItem value={PROJECT}>
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="text-sm">Project</span>
              <span className="text-xs text-fg-tertiary">
                The files you have open
              </span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={NEW}>
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="text-sm">New working tree</span>
              <span className="text-xs text-fg-tertiary">
                A copy at the last commit, to keep or throw away
              </span>
            </span>
          </DropdownMenuRadioItem>
          {trees.length === 0 ? null : <DropdownMenuSeparator />}
          {trees.map((tree) => {
            const holder = heldBy.get(tree.path) ?? null;
            // Thrown away from here only when nothing is in it. A tree with a
            // conversation in it is that conversation's to end — from its own
            // row, where what is being ended is one thing and not two — and the
            // one this menu is pointed at is where the work is about to happen.
            const loose = holder === null && tree.path !== current?.path;
            return (
              <DropdownMenuRadioItem
                key={tree.path}
                value={tree.path}
                className={cn(loose && "pr-14")}
              >
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="text-sm">{worktreeName(tree)}</span>
                  <span className="text-xs text-fg-tertiary">
                    <Says tree={tree} holder={holder} />
                  </span>
                </span>
                {loose ? (
                  <button
                    type="button"
                    aria-label={`Throw ${worktreeName(tree)} away`}
                    // Every one of the three, and none is spare. A menu item
                    // is chosen on the pointer coming *up* rather than on the
                    // click — that is how a menu opened by a held button works
                    // — so stopping the click alone would ask the question and
                    // choose the tree it was asked about.
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setAsking(tree);
                    }}
                    className={cn(
                      "absolute right-7 flex items-center justify-center rounded-(--radius-control)",
                      "p-1 text-fg-tertiary hover:text-danger",
                      "transition-colors duration-(--motion-duration-fast) ease-shell",
                    )}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      )}
      {trees.length === 0 || asking !== null ? null : (
        <>
          <DropdownMenuSeparator />
          <p className="px-2 py-1.5 text-xs text-fg-tertiary">
            A conversation discards the tree it is in from its own row. Settings ▸
            Working trees lists every one on this machine.
          </p>
        </>
      )}
    </Popup>
  );
}

/**
 * The one fact worth knowing about a tree before choosing it.
 *
 * Which conversation is in it, when one is: two trees made from `main` this
 * afternoon differ in nothing else a person can act on, and *who is already
 * working here* is what makes the second one a place to carry on rather than a
 * place to collide. Where nobody is, what it holds is the next most useful
 * thing, because it is what discarding would cost.
 */
function Says({ tree, holder }: { tree: Worktree; holder: string | null }) {
  const from = tree.base === undefined ? null : `From ${tree.base}`;
  const state =
    holder !== null
      ? `in ${holder}`
      : tree.head === tree.baseCommit
        ? "nothing done in it yet"
        : "holds work, nobody in it";
  return <>{from === null ? state : `${from} · ${state}`}</>;
}

/**
 * What a tree is called: the name it was made under, which is its directory.
 *
 * Not the branch it came from. Two trees made from `main` an hour apart are
 * both "main", and a menu offering them twice is a menu that cannot be used —
 * the whole reason a tree is given words of its own when it is made. The branch
 * is still worth saying and is said underneath, where it is a fact about the
 * tree rather than its name.
 *
 * A tree somebody made themselves is called whatever they called its directory,
 * which is the right answer for the same reason: it is the word they will
 * recognise.
 */
export function worktreeName(tree: Worktree): string {
  const name = tree.path.split("/").filter(Boolean).at(-1);
  return name ?? tree.base ?? tree.baseCommit.slice(0, 7);
}

/**
 * The two answers that are not a tree.
 *
 * A radio group compares strings, and a tree is identified by its path — so
 * these two have to be strings no path can be. A leading space is the cheapest
 * thing that is true of neither: git will not hand back a path with one, and
 * neither will the host, which answers canonically.
 */
const PROJECT = " project";
const NEW = " new";

/**
 * Choosing a model.
 *
 * Drawn from what the session said it offers, never from a table in this build.
 * The agents that answer with a model option are the ones that get a picker;
 * where an agent offers none there is no button at all, because a pop-up button
 * with nothing behind it is a promise this build cannot keep.
 */
export function ModelPicker({
  option,
  onChoose,
}: {
  option: SessionConfigOption;
  onChoose: (valueId: string) => void;
}) {
  const values = flatten(option);
  const current = values.find((value) => value.value === option.currentValue);

  return (
    <Popup of="Model" shown={current?.name ?? option.currentValue ?? "—"}>
      <DropdownMenuRadioGroup
        value={option.currentValue ?? ""}
        onValueChange={(value) => onChoose(value)}
      >
        {values.map((value) => (
          <DropdownMenuRadioItem key={value.value} value={value.value}>
            {value.name}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </Popup>
  );
}

/**
 * How much the agent may do without asking.
 *
 * The choice a person changes most often — Plan to read before it writes,
 * Accept Edits to stop being asked about every file — and until this build there
 * was nowhere in the window to make it. The agents were stating these all along,
 * in the same answer the model options arrive in.
 *
 * Each mode's own sentence is under its name, because "Accept Edits" and "Plan"
 * are names for policies rather than descriptions of them, and choosing between
 * policies from four words is how somebody ends up in the wrong one.
 */
export function ModePicker({
  modes,
  current,
  onChoose,
}: {
  modes: readonly SessionMode[];
  /** The id the agent says it is in, or `null` before it has said. */
  current: string | null;
  onChoose: (modeId: string) => void;
}) {
  const shown = modes.find((mode) => mode.id === current);

  return (
    <Popup of="Mode" shown={shown?.name ?? current ?? "—"}>
      <DropdownMenuRadioGroup
        value={current ?? ""}
        onValueChange={(value) => onChoose(value)}
      >
        {modes.map((mode) => (
          <DropdownMenuRadioItem key={mode.id} value={mode.id}>
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="text-sm">{mode.name}</span>
              {mode.description ? (
                <span className="text-xs text-fg-tertiary">{mode.description}</span>
              ) : null}
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </Popup>
  );
}

/**
 * The values of a select, whether the agent grouped them or not.
 *
 * Grouping is the agent's presentation of its own list; a pop-up button in a
 * band this narrow is not where it earns its keep, and flattening keeps one
 * shape to draw instead of two.
 */
function flatten(option: SessionConfigOption): readonly SessionConfigValue[] {
  const raw = option.options ?? [];
  return raw.flatMap((entry) =>
    "options" in entry ? entry.options : [entry as SessionConfigValue],
  );
}
