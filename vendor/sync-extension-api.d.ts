import { ClassProp } from 'class-variance-authority/types';
import { ClassValue } from 'clsx';
import type { ComponentType } from 'react';
import { Dialog } from 'radix-ui';
import { DropdownMenu as DropdownMenu_2 } from 'radix-ui';
import { JSX } from 'react';
import { LucideIcon } from 'lucide-react';
import { Provider } from 'react';
import * as React_2 from 'react';
import { ReactNode } from 'react';
import { ScrollArea as ScrollArea_2 } from 'radix-ui';
import { Tooltip as Tooltip_2 } from 'radix-ui';
import { VariantProps } from 'class-variance-authority';

/**
 * Why a record's document is not here, in the fewest words that keep the two
 * absences apart.
 *
 * `not_on_branch` is routine — the corpus holds every branch's documents and
 * this checkout has only some of them — while `removed` is somebody deleting
 * the file on the branch that owns it, which is the one absence a person is
 * asked about. Collapsing them into "missing" would ask nobody anything.
 *
 * One answer in one place, because a row, an open document and a menu that all
 * describe the same state in different words describe three states.
 */
export declare function absenceLabel(presence: Presence): string;

/**
 * What `activate` returns: one entry per area the manifest declared, by area id.
 *
 * An extension declaring exactly one area may return that area's module
 * directly. One area is the common case, and making it look like the general
 * one costs an author a wrapper object for no reason.
 */
export declare type ActivationResult = Readonly<Record<string, AreaModule>>;

/** One agent's adapter package, and whether it is ready to run without a fetch. */
export declare interface AdapterState {
    readonly agentId: string;
    readonly package: string;
    readonly version: string;
    readonly ready: boolean;
}

/**
 * An agent, plus whether the package it is reached through has been downloaded.
 *
 * Two reads rather than one field, because they answer to different things: the
 * catalogue is about this build and this machine's PATH, and the adapter is
 * about a directory that install filled and removing the extension empties.
 * `null` means the agent needs no adapter at all — every native one, and Codex,
 * whose bridge is compiled in.
 */
export declare interface Agent extends AgentDescriptor {
    readonly adapterReady: boolean | null;
}

/** One agent, and whether this machine can raise it. */
export declare interface AgentDescriptor {
    readonly id: string;
    readonly name: string;
    /** Whether the executable was found. A missing agent is still listed. */
    readonly available: boolean;
    /** What is missing, when it is not available. */
    readonly unavailableReason: string | null;
    /** Whether a full turn was ever run against it for real. */
    readonly verified: boolean;
    readonly unverifiedReason: string | null;
    /**
     * How it is reached: natively, through a third-party adapter, or through a
     * bridge of ours. Worth showing because it explains a slow first launch — an
     * adapter is fetched before a single frame is written.
     */
    readonly transport: "native" | "adapter" | "bridge" | "unknown";
    /**
     * Whether a model can be chosen when it is raised. The other way — the agent
     * listing its models in protocol — is not knowable until a session exists.
     */
    readonly takesModelAtLaunch: boolean;
}

/**
 * One conversation, as a screen reads and drives it.
 *
 * The session itself is in Rust and is addressed by key. This hook is a view of
 * it: it subscribes, folds the events into something readable, and hands back
 * the four things a person can do. Unmounting stops the watching and nothing
 * else — the agent goes on working, and remounting is handed everything that
 * happened meanwhile.
 */
export declare interface AgentSession {
    readonly key: string | null;
    readonly transcript: Transcript;
    /** What the agent lets a person choose, the model among it. */
    readonly configuration: readonly SessionConfigOption[];
    /** True while a turn is being sent or run. */
    readonly isWorking: boolean;
    /**
     * Runs one turn. `attachments` are absolute paths the agent reads itself;
     * `images` are pasted pictures, which have no path because they have no file.
     */
    readonly prompt: (text: string, attachments?: readonly string[], images?: readonly PastedContent[]) => Promise<void>;
    readonly cancel: () => Promise<void>;
    /** Answers the open question. `null` withdraws it. */
    readonly answer: (optionId: string | null) => Promise<void>;
    readonly choose: (configId: string, valueId: string) => Promise<void>;
}

/** What a package says it needs, as its manifest states it. */
export declare interface ApiRequirement {
    /** A semver range over `SYNC_API_VERSION`, such as `^1.2`. */
    readonly syncApi: string;
    /** Capability names. Unknown ones are refusals, not warnings — see below. */
    readonly capabilities?: readonly string[];
}

/**
 * What one part of the window asks an area to show.
 *
 * Areas own what they are showing — which type is selected, which record is
 * open — and they keep it for as long as the window is open, which is what
 * makes leaving one and coming back cost nothing. That leaves no way to ask an
 * area to show something from outside it, and search is exactly that ask: a
 * result belongs to whichever area owns its type, and the palette is in the
 * title bar, above all of them.
 *
 * An intent is that ask, and it is deliberately thin. It names what to show and
 * nothing about how: no scroll position, no panel, no mode. An area receiving
 * one is free to reach it however it reaches it from its own navigator, which
 * is the only way an intent can stay meaningful for an area this build has
 * never seen.
 *
 * **Identity is the signal.** An area applies an intent when the object it was
 * given is one it has not applied yet, so asking for the same record twice is
 * two objects and opens it twice — the second ask is somebody who wandered off
 * and wants it back, not a duplicate to be swallowed.
 */
export declare type AreaIntent = 
/**
* Open a record. The kind travels with the key because an area lists records
* by type: without it, an area would have to read the record to find out
* which of its own lists the row it is about to open belongs in.
*/
    {
    readonly show: "record";
    readonly key: string;
    readonly kind: string;
}
/** Show one entry of the catalogue, by extension id. */
| {
    readonly show: "extension";
    readonly id: string;
};

/**
 * One section: what holds its state, and one component per column of its frame.
 *
 * The provider is what makes three columns one area. It owns everything the
 * area is showing and everything it opens — its selection, its sheets, the File
 * commands it contributes — so selecting a different area takes all of it away
 * by unmounting rather than by the window remembering to clear anything. The
 * columns are separate components because the window renders them into three
 * different places in its panel tree; what holds them together is whatever the
 * provider puts in context, which is the area's own business and invisible to
 * the host.
 *
 * The provider is optional, because an area with nothing to share should not
 * have to write an empty wrapper to say so.
 *
 * Which columns to return is decided by the frame the manifest declared, and
 * getting it wrong is refused at load rather than trimmed: returning an
 * inspector for a `list` frame is code whose author believes it will be
 * rendered, and a panel that is empty because a component was dropped without a
 * word is an hour spent looking for the wrong bug.
 */
export declare interface AreaModule {
    readonly Provider?: ComponentType<AreaProviderProps>;
    /** Rendered in the navigator, for a frame that has one. */
    readonly Navigator?: ComponentType;
    readonly Workspace: ComponentType;
    /** Rendered in the inspector, for a frame that has one. */
    readonly Inspector?: ComponentType;
}

/**
 * What the window tells an area, and the only three things it tells it.
 *
 * Everything else an area shows, it fetches or holds itself. That is not
 * minimalism for its own sake: a prop the window passes is a decision the
 * window has made about what the area is for, and the window is the one file
 * that must not know what any area contains.
 */
export declare interface AreaProviderProps {
    readonly project: OpenProject;
    /**
     * False while the area is mounted but not the selected one.
     *
     * An area is mounted on first visit and never unmounted, so this is what tells
     * it to stop: no reads, no scans, no menu. It keeps everything it holds — the
     * selection, the open record, the caret, the scroll position — because coming
     * back to a window as it was left is what the arrangement is for.
     */
    readonly active: boolean;
    /**
     * What the window is asking this area to show, or `null` when it is asking
     * nothing.
     *
     * Only the area an intent was addressed to is given one, and it is given the
     * same object until the next ask. **Identity is the signal**: an area applies
     * an object it has not applied yet, so asking for the same record twice is
     * two objects and opens it twice — the second ask is somebody who wandered
     * off and wants it back, not a duplicate to swallow.
     */
    readonly intent?: AreaIntent | null;
    readonly children: ReactNode;
}

/** The states that mean a claim stopped matching the code. */
export declare const ATTENTION_STATES: readonly ["stale", "invalid"];

export declare function Button({ className, variant, size, asChild, ...props }: React_2.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
}): React_2.JSX.Element;

export declare const buttonVariants: (props?: ({
    variant?: "link" | "default" | "outline" | "secondary" | "ghost" | "destructive" | null | undefined;
    size?: "icon" | "default" | "xs" | "sm" | "lg" | "icon-xs" | "icon-sm" | "icon-lg" | null | undefined;
} & ClassProp) | undefined) => string;

/**
 * Ask for files to attach with the system's open panel.
 *
 * What comes back is absolute and stays absolute. A path in a record is made
 * relative to the repository because the record travels with it; this one is
 * handed to another process on this machine, which resolves it against its own
 * directory — so relative here would name a different file, or none.
 *
 * The panel opens at the project because that is where a person is working, and
 * it is not confined to it: an agent may perfectly well be asked about a
 * screenshot on the desktop.
 */
export declare function chooseAttachments(defaultPath: string): Promise<readonly string[]>;

export declare function cn(...inputs: ClassValue[]): string;

/**
 * The context panel.
 *
 * This is where this application differs from the tools it competes with at a
 * glance. Their right-hand panel searches files; ours answers a different
 * question — what does the project currently claim about itself, and how much
 * of that is still true after the code moved.
 *
 * It answers that question about whatever the window is pointed at. With a
 * record open, that is the record: everything *about* it lives here so that the
 * centre can be nothing but the text. With no record open, it is the corpus.
 */
export declare function ContextInspector({ corpus, open, projectPath, }: {
    corpus: Corpus;
    /** The record the workspace has open, if it has one. */
    open: OpenDocument | null;
    /** Where the project is, so the panel's open panel opens inside it. */
    projectPath: string;
}): JSX.Element;

/**
 * The pointer for a kept record, when this machine holds one.
 *
 * `null` is the ordinary answer rather than a failure, and it is the whole of
 * the "is this conversation mine?" test: a record written by somebody else, or
 * on another machine, has no pointer here. What the window offers then is
 * continuing from the transcript in the record.
 */
export declare function conversationForRecord(project: string, recordKey: string): Promise<RememberedConversation | null>;

/**
 * Says which record a conversation was kept as, so the record can be continued
 * on this machine later.
 *
 * Answers whether there was a pointer to say it of. `false` is not a failure: a
 * conversation kept in the same run it was opened in may have none yet.
 */
export declare function conversationKeptAs(key: string, recordKey: string): Promise<boolean>;

export declare interface Corpus {
    /**
     * The revision everything here was read at: a commit on the project's memory
     * refs, which is a fact about the store rather than about the code branch.
     */
    readonly revision: string | null;
    /**
     * Every type the project holds, including the ones this window is not
     * listing: the filter that hides them has to offer them back.
     */
    readonly types: readonly MemoryType[];
    /** Counts over the whole corpus, not over the page. */
    readonly counts: MemoryCounts;
    /** The rows of the current selection. */
    readonly records: readonly MemoryRecord[];
    /** True when the selection holds more rows than were read. */
    readonly hasMore: boolean;
    /**
     * The kinds left out of all of this. Echoed back because a column showing
     * nothing has to be able to say whether that is the project's answer or its
     * own filter's.
     */
    readonly hidden: readonly string[];
    /** True while the store has not yet answered for this selection. */
    readonly isLoading: boolean;
    /**
     * Why memory could not be read, in words, or `null`.
     *
     * An empty project and an unreachable engine are different answers, and the
     * column says which one it got instead of showing an empty list for both.
     */
    readonly error: string | null;
    readonly reload: () => void;
    /**
     * Add a type to the project's corpus. Rejects with the engine's own words, so
     * the form that asked can say what went wrong where it was asked.
     */
    readonly createType: (type: TypeDefinition) => Promise<void>;
    /**
     * Redefine a type the project holds. The kind names which one and does not
     * change: it is what every record of the type carries, and the store has no
     * rename.
     */
    readonly updateType: (type: TypeDefinition) => Promise<void>;
    /**
     * Remove a type and every record written as it, answering with how many went.
     * Everything else the column shows is re-read: this is the one write here
     * that changes the counts as well as the corpus.
     */
    readonly deleteType: (kind: string) => Promise<number>;
    /**
     * How many records one type holds, asked of the store. What a confirmation
     * needs before it can name a number it is about to destroy.
     */
    readonly countRecords: (kind: string) => Promise<number>;
    /**
     * Create an empty record of one of the project's types and answer with it.
     *
     * The title is left empty: the record is about to be opened with the caret in
     * its title field, and a stored "Untitled" would be a word somebody has to
     * delete before they can write their own.
     *
     * `folder` absent files it where the type does by default — the root of its
     * storage, or no folder at all for a type whose documents are its records.
     * Somebody looking at a folder means that folder, and a record that appeared
     * somewhere else would be the window ignoring where they were standing.
     */
    readonly createRecord: (kind: string, folder?: string) => Promise<MemoryDocument>;
    /**
     * Delete records, all of them or none. Everything the column shows is re-read
     * afterwards, because the counts and the page both described a corpus that no
     * longer exists.
     */
    readonly deleteRecords: (keys: readonly string[]) => Promise<void>;
    /** What holds on to a record: what links to it, and what mentions it. */
    readonly dependentsOf: (key: string) => Promise<Dependents>;
    /**
     * Files the last scan could not attribute to a record, each carrying the
     * records it could be.
     *
     * The one part of an attached folder that cannot be settled without a person.
     * `UnmatchedFiles` states why, beside the question it asks.
     */
    readonly unmatched: readonly ScanChange[];
    /**
     * Answer one of them. `adopt` names the record the file turned out to be —
     * the record keeps its key, so every link pointing at it survives — and
     * omitting it says the file is a document in its own right.
     */
    readonly resolveUnmatched: (file: ScanChange, kind: string, adopt?: string) => Promise<void>;
}

/**
 * Make a folder that nothing is in yet, under the type named by `kind`.
 *
 * What a folder *is* differs by where that type keeps its documents, and the
 * engine decides it from the kind: a directory for documents that are files,
 * and the record that carries `isFolder` for documents that are records. The
 * window does not branch on it, which is the point — a second place deciding
 * this is a second place it can be decided differently.
 *
 * One difference reaches a person and nothing can hide it. Git keeps no empty
 * directories, so a folder made in an attached directory is a fact about this
 * working tree until something is filed in it, while one made in the records
 * travels immediately. Closing that would mean writing a marker into somebody's
 * repository, which is the one thing attaching a folder promises not to do.
 */
export declare function createMemoryFolder(project: string, folder: string, kind: string): Promise<TransactionResult>;

/**
 * Take a folder and everything filed under it, and say how many went.
 *
 * Everything, whatever its type. A folder exists while something is in it, so
 * sparing one type's records would empty the folder rather than delete it —
 * which is why the confirmation counts across types and says so.
 *
 * Files go with their records. Directories are removed only while they are
 * empty, so a file no scan has reached is left where somebody put it.
 */
export declare function deleteMemoryFolder(project: string, folder: string): Promise<number>;

/** Deleting a conversation, stopping its agent first if it is still running. */
export declare function deleteSession(key: string): Promise<void>;

/** One record that holds on to another. */
export declare interface Dependent {
    readonly key: string;
    readonly kind: string;
    readonly title: string;
    /** The relation the link declares, when it is a link rather than a mention. */
    readonly relation: string | null;
}

/**
 * What holds on to a record, split by how it holds on.
 *
 * `links` name it structurally — delete it and the link points at nothing.
 * `mentions` talk about it in prose, and deleting one of those because it named
 * a record would delete the reasoning along with the conclusion.
 */
export declare interface Dependents {
    readonly links: readonly Dependent[];
    readonly mentions: readonly Dependent[];
}

/**
 * The document that *is* a folder: opened if it exists, written if it does not.
 *
 * How a folder gets a title and a text of its own. What comes back is an
 * ordinary record of an ordinary type, so what somebody writes in it is indexed
 * and found by search like any other document — nothing in the engine treats it
 * specially, which is exactly why it works.
 *
 * A folder that already has one answers with it rather than writing a second:
 * two records standing for one folder is a question with no answer, and the
 * engine refuses it for the same reason.
 */
export declare function describeMemoryFolder(project: string, folder: string, kind: string): Promise<MemoryDocument>;

/**
 * A record as the window has it: what the store answered, with whatever has been
 * typed into it on top.
 *
 * This is what every control reads, so a tag added a moment ago is on screen
 * before the store has been told about it. It is not what gets written — that is
 * the patch, which carries only what changed.
 */
export declare interface DocumentDraft {
    readonly title: string;
    readonly content: string;
    readonly tags: readonly string[];
    readonly links: readonly EntityLink[];
    readonly scope: readonly string[];
    readonly observed: readonly string[];
    readonly archived: boolean;
    readonly fields: Readonly<Record<string, unknown>>;
}

/**
 * What an edit of one record changes. Every member is optional and means
 * "replace this"; anything absent is left exactly as the store holds it, which
 * is what lets the panel write a tag while somebody is still typing a paragraph.
 *
 * A field set to `null` is one the record stops carrying — how an optional field
 * is cleared, which is not the same as leaving it alone.
 */
export declare interface DocumentPatch {
    readonly title?: string;
    readonly content?: string;
    readonly tags?: readonly string[];
    readonly links?: readonly EntityLink[];
    readonly scope?: readonly string[];
    readonly observed?: readonly string[];
    readonly archived?: boolean;
    readonly fields?: Readonly<Record<string, unknown>>;
}

/**
 * One record, open.
 *
 * The body is the whole surface: a claim is prose, and prose is what the widest
 * column in the window is for. Everything that is *about* the record — its type,
 * how far it can be trusted, what it is scoped to, what it links, the fields its
 * type declares — is in the context panel beside it, because it describes the
 * thing rather than being it, and it is edited there for the same reason.
 *
 * It opens editable, with no mode to enter first: a person reads a claim, sees
 * the part that is wrong, and puts the caret there. What the header band carries
 * is the one thing that cannot be inferred from the text — whether what is on
 * screen is what the store holds — and the two commands that act on the record as
 * a whole.
 *
 * The project's own record is a document like any other. Its title is the
 * project's name, its body is the description and its `language` field is the
 * language the project writes in; all three are the project's data. What is not a
 * document is a type *definition*, and those are never listed as a record.
 *
 * One record is read instead of edited: one whose Markdown would not survive the
 * round trip through blocks. That is checked by round-tripping it, not guessed
 * at, and the reason is on the page.
 */
export declare function DocumentView({ open, icon, note, onBack, backLabel, fixed, onArchive, onDelete, justCreated, }: {
    open: OpenDocument;
    /** The mark for this record's type, from the published corpus. */
    icon: string | null | undefined;
    /** What is worth saying about this record before its text, if anything. */
    note?: string;
    onBack: () => void;
    /** Where returning goes — the list this record was opened from. */
    backLabel: string;
    /**
     * True for a record the window neither creates nor removes — the one that
     * names the project. Both commands are still drawn, and refused with the
     * reason: a menu missing an item explains nothing.
     */
    fixed?: boolean;
    onArchive: () => void;
    /** Ask to delete this record. The confirmation belongs to whoever owns the
     *  list, because a deletion changes it. */
    onDelete: () => void;
    /** True when this record was created a moment ago and still has no name. */
    justCreated?: boolean;
}): JSX.Element;

export declare function DropdownMenu({ ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Root>): React_2.JSX.Element;

export declare function DropdownMenuCheckboxItem({ className, children, checked, inset, ...props }: React_2.ComponentProps<typeof DropdownMenu_2.CheckboxItem> & {
    inset?: boolean;
}): React_2.JSX.Element;

export declare function DropdownMenuContent({ className, align, sideOffset, ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Content>): React_2.JSX.Element;

export declare function DropdownMenuGroup({ ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Group>): React_2.JSX.Element;

export declare function DropdownMenuItem({ className, inset, variant, ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Item> & {
    inset?: boolean;
    variant?: "default" | "destructive";
}): React_2.JSX.Element;

export declare function DropdownMenuLabel({ className, inset, ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Label> & {
    inset?: boolean;
}): React_2.JSX.Element;

export declare function DropdownMenuPortal({ ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Portal>): React_2.JSX.Element;

export declare function DropdownMenuRadioGroup({ ...props }: React_2.ComponentProps<typeof DropdownMenu_2.RadioGroup>): React_2.JSX.Element;

export declare function DropdownMenuRadioItem({ className, children, inset, ...props }: React_2.ComponentProps<typeof DropdownMenu_2.RadioItem> & {
    inset?: boolean;
}): React_2.JSX.Element;

export declare function DropdownMenuSeparator({ className, ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Separator>): React_2.JSX.Element;

export declare function DropdownMenuShortcut({ className, ...props }: React_2.ComponentProps<"span">): React_2.JSX.Element;

export declare function DropdownMenuSub({ ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Sub>): React_2.JSX.Element;

export declare function DropdownMenuSubContent({ className, ...props }: React_2.ComponentProps<typeof DropdownMenu_2.SubContent>): React_2.JSX.Element;

export declare function DropdownMenuSubTrigger({ className, inset, children, ...props }: React_2.ComponentProps<typeof DropdownMenu_2.SubTrigger> & {
    inset?: boolean;
}): React_2.JSX.Element;

export declare function DropdownMenuTrigger({ ...props }: React_2.ComponentProps<typeof DropdownMenu_2.Trigger>): React_2.JSX.Element;

export declare const EMPTY_TRANSCRIPT: Transcript;

/** A typed relation to another entity, by key. */
export declare interface EntityLink {
    key: string;
    relation: string;
}

/** What the agent said, or did, as one readable block. */
export declare type Entry = 
/** Something a person typed, and whatever they attached to it. */
    {
    readonly id: string;
    readonly at: number;
    readonly voice: "person";
    readonly text: string;
    /** The files sent with it, as absolute paths. Empty when there were none. */
    readonly attachments: readonly string[];
    /** The images pasted into it. Empty when there were none. */
    readonly images: readonly PastedImage[];
}
/** The agent's answer. */
| {
    readonly id: string;
    readonly at: number;
    /**
     * When the last chunk of this block landed.
     *
     * Kept apart from `at`, which is when the block started, because the pause
     * rule is about the gap since the last thing said. Measuring from the
     * start instead means a block that has been streaming for longer than the
     * pause splits on every further chunk, however fast they arrive — an
     * answer that runs for a minute becomes a hundred paragraphs.
     */
    readonly lastAt: number;
    readonly voice: "agent";
    readonly text: string;
}
/** The agent thinking out loud, which not every agent sends. */
| {
    readonly id: string;
    readonly at: number;
    readonly lastAt: number;
    readonly voice: "thought";
    readonly text: string;
}
/** A tool the agent ran. */
| {
    readonly id: string;
    readonly at: number;
    readonly voice: "tool";
    readonly title: string;
    readonly status: string;
    readonly toolCallId: string;
}
/** A plan the agent stated, in the shape it stated it. */
| {
    readonly id: string;
    readonly at: number;
    readonly voice: "plan";
    readonly steps: readonly {
        readonly title: string;
        readonly status: string;
    }[];
}
/** An update this build has no reading for. Shown rather than dropped. */
| {
    readonly id: string;
    readonly at: number;
    readonly voice: "unread";
    readonly update: string | null;
    readonly payload: unknown;
}
/** Something went wrong, in the words it went wrong in. */
| {
    readonly id: string;
    readonly at: number;
    readonly voice: "trouble";
    readonly text: string;
};

/**
 * A failure in words a person can act on.
 *
 * The engine's `kind` is stable vocabulary, and the two states worth naming here
 * are the ones a person can do something about; everything else is reported in
 * the engine's own message rather than flattened into "something went wrong".
 *
 * A failure that is not the engine's is reported as it arrived, whatever shape
 * it has. Tauri rejects an unknown command with a plain string — which is what a
 * window running against an application binary older than itself gets, and it is
 * exactly the case where a generic sentence would waste somebody's afternoon.
 */
export declare function explain(failure: unknown): string;

/**
 * What an extension implements, and the whole of what the host calls.
 *
 * Separate from the rest of the surface because it points the other way.
 * Everything else in `extension-api` is something the window hands over; this
 * is the shape of what comes back, and an author writes it rather than calls
 * it. Keeping it in a module of its own is also what keeps the surface
 * acyclic — the loader needs these types and the loader is not part of what an
 * extension may import.
 *
 * ```ts
 * export default function activate({ id }: ExtensionHost): ActivationResult {
 *   return { memory: { Provider, Navigator, Workspace, Inspector } }
 * }
 * ```
 */
/**
 * What an extension's module is handed when it starts.
 *
 * Only its own id, and that is the whole of it. An earlier draft also handed
 * over React and the surface, because the first spike had no other way to get
 * them across a module boundary; a built extension now writes ordinary imports
 * and the host resolves them, so passing the same objects a second time would
 * be a second way to reach them — and two ways is how one of them goes stale.
 *
 * The id is here because it is the one thing a module cannot know about
 * itself: its own name is decided by the manifest beside it, and repeating it
 * in code is a copy that can disagree.
 */
export declare interface ExtensionHost {
    readonly id: string;
}

/**
 * One field, as its type declares it.
 *
 * Every member is optional because a definition is the project's and may say as
 * little as it likes; a declaration this build cannot read is a field shown as
 * text rather than a field it refuses to draw.
 */
export declare interface FieldDeclaration {
    /**
     * `string`, `text`, `enum`, `number`, `integer`, `boolean`, `array`,
     * `object`.
     *
     * `text` and `string` are both strings to the store and different things to
     * a person: `text` is the engine's word for prose, so it is offered as the
     * several lines it says it is.
     */
    readonly type?: string;
    readonly required?: boolean;
    /** The values an enumeration allows. */
    readonly values?: readonly string[];
    /**
     * What an `array` holds, one declaration for every entry. It is what decides
     * whether a list can be offered as a control at all: a list of strings is a
     * token field and a list over an enumeration is a set of checkboxes, while a
     * list of objects is shown as stored.
     */
    readonly items?: FieldDeclaration;
    /** What a control offers when somebody fills the field in. */
    readonly default?: unknown;
    readonly description?: string;
}

/** The last segment of a path, which is what a folder is called. */
export declare function folderName(path: string): string;

/**
 * Deleting a folder, and everything filed under it.
 *
 * **Everything, whatever its type**, and the sheet says so rather than leaving
 * it to be discovered. A folder exists while something is in it, so a deletion
 * that spared another type's records would empty the folder and leave it
 * standing — which is not what anybody asking for this meant. Nothing filed
 * there is collateral: it is what the folder *is*.
 *
 * The number is asked of the store when the sheet opens rather than read off
 * the row behind it. That row counts one type's records at one level; this
 * counts every type at every depth, and a sentence naming a count is promising
 * the one about to be destroyed.
 *
 * What it does not promise is the directory. A folder holding a file no scan
 * has reached keeps that file and therefore keeps itself — so the sheet says
 * the records go, and leaves the working tree to speak for itself afterwards.
 */
export declare function FolderRemovalSheet({ open, onOpenChange, folder, countRecords, onDelete, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The folder about to go, or `null` when the sheet is closed. */
    folder: string | null;
    countRecords: (folder: string) => Promise<number>;
    onDelete: (folder: string) => Promise<void>;
}): JSX.Element;

/**
 * The project's folders, kept in step with the corpus.
 *
 * Its own hook rather than a member of `useCorpus`, because it is a different
 * question with a different answer. The corpus is what the project *knows*;
 * this is the shape it is filed in, and half of that shape is not in the corpus
 * at all — an empty directory of an attached folder is in no record, and a tree
 * built from a page of records would leave it out while a person looks straight
 * at it in Finder.
 *
 * Read whole rather than a level at a time. A type's folders are a list of short
 * strings, one call answers for all of them, and asking per level would make
 * opening a branch a round trip that can fail on its own. Whoever draws a
 * subtree slices this by prefix, which is what a path is for.
 *
 * One call per type, though, rather than one for the project. Folders are a
 * namespace every type shares, so a project-wide answer cannot say whose a
 * folder is — and a tree that hung all of them under every type would show each
 * folder several times, in places its records are not.
 */
export declare interface Folders {
    /** One type's folders, by kind. A type with none is absent rather than empty. */
    readonly byKind: ReadonlyMap<string, readonly MemoryFolder[]>;
    /** Why there are none, when that is the reason rather than the answer. */
    readonly error: string | null;
    readonly isLoading: boolean;
    /** Re-read now. For a caller that wrote something this hook cannot see. */
    readonly reload: () => void;
}

/**
 * The one question a folder asks, making it or renaming it: what is it called.
 *
 * A sheet rather than a row that appears already named. Finder makes an
 * "untitled folder" and puts the name in edit mode, which works because the
 * name is editable in place a moment later; here it is not yet, and a folder
 * called "untitled folder" that cannot be renamed is worse than being asked.
 *
 * Where it goes is not asked, because it has already been answered: the command
 * came from a row, and that row is the parent. A sheet re-asking would be the
 * window forgetting what somebody just pointed at.
 */
export declare function FolderSheet({ open, onOpenChange, parent, renaming, onSubmit, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Where the new folder goes, repository-relative. The empty string is the
     * project's root, which is where a type keeping its documents in its own
     * records starts.
     */
    parent: string;
    /**
     * The folder's current name, when this is a rename rather than a new folder.
     *
     * The same sheet either way, because it is the same question. What differs is
     * what the field starts with and what the button says — and a second sheet
     * asking the same thing would be a second place to keep the rules in.
     */
    renaming?: string;
    /** Answers when the folder has been written, or throws what refused it. */
    onSubmit: (name: string) => Promise<void>;
}): JSX.Element;

/**
 * The folders at or under `root`, as a tree of paths.
 *
 * Slicing by prefix rather than by anything the engine said: a folder path is a
 * path, and `docs/guides/api` is under `docs/guides` because it says so. The
 * boundary is checked on a segment — `docs/guides` does not contain
 * `docs/guides-old`, and a plain `startsWith` would say it does.
 */
export declare function foldersUnder(folders: readonly MemoryFolder[], root: string): readonly MemoryFolder[];

/**
 * Applies one event to a transcript.
 *
 * Pure, and takes the whole transcript rather than a reducer's worth of it, so
 * a screen can replay a session's history through it and get exactly what a
 * live stream would have produced.
 */
export declare function foldTranscript(transcript: Transcript, event: SessionEvent): Transcript;

/**
 * Stops offering a conversation. What the agent holds is untouched.
 *
 * A pointer outlives the thing it points at: an agent prunes its own sessions,
 * and one it has dropped will not come back however often it is asked. Without
 * this such a row could be neither continued nor removed.
 */
export declare function forgetRememberedConversation(project: string, acpSession: string): Promise<void>;

/**
 * How far a record can still be trusted, in the engine's own words.
 *
 * This is not a field Sync writes: memory-hub derives it by reconciling code
 * history against each record's scope paths, which is why it is the state the
 * interface shows. `stale` and `invalid` mean the code moved under the claim —
 * the one thing in the window worth interrupting for.
 *
 * Treated as open: a newer engine may report a state this build has no mark
 * for, and an unknown word is shown as it arrived rather than mapped onto a
 * state it may not mean.
 */
export declare type Freshness = "fresh" | "unverified" | "stale" | "invalid" | (string & {});

/** The states the engine reports, in the order they are worth reading. */
export declare const FRESHNESS_STATES: readonly ["fresh", "unverified", "stale", "invalid"];

/** One extension a project depends on, by identifier and version. */
export declare interface InstalledExtension {
    readonly id: string;
    /**
     * The version that was installed, not the one available now. An extension
     * that has moved on is something the window can notice and say.
     */
    readonly version: string;
    /**
     * What this extension tells an agent, in full, as the project stores it.
     *
     * Here rather than only in the build because the MCP server is a process of
     * its own and has no view of the catalogue: a prompt that stayed in the
     * window would be one only the window could read. Written on install and
     * rewritten whenever this build's text and the stored one disagree.
     *
     * Absent for an extension with nothing to say, which is most of them.
     */
    readonly prompt?: string;
    /**
     * The sha256 of the artefact this version resolved to.
     *
     * What turns the declaration into a lockfile: a release re-tagged under a
     * version somebody already has is detected rather than trusted. Absent for a
     * package with no fixed content to hash — a folder somebody is writing in —
     * and that absence is the honest answer rather than a gap to fill.
     */
    readonly integrity?: string;
    /**
     * Where the package came from: `registry`, `file` or `folder`.
     *
     * The difference between a dependency and somebody's working tree. A project
     * declaring one that came from a folder was composed against code being
     * written, and anybody opening it elsewhere deserves to know that before
     * wondering why a section is missing. The path is deliberately not here: it
     * belongs to one machine, and in a shared record it is noise at best.
     */
    readonly source?: string;
}

/**
 * Whether this type's documents are files somebody else edits.
 *
 * One question asked in one place, because the answer changes what the window
 * may offer: a folder that is a directory is renamed in Finder, and a body that
 * is a file may be open in another editor while Sync shows it.
 */
export declare function isAttachedType(type: MemoryType): boolean;

/**
 * Whether a string is a version at all.
 *
 * Here rather than in a manifest validator because the answer belongs with the
 * number: a packer, the loader and the catalogue all ask it, and three spellings
 * of "is this a version" is how two of them end up disagreeing.
 */
export declare function isVersion(candidate: string): boolean;

/**
 * The bare glyph, for places too narrow to carry the full mark. The navigator
 * lists the kinds themselves, so it uses this and stays one language with the
 * rows it filters.
 */
export declare function kindIcon(icon: string | null | undefined): LucideIcon;

/**
 * The kind, as a glyph. It is decorative in the accessibility sense — every
 * place it appears also names the kind in text — so it is hidden from assistive
 * technology rather than read out twice.
 */
export declare function KindMark({ icon, className, }: {
    icon: string | null | undefined;
    className?: string;
}): JSX.Element;

/**
 * A reading view for the Markdown a record holds.
 *
 * It was written as a placeholder for the editor and kept for the two records the
 * editor will not touch: the project's own, which is republished rather than
 * edited, and a body whose Markdown would not survive a round trip through
 * blocks. Both are shown exactly as they are stored, which is the only honest
 * thing to show when the alternative is an editor that would rewrite them.
 *
 * That is why it renders the same block structure at the same sizes as
 * `src/components/editor/nodes.tsx`, and why the two have to be changed together:
 * one record read and another edited must not look like two applications.
 *
 * The rule has teeth: every block the editor can insert has to be a block this
 * can draw. A table was missing here while `/` offered one, so a record holding
 * a table was shown as the pipes it is written with — the reading view failing
 * at the one job it has, on content this application had itself produced.
 *
 * Links here behave as they do in the editor, which is the same rule again: a
 * link into the project opens the record, and one to the web is handed to the
 * system rather than followed by this window. What is still inert is
 * `[[wikilinks]]`, which are the corpus's own prose convention and carry no
 * kind — there is nothing in one to route on.
 */
export declare function Markdown({ children, plugins, }: {
    children: string;
    plugins?: readonly MarkdownPlugin[];
}): JSX.Element;

/**
 * One block of a body, as this module reads it.
 *
 * Published so that a plugin can match on the same shapes this draws with,
 * rather than being handed a string and asked to parse it a second time — and
 * declared under the published name rather than aliased to one, because an
 * extension can only name what the boundary exports.
 */
export declare type MarkdownBlock = {
    kind: "heading";
    level: 1 | 2 | 3;
    text: string;
} | {
    kind: "picture";
    url: string;
    alt: string;
} | {
    kind: "paragraph";
    text: string;
} | {
    kind: "list";
    ordered: boolean;
    items: string[];
} | {
    kind: "quote";
    text: string;
} | {
    kind: "code";
    text: string;
} | {
    kind: "table";
    header: string[];
    rows: string[][];
} | {
    kind: "rule";
};

/**
 * Something that draws a block this module would otherwise draw itself.
 *
 * The seam is deliberately narrow: a plugin **replaces the drawing of a block**
 * and cannot change how the body is split into them. Parsing is what has to
 * agree with the editor — every block `/` can insert has to be a block this can
 * draw, and a plugin that could invent block kinds would be a second Markdown
 * dialect in one window. Drawing is where the interesting cases actually live:
 * a fenced block whose language means something, a table that wants a chart, a
 * quote that is really a callout.
 *
 * Plugins are asked in order and the first that answers wins, so a caller
 * decides precedence by how it lists them. Returning `null` means "not mine".
 */
export declare interface MarkdownPlugin {
    /** For diagnosis, and so a list of them reads as something. */
    readonly name: string;
    readonly render: (block: MarkdownBlock) => ReactNode | null;
}

/** How much the project holds, by type and by trust. */
export declare interface MemoryCounts {
    readonly total: number;
    readonly byKind: Readonly<Record<string, number>>;
    readonly byFreshness: Readonly<Record<string, number>>;
}

/**
 * One record, whole.
 *
 * The body is Markdown exactly as the store holds it: what renders it is the
 * window's decision, and what edits it will be the editor's.
 */
export declare interface MemoryDocument {
    readonly key: string;
    readonly kind: string;
    readonly title: string;
    readonly content: string;
    readonly freshness: Freshness;
    /** Paths the claim's scope covers — what turns it stale when code moves. */
    readonly scope: readonly string[];
    /** Paths it was written against. */
    readonly observed: readonly string[];
    readonly tags: readonly string[];
    readonly links: readonly EntityLink[];
    readonly archived: boolean;
    /**
     * The fields this record's type declares, in the store's own words. Untyped
     * on purpose: the schema is published at runtime, and a build that typed them
     * here would be a second copy of it going out of date on its own.
     */
    readonly fields: Readonly<Record<string, unknown>>;
    /** The file this record's content lives in, when it lives outside. */
    readonly locator: string | null;
    /**
     * What the document is, from its file name: `text/markdown`, `image/png`.
     * `null` when nobody said.
     */
    readonly mediaType: string | null;
    /**
     * Whether the body is not text — an image, a PDF, anything an attached folder
     * holds now that there is no mask keeping it out.
     *
     * The bytes never travel: a window that cannot edit them has no use for them,
     * and base64 rendered as prose is worse than saying plainly what the document
     * is. What reads this says so, and leaves the file alone.
     */
    readonly contentBinary: boolean;
    readonly presence: Presence;
    /**
     * Whether the body could not be read because the file is not here.
     *
     * Distinct from an empty document, and the distinction is the point: an empty
     * file is something somebody wrote, and a missing one is a document this
     * branch does not have. Showing the second as the first would invite somebody
     * to fix it by typing into it, which would fork a document that exists
     * elsewhere.
     */
    readonly contentMissing: boolean;
    /** Where this record is filed, `null` for the root. See {@link MemoryRecord.folder}. */
    readonly folder: string | null;
    /**
     * Whether this record is the folder it is filed in. See
     * {@link MemoryRecord.isFolder}.
     */
    readonly isFolder: boolean;
}

/**
 * One folder, and everything known about it from both sources at once.
 *
 * The two origins are separate answers because they mean different things.
 * `inStorage` without `inRecords` is an empty directory of the working tree —
 * somewhere a person can file into, and something they already see in Finder.
 * `inRecords` without `inStorage` is a folder whose documents this branch does
 * not have. A tree that showed one word for both would be answering a question
 * nobody asked.
 */
export declare interface MemoryFolder {
    /** Repository-relative. The root is `""`. */
    readonly path: string;
    readonly inRecords: boolean;
    readonly inStorage: boolean;
    /**
     * How many documents are filed directly in it — not what is in the folders
     * below, and not the type definitions, which are schema rather than something
     * the project knows.
     */
    readonly records: number;
    /**
     * The key of the record that *is* this folder, when one is.
     *
     * A tree needs it, or it draws that record twice: once as the folder and once
     * as its own child.
     */
    readonly describedBy: string | null;
}

/**
 * The project's folders, read live.
 *
 * `folder` absent asks about the whole project; `""` asks about the root, which
 * is a folder like any other — the two are different questions. `subtree` says
 * whether the region reaches below the folder it names.
 *
 * Never cached across a project: Git keeps no empty directories, so an empty
 * `docs/api/` is a fact about one working tree and absent from a fresh clone.
 */
export declare function memoryFolders(project: string, folder?: string, subtree?: boolean, 
/**
 * One type's folders. Absent asks about the project.
 *
 * A tree drawn per type needs this. Folders are a namespace the whole project
 * shares — nothing stops a decision from being filed in `docs/guides` next to
 * the documents — so without it every type appears to have every folder, in
 * places its records are not.
 */
kind?: string): Promise<MemoryFolder[]>;

/**
 * How many records a folder holds, at any depth and whatever their type.
 *
 * Asked of the store rather than counted from the tree, which shows one type's
 * and only the level it is on. A confirmation may not name a number it guessed.
 */
export declare function memoryFolderToll(project: string, folder: string): Promise<number>;

/** One record, as a row. The body is not carried: a row is not a document. */
export declare interface MemoryRecord {
    readonly key: string;
    readonly kind: string;
    readonly title: string;
    readonly freshness: Freshness;
    /** The paths the claim's scope covers. Empty is a real answer. */
    readonly scope: readonly string[];
    readonly archived: boolean;
    readonly tags: readonly string[];
    /** The file holding this record's content, when it lives outside. */
    readonly locator: string | null;
    readonly presence: Presence;
    /**
     * Where this record is filed — a path of segments, `null` for the root.
     *
     * A name and never a location: in the records themselves the tree stays flat
     * and the folder is metadata somebody sets. For a record whose content is a
     * repository file it is the directory that file is in, and the two may not
     * disagree — which is why moving such a record is an engine operation rather
     * than a field this window writes.
     */
    readonly folder: string | null;
    /**
     * Whether this record *is* the folder it is filed in.
     *
     * A folder is a name until somebody gives it a title and a text of its own,
     * and that is this flag. It matters to whatever draws a tree — which would
     * otherwise show the record twice, once as the folder and once as its own
     * child — and to nothing else.
     */
    readonly isFolder: boolean;
}

/** Which part of the corpus the column is showing. */
export declare interface MemorySelection {
    kind?: string;
    freshness?: Freshness[];
    /**
     * One folder. `""` is the root — the records filed nowhere.
     *
     * The engine files every record under the directory of its locator, so this
     * is also how a path is turned back into the record that holds it. Passed
     * through untouched: the command hands the selection to the engine as it
     * stands, so this is a name for a filter the engine already had rather than
     * a new capability.
     */
    folder?: string;
    /**
     * Whether `folder` above reaches below the folder it names.
     *
     * `exact` is the engine's default and what asking for one folder means
     * without saying so. `subtree` is what a tree wants when a branch is
     * collapsed and its whole contents should still be counted.
     */
    folderScope?: "exact" | "subtree";
    limit?: number;
    offset?: number;
}

/**
 * A type the project holds, as the Records column lists it.
 *
 * All of it comes from the project's own corpus, the mark included: a type
 * created in the window is one no build has heard of. Where a definition names
 * no mark and the kind is one Sync knows how to describe, Sync's own is used.
 */
export declare interface MemoryType {
    /**
     * The identifier: what every record of this type carries, what an agent
     * writes, and what its definition's key is built from. Generated from the
     * name when a person adds a type, prefixed when an extension brings one, and
     * never re-derived afterwards — it is stored.
     */
    readonly kind: string;
    /**
     * What the type is called where a person reads it. More than one word is
     * normal, and changing it touches no record.
     */
    readonly title: string;
    readonly description: string;
    /**
     * A Lucide icon name, or `null` when neither the definition nor this build
     * names one — in which case the type is drawn with a neutral mark.
     */
    readonly icon: string | null;
    readonly fieldCount: number;
    /**
     * Where this type's records keep their content.
     *
     * Not a storage detail the interface can leave unsaid: it decides whether a
     * document has a file behind it, whether its folder is a name or a directory
     * somebody can rename in Finder, and whether the body being edited is one a
     * colleague may have open in their own editor at the same time.
     */
    readonly storage: TypeStorage;
    /**
     * Whether a document of this type can be written at all, as the engine
     * answers it.
     *
     * Asked before offering to create rather than discovered from a failure: a
     * type keeping its content in its records is always writable, and one
     * pointing at a folder is only as writable as that folder — which may be
     * read-only, or may not be checked out here at all.
     */
    readonly writable: boolean;
    /**
     * The fields this type declares, exactly as the store spells them.
     *
     * Carried verbatim rather than parsed into a shape of this build's: the schema
     * is published at runtime, so what edits a field generates its control from
     * what the declaration says — a `type`, whether it is `required`, its `values`
     * when it enumerates them, its `default` when it states one — and falls back to
     * showing the value as text when it cannot recognise the shape.
     */
    readonly fields: Readonly<Record<string, FieldDeclaration>>;
    /**
     * The relations this type declares, name to `{ target, description }`.
     *
     * Not decoration: the engine validates every link against these and rejects a
     * relation a type does not declare, so this is the list of links a record of
     * this type is allowed to hold. A type that declares none cannot link at all,
     * and the panel says so rather than offering a field the store would refuse.
     */
    readonly relationships: Readonly<Record<string, RelationshipDeclaration>>;
    /**
     * What an agent is told before it writes a record of this type, or `null`
     * where the definition says nothing.
     *
     * Published with the type rather than held by the build that brought it, so
     * it travels with the repository and any client of the engine can read it.
     * Nothing in this window shows it: it is written for whoever writes records
     * without a screen in front of them.
     */
    readonly guidance: string | null;
    /**
     * True for a type Sync publishes and maintains. It is always in the corpus —
     * the project's own record has that kind — so nothing may offer to remove it.
     */
    readonly own: boolean;
}

/**
 * The Records column's payload.
 *
 * The counts describe the whole corpus and the records describe the current
 * selection, because the navigator lists every type while the workspace shows
 * one of them. Schema records are excluded from both.
 */
export declare interface MemoryView {
    readonly revision: string;
    readonly counts: MemoryCounts;
    readonly records: readonly MemoryRecord[];
    /** True when the selection holds more than this page. */
    readonly hasMore: boolean;
}

/** A kind a record can be written as, as the navigator lists it. */
export declare interface MenuRecordType {
    kind: string;
    title: string;
}

/**
 * The one option in a session's configuration that is the model, if it has one.
 *
 * By category rather than by name: the category is the protocol's own word for
 * it, and the names differ — one agent calls it "Model" and the next may not.
 */
export declare function modelOption<T extends {
    category?: string | null;
    type?: string;
}>(options: readonly T[] | null | undefined): T | null;

/**
 * The region a thing can be dragged across.
 *
 * It wraps the columns rather than living inside one, because the drag that
 * matters crosses them: a record is dragged from the list in the workspace onto
 * a folder in the navigator, and a source and a target in two different
 * contexts would never meet.
 *
 * What a drop *means* is not decided here. This reports the payload the dragged
 * thing carried and what the row it landed on says it is; whether that is a
 * move, a copy or a refusal belongs to whoever knows the domain.
 */
export declare function MoveArea({ onDrop, children, }: {
    /** Something was dropped. Both values are the caller's own. */
    onDrop: (target: unknown, payload: unknown) => void;
    children: ReactNode;
}): JSX.Element;

/**
 * File one record in another folder. `""` is the root.
 *
 * Whether a file moves with it is the engine's business and deliberately not
 * this window's: a record whose body is a repository file has a folder that
 * *is* that file's directory, and the engine moves both or neither. Sync never
 * writes into somebody's working tree itself.
 */
export declare function moveMemoryDocument(project: string, key: string, folder: string): Promise<TransactionResult>;

/**
 * One of the system's own editing commands, by name.
 *
 * Cut, Copy and Paste are not commands Sync implements. They are the
 * webview's, routed by the system once a menu claims them — which is why the
 * menu bar carries them too — and reimplementing them here would be ours
 * wearing the system's labels, with the system's clipboard behaviour missing.
 */
export declare interface NativeEditingCommand {
    predefined: "Cut" | "Copy" | "Paste" | "SelectAll" | "Undo" | "Redo";
}

/** A command, or the rule that sets a destructive one apart from the rest. */
export declare type NativeMenuEntry = NativeMenuItem | NativeEditingCommand | "separator";

/** One command. Without `onSelect` it is a line that says something and does
 *  nothing, which is how a menu explains why an action is unavailable. */
export declare interface NativeMenuItem {
    label: string;
    enabled?: boolean;
    onSelect?: () => void;
}

/**
 * The record the window has open, read whole and written back as it is edited.
 *
 * Separate from the list it was opened from: a row carries what a row is scanned
 * for, and the body is read only when somebody asks to read it.
 *
 * Every piece of save state here is stamped with the record it belongs to. The
 * hook outlives the view — the window keeps one of it for the whole project — so
 * a write that lands after another record has been opened must not report itself
 * against the record now on screen.
 */
export declare interface OpenDocument {
    readonly document: MemoryDocument | null;
    readonly isLoading: boolean;
    /**
     * Why the record could not be read, or `null`. A key that no longer exists is
     * not an error — it comes back as a `null` document, which the view says
     * plainly.
     */
    readonly error: string | null;
    /** The record with the unwritten edits on top, or `null` with no record. */
    readonly draft: DocumentDraft | null;
    readonly save: SaveState;
    /**
     * Change what the patch names. Written after a pause, and on the way out.
     *
     * Everything except the body goes through here, because everything except the
     * body is either short to type or a single choice — and a patch in state is
     * what lets the panel show a tag the moment it is added.
     */
    readonly edit: (patch: DocumentPatch) => void;
    /**
     * Hand over a way to read the body, rather than the body.
     *
     * Serialising a document to Markdown on every keystroke would be work nobody
     * asked for, and putting the result in state would re-render the window around
     * the caret. The reader is kept in a ref and called once, when the write
     * happens.
     */
    readonly editBody: (read: () => string) => void;
    /**
     * Write what is waiting, now, and resolve when the store has answered.
     *
     * Awaited by whoever is leaving the record: the list they are going back to
     * has to be re-read against a store that already holds what they typed.
     * Resolves immediately when there is nothing waiting.
     */
    readonly write: () => Promise<void>;
    /**
     * Settle the one refusal a retry cannot: code history that was rewritten.
     *
     * A rebase, a reset or a replaced branch leaves the engine reconciling
     * against a commit this history does not descend from, and from then on it
     * refuses every write — the same refusal, however many times it is asked. So
     * this is not a retry with more patience: it tells the engine the new history
     * is the real one, and then writes what was waiting.
     *
     * Offered only for that refusal, and only from the record it happened in,
     * because it costs something: every record in the project becomes
     * `unverified`. Nothing written is lost by it.
     */
    readonly reconcile: () => Promise<void>;
    /**
     * Drop what is waiting for one record, because it no longer exists.
     *
     * Deleting a record a moment after typing into it would otherwise leave a
     * patch addressed to it, and leaving the record would send that patch to a
     * store that has nothing to apply it to. The write would be refused, which is
     * the right answer to the wrong question.
     */
    readonly forget: (key: string) => void;
}

/** What opening a session answered with. */
export declare interface OpenedSession {
    readonly key: string;
    readonly agentName: string;
    readonly agentVersion: string | null;
    readonly configuration: readonly SessionConfigOption[] | null;
}

/** A project the window is open on. */
export declare interface OpenProject extends ProjectSettings {
    /** The repository root. Everything the project knows lives under it. */
    readonly path: string;
}

/** A question waiting to be answered. */
export declare interface OpenQuestion {
    readonly requestId: number;
    readonly toolName: string | null;
    readonly request: PermissionRequest;
    readonly at: number;
}

/**
 * How much of a selection is read at once.
 *
 * The engine's own ceiling. Nothing in the column pages yet, so a selection
 * larger than this is reported as having more rather than presented as if this
 * were all of it.
 */
export declare const PAGE_LIMIT = 200;

export declare function PanelBody({ className, children, }: {
    className?: string;
    children: ReactNode;
}): JSX.Element;

/**
 * The strip along the bottom edge of a column, holding the controls that act on
 * what the column lists.
 *
 * This is where macOS puts them — the sidebar's own bottom bar, as in Mail,
 * Reminders, Music and Xcode's navigator — rather than in the column's header
 * or in the window toolbar: the header names the column, the toolbar acts on
 * the window, and a control inside the scroller leaves with the list it acts
 * on. It is one band at one height, stated here once, the way the header is.
 *
 * What acts on the *contents* of a list is not one of these. That command sits
 * beside the list's own title — the `+` next to a list's name in Reminders —
 * because it belongs to what is being shown rather than to the column showing
 * it.
 */
export declare function PanelFooter({ children }: {
    children: ReactNode;
}): JSX.Element;

export declare function PanelHeader({ title, children, }: {
    title: string;
    children?: ReactNode;
}): JSX.Element;

/**
 * The quiet text a column shows while it has nothing to list. It states the
 * role of the column instead of simulating its future content.
 */
export declare function PanelPlaceholder({ headline, detail, }: {
    headline: string;
    detail?: string;
}): JSX.Element;

/**
 * Shared chrome for the columns of the content slab.
 *
 * Every panel is a flush surface bounded by structural edges, never a floating
 * card: no shadow of its own, no corner radius, no inset margin. Each panel
 * owns its own scrolling so the window itself never scrolls.
 *
 * The header is one band at one height across all three columns, so its
 * hairline reads as a single line crossing the slab rather than three
 * unrelated ones. That is also why each column's header must say something
 * different: the navigator names the section, the workspace names what is
 * being shown of it, and the inspector names the object beside it.
 */
export declare function PanelSurface({ className, children, }: {
    className?: string;
    children: ReactNode;
}): JSX.Element;

/** The path a folder is in, or `""` for one at the root. */
export declare function parentFolder(path: string): string;

/** An image on its way into a prompt. `data` is base64, with no `data:` prefix. */
export declare interface PastedContent {
    readonly name: string;
    readonly mimeType: string;
    readonly data: string;
}

/**
 * An image pasted into a conversation, as the window is told about it.
 *
 * The bytes are not here. They are in the session, under `id`, for as long as
 * the conversation lives — nothing is written to disk, and nothing survives the
 * application closing. {@link sessionImage} is how they are fetched to draw.
 */
export declare interface PastedImage {
    readonly id: string;
    readonly name: string;
    readonly mimeType: string;
    readonly bytes: number;
}

/**
 * How long a gap has to be before it ends a block.
 *
 * Generous on purpose. A model streaming token by token can stall for a moment
 * without having finished a thought, and a block broken mid-sentence is a worse
 * failure than two paragraphs left joined.
 */
export declare const PAUSE_MS = 1500;

/**
 * A question the agent is waiting on, in the agent's own words.
 *
 * `options` are passed through in the order and with the kinds the agent sent
 * them. They are not normalised and must not be: one measured agent offers no
 * "allow always" at all and another puts "reject once" first, and a window that
 * tidied those would be offering buttons the agent will not accept.
 */
export declare interface PermissionRequest {
    readonly options: readonly {
        readonly optionId: string;
        readonly name: string;
        readonly kind: string;
    }[];
    readonly toolCall?: {
        readonly title?: string;
        readonly kind?: string;
        readonly locations?: readonly {
            readonly path: string;
        }[];
        readonly rawInput?: unknown;
        readonly _meta?: {
            readonly message?: string;
        };
    };
}

/**
 * Whether a record's content is here, and if not, why not.
 *
 * Memory does not branch and code does, so the corpus holds the union of every
 * branch's documents and the checked-out branch decides which of them are real
 * right now. `not_on_branch` is routine — another branch has it — while
 * `removed` is somebody deleting the file on the branch that owns it, which is
 * the one absence worth asking a person about.
 *
 * Open, like every other word the engine publishes.
 */
export declare type Presence = "present" | "not_on_branch" | "removed" | (string & {});

/**
 * The key of the one record that names the project.
 *
 * Fixed rather than generated because there is exactly one of it, which is what
 * lets Sync ask "has this repository been opened before?" with a single read.
 * Mirrors `PROJECT_KEY` in `sync-memory`; the window uses it to say which record
 * is the project's own, never to decide what may be written.
 */
export declare const PROJECT_KEY = "project";

/**
 * The language the project's knowledge is written in.
 *
 * It is asked for once, at the start, because it is a property of the project
 * rather than of the person reading it: claims, documents and specifications
 * are shared through the repository, and a store that mixes languages is a
 * store nobody can search.
 */
export declare const PROJECT_LANGUAGES: readonly [{
    readonly id: "en";
    readonly label: "English";
}, {
    readonly id: "de";
    readonly label: "Deutsch";
}, {
    readonly id: "fr";
    readonly label: "Français";
}, {
    readonly id: "es";
    readonly label: "Español";
}, {
    readonly id: "pt";
    readonly label: "Português";
}, {
    readonly id: "zh";
    readonly label: "中文";
}, {
    readonly id: "ja";
    readonly label: "日本語";
}];

export declare type ProjectLanguageId = (typeof PROJECT_LANGUAGES)[number]["id"];

/**
 * What a project calls itself.
 *
 * These live in the project's own memory, not on this machine, so a project
 * opened on a second computer is the same project rather than a folder that has
 * to be described again.
 */
export declare interface ProjectSettings {
    readonly name: string;
    /**
     * What this project is called by anyone referring to it — an agent naming
     * which project a call is about, a document mentioning a neighbour.
     *
     * Derived from the name when the project is created and fixed from then on:
     * it travels in the repository's own record, so two people who opened it
     * hold the same one, and renaming the project does not move it.
     */
    readonly identifier: string;
    /** Optional, and empty far more often than not. */
    readonly description: string;
    readonly language: ProjectLanguageId;
    /**
     * The extensions this project is composed of.
     *
     * The declaration travels with the repository; the code that satisfies it is
     * the machine's business. Empty is a real answer and the ordinary state of a
     * project somebody has just made: the window opens on the catalogue.
     */
    readonly installed: readonly InstalledExtension[];
}

/**
 * Which of a project's types this window is showing.
 *
 * The preference belongs to the installation, not to the project, so it is read
 * from and written to the application's own configuration — see `ProjectView`
 * in `src/lib/project/types.ts` for why.
 *
 * It is held with the path it was read for, so that switching projects shows
 * every type until the new project's preference arrives rather than briefly
 * applying the last project's answer to this one.
 *
 * Writes are optimistic: ticking a checkbox changes the list at once and the
 * store is told afterwards. A preference that could not be written is worth
 * saying nothing about — the window is already showing what was asked for, and
 * the only cost is that the next launch starts from the old list.
 */
export declare interface ProjectViewState {
    /** Kinds the window is not listing. */
    readonly hidden: readonly string[];
    readonly isHidden: (kind: string) => boolean;
    readonly toggle: (kind: string) => void;
    readonly showAll: () => void;
}

export declare function RecordMetadata({ document, draft, type, types, projectPath, onEdit, onWrite, }: {
    /** The record as stored: what the read-only facts describe. */
    document: MemoryDocument;
    /** The record with unwritten edits on top: what every control shows. */
    draft: DocumentDraft;
    /** The record's own type, when the project still holds it. */
    type: MemoryType | undefined;
    /** The corpus, because a link names a kind and a kind has a name. */
    types: readonly MemoryType[];
    /** Where the project is, so the open panel opens inside it. */
    projectPath: string;
    onEdit: (patch: DocumentPatch) => void;
    /** Write now: what a single choice does, rather than waiting for a pause. */
    onWrite: () => void;
}): JSX.Element;

/**
 * Deleting a record, and deciding what goes with it.
 *
 * A record nothing holds on to is a plain confirmation. One that other records
 * hold on to is a decision, and the sheet's whole job is to make it with the
 * store's own answer in view rather than with a warning about dependencies in
 * general.
 *
 * The two ways a record is held are not the same and are never treated as one:
 *
 * - **A link is structural.** Delete the target and the link points at nothing:
 *   the memory still works, and the part of it that explained why stops
 *   resolving. So the sheet offers to take those with it, one level — the records
 *   that link to this one, not everything that links to those. A whole branch
 *   deleted from one confirmation is the kind of thing nobody can undo and few
 *   would have chosen.
 * - **A mention is prose.** A record that names this one in its body is a
 *   sentence about it. Deleting the sentence's author because it mentioned
 *   something would delete the reasoning along with the conclusion, so mentions
 *   are counted, listed and never deleted here.
 *
 * There is no undo. That is why the sheet names what will go and shows it as the
 * rows it will disappear from.
 */
export declare function RecordRemovalSheet({ open, onOpenChange, record, types, dependentsOf, onDelete, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The record about to go, or `null` when the sheet is closed. */
    record: MemoryRecord | null;
    types: readonly MemoryType[];
    dependentsOf: (key: string) => Promise<Dependents>;
    onDelete: (keys: readonly string[]) => Promise<void>;
}): JSX.Element;

/**
 * Why an extension may not run here, in one sentence, or `null` when it may.
 *
 * One function rather than two booleans because the answer a person needs is
 * never "false": it is which of the two things to do about it. A range this
 * build is below means update Sync; a range it is above means the extension is
 * old and its own update is the fix. Those are different sentences and the
 * caller should not have to compose them.
 *
 * A capability this build has never heard of is refused rather than ignored. It
 * arrives in exactly one situation — a package built against a newer host —
 * and treating it as satisfied would run an extension that asked for something
 * and did not get it, which fails later and somewhere else.
 */
export declare function refuseIncompatible(required: ApiRequirement): string | null;

/** One relation a type declares. `target` is a kind name, or `any`. */
export declare interface RelationshipDeclaration {
    readonly target?: string;
    readonly description?: string;
}

/**
 * One conversation this machine can ask an agent to hand back.
 *
 * A pointer, not a transcript: which agent, in which directory, and the agent's
 * own id for the session. The words are still with the agent and come back
 * through `session/load`.
 */
export declare interface RememberedConversation {
    /** The agent's own id for the session. Stable across runs; the live key is not. */
    readonly acpSession: string;
    readonly agentId: string;
    readonly agentName: string;
    readonly cwd: string;
    readonly title: string | null;
    readonly openedAtMs: number;
    readonly lastSeenMs: number;
    /** The record it was kept as, when somebody kept it on this machine. */
    readonly recordKey?: string;
}

/**
 * The conversations this machine can continue, for one project.
 *
 * Not what is running — what is *resumable*. An entry whose `acpSession` no
 * live row carries is a conversation from a previous run of the application.
 */
export declare function rememberedConversations(project: string): Promise<RememberedConversation[]>;

/** One record an unmatched file could be, and how alike the two names are. */
export declare interface RenameCandidate {
    readonly key: string;
    readonly locator: string;
    /** Between 0 and 1. Git scores renames the same way, and for the same reason. */
    readonly similarity: number;
}

/**
 * Rename a folder, moving every record filed under it in one transaction.
 *
 * Where the documents are files the directory is renamed too, and the locators
 * follow it — the keys do not, so no link breaks. A type's own storage root is
 * refused: moving that is a change to the type, not a rename of a folder.
 */
export declare function renameMemoryFolder(project: string, from: string, to: string): Promise<TransactionResult>;

/**
 * Renames a conversation. An empty name clears the one there is, and the next
 * thing said derives another.
 */
export declare function renameSession(key: string, title: string): Promise<void>;

/**
 * Continues a conversation: raises its agent and asks for the session back.
 *
 * The agent replays what was said, so the session this opens arrives with its
 * transcript already in it. The key is new — this run has never seen the
 * conversation — while the conversation and its pointer are the same ones.
 *
 * Rejects with `agent_session_load` when the agent no longer holds the session.
 * That one cannot be known before asking, and it is the caller's cue to
 * continue from a kept transcript instead of from the agent.
 */
export declare function resumeSession(project: string, acpSession: string): Promise<OpenedSession>;

/**
 * Where the open record stands with the store.
 *
 * `clean` is the resting state and says nothing on screen: an application that
 * announces "Saved" about a record nobody has touched is describing itself rather
 * than the work.
 */
export declare type SaveState = {
    readonly status: "clean";
} | {
    readonly status: "edited";
} | {
    readonly status: "saving";
} | {
    readonly status: "saved";
}
/**
* The store refused the write.
*
* `kind` travels with the message because one refusal is answered by doing
* something rather than by trying again: code history that was rewritten
* refuses every write, identically, until it is reconciled — and a view that
* only had the prose could offer nothing but a retry that cannot work.
*/
| {
    readonly status: "failed";
    readonly message: string;
    readonly kind: string | null;
};

/** One conclusion of a scan, or one question it could not answer. */
export declare interface ScanChange {
    readonly change: "edited" | "moved" | "missing" | "returned" | "new" | "unmatched" | (string & {});
    readonly key?: string;
    readonly locator?: string;
    readonly from?: string;
    readonly to?: string;
    readonly presence?: Presence;
    /**
     * The digest of what is on disk. Carried back verbatim when a person settles
     * an unmatched file: the window never reads the working tree, so this is the
     * only honest statement it can make about those bytes.
     */
    readonly contentHash?: string;
    /** For `unmatched`: the records this file could be, best first. */
    readonly candidates?: readonly RenameCandidate[];
}

/**
 * What reconciling the attached folders with the records did.
 *
 * Four outcomes are unambiguous and are applied without asking — an edit in
 * place, a move, a disappearance, a return. The fifth is not: a file matching
 * no record may be new or may be a rename with an edit, and nothing about the
 * file says which. Those arrive as `unmatched` changes carrying the records
 * they could be, and wait for a person.
 */
export declare interface ScanOutcome {
    readonly revision: string | null;
    /** How many files the scan looked at. */
    readonly scanned: number;
    /**
     * How many conclusions it wrote. Zero alongside changes is the case worth
     * knowing about: everything it found needs somebody to answer it.
     */
    readonly applied: number;
    readonly changes: readonly ScanChange[];
}

export declare function ScrollArea({ className, children, ...props }: React_2.ComponentProps<typeof ScrollArea_2.Root>): React_2.JSX.Element;

export declare function ScrollBar({ className, orientation, ...props }: React_2.ComponentProps<typeof ScrollArea_2.ScrollAreaScrollbar>): React_2.JSX.Element;

/**
 * Everything a session has said so far, read once and not watched.
 *
 * The window subscribes to the conversation it has open and to no other, so a
 * command that acts on some *other* row — keeping it, above all — has no
 * transcript of it to write. This is where that transcript comes from, and it
 * carries the same `dropped` count a subscription reports.
 */
export declare function sessionBacklog(key: string): Promise<{
    events: SessionEvent[];
    dropped: number;
}>;

/**
 * One thing a session's configuration lets a person choose.
 *
 * This is the protocol's own shape, not ours. A model is one of these with
 * `category: "model"`, and it is the same mechanism on every agent that offers
 * the choice at all — which is the reason the window does not carry a table of
 * which model belongs to whom.
 */
export declare interface SessionConfigOption {
    readonly id: string;
    readonly name: string;
    readonly description?: string | null;
    readonly category?: string | null;
    readonly type?: string;
    readonly currentValue?: string;
    readonly options?: readonly SessionConfigValue[] | readonly {
        readonly name: string;
        readonly options: readonly SessionConfigValue[];
    }[];
}

export declare interface SessionConfigValue {
    readonly value: string;
    readonly name: string;
    readonly description?: string | null;
}

/** A failure from the command layer, with the kind Rust gave it. */
export declare class SessionError extends Error {
    readonly kind: string;
    constructor(kind: string, message: string);
}

/** One thing that happened in a session. */
export declare type SessionEvent = {
    readonly kind: "status";
    readonly seq: number;
    readonly atMs: number;
    readonly status: SessionStatus;
    readonly detail: string | null;
} | {
    /**
     * What a person said. Recorded by the host rather than by the protocol:
     * ACP has no notification for what the client sent, so nothing would ever
     * arrive to carry it, and keeping it in the screen's own state loses it
     * the moment the screen is unmounted.
     */
    readonly kind: "prompt";
    readonly seq: number;
    readonly atMs: number;
    readonly text: string;
    /** The files sent with it, as absolute paths. */
    readonly attachments: readonly string[];
    /** The images pasted into it, by the id the session holds them under. */
    readonly images: readonly PastedImage[];
} | {
    readonly kind: "update";
    readonly seq: number;
    readonly atMs: number;
    /** The `sessionUpdate` discriminator, when the payload carried one. */
    readonly update: string | null;
    /** Whether Rust's compiled protocol types could read it. */
    readonly recognized: boolean;
    readonly payload: Record<string, unknown>;
    /**
     * Whether this arrived while the agent was replaying a loaded session
     * rather than saying something new.
     *
     * It decides one thing, and it is the thing that puts a person into a
     * resumed conversation: `user_message_chunk` is the agent quoting what
     * somebody typed, which during a live turn is the same sentence Sync
     * already recorded when it was sent. Folded on a replay, ignored
     * otherwise.
     *
     * Absent on a history recorded before this existed, which reads as
     * `false` — the honest answer for events that were live when they
     * happened.
     */
    readonly replayed?: boolean;
} | {
    readonly kind: "permission";
    readonly seq: number;
    readonly atMs: number;
    readonly requestId: number;
    readonly toolName: string | null;
    readonly request: PermissionRequest;
} | {
    readonly kind: "permissionSettled";
    readonly seq: number;
    readonly atMs: number;
    readonly requestId: number;
    readonly chosen: string | null;
} | {
    readonly kind: "configuration";
    readonly seq: number;
    readonly atMs: number;
    readonly options: readonly SessionConfigOption[];
};

/**
 * One pasted image, for something that is about to draw it.
 *
 * Fetched when it is drawn rather than carried on the subscription: a history
 * is replayed whole to every screen that returns to a conversation, and a
 * picture in it would be paid for on every one of them.
 */
export declare function sessionImage(key: string, id: string): Promise<{
    readonly mimeType: string;
    readonly data: string;
}>;

/** A running session, as the window lists it. */
export declare interface SessionRow {
    readonly key: string;
    readonly agentId: string;
    readonly agentName: string;
    /**
     * Whether the agent said at `initialize` that it reads images. Measured:
     * Claude, Codex, OpenCode and Gemini do; Grok does not.
     */
    readonly acceptsImages: boolean;
    /**
     * What the conversation is called: the first words said in it, or whatever
     * somebody renamed it to. `null` before anything has been said, which is when
     * the agent's name is the only thing there is to call it.
     */
    readonly title: string | null;
    readonly cwd: string;
    readonly status: SessionStatus;
    readonly openedAtMs: number;
}

/** Where a session is. */
export declare type SessionStatus = 
/** The process is being raised and the session opened. */
"starting"
/** Open, and not in a turn. */
| "ready"
/** A turn is running. */
| "working"
/** Stopped on a question only a person can answer. */
| "asking"
/** Ended by itself, or its process died. */
| "ended"
/** Could not be raised, or fell over. */
| "failed";

/**
 * A sheet: a modal that belongs to this window and to nothing else.
 *
 * macOS attaches this kind of modal to the window it acts on rather than
 * floating it in the middle of the screen, so it slides out from under the
 * title bar and the title bar stays where it was. Opening a project is exactly
 * that: it configures *this* window, it cannot be left half-done in the
 * background, and there is nothing behind it to interact with meanwhile.
 *
 * The scrim covers the slab and not the frame. The frame is the window's edge,
 * not its content; dimming it would say the desktop is modal too.
 */
export declare function Sheet({ ...props }: React_2.ComponentProps<typeof Dialog.Root>): React_2.JSX.Element;

export declare function SheetContent({ className, children, ...props }: React_2.ComponentProps<typeof Dialog.Content>): React_2.JSX.Element;

export declare function SheetDescription({ className, ...props }: React_2.ComponentProps<typeof Dialog.Description>): React_2.JSX.Element;

/**
 * The action band. Buttons sit at the trailing edge with the one that
 * continues the task last, as they do in a native sheet.
 */
export declare function SheetFooter({ className, ...props }: React_2.ComponentProps<"footer">): React_2.JSX.Element;

/** The title band. One line, named for the task, never for the step. */
export declare function SheetHeader({ className, ...props }: React_2.ComponentProps<"header">): React_2.JSX.Element;

export declare function SheetTitle({ className, ...props }: React_2.ComponentProps<typeof Dialog.Title>): React_2.JSX.Element;

/**
 * Show a menu in answer to a `contextmenu` event, if there is a native one to
 * show. Answers whether the event was taken, so a caller that has nothing else
 * to offer can leave the system's own menu alone.
 */
export declare function showNativeContextMenu(event: {
    preventDefault: () => void;
}, entries: readonly NativeMenuEntry[]): boolean;

export declare function SourceList({ label, items, activeId, rail, onSelect, }: {
    /** What this list is, for assistive technology. */
    label: string;
    items: readonly SourceListItem[];
    activeId: string;
    /** The column has been folded to icons: rows lose their labels, not their
     *  place. */
    rail?: boolean;
    onSelect: (id: string) => void;
}): JSX.Element;

/**
 * A macOS source list: the column that answers "where am I".
 *
 * There are two of them in Sync — the sections of a project, and the sections
 * of the settings window — and they are one control rather than two that
 * resemble each other. Focus follows selection and the arrow keys move it, as a
 * native source list does; selection is a surface shift and a weight change,
 * with no coloured fill and no leading marker.
 *
 * It carries no header: a source list on its own surface is legible as
 * navigation without being labelled, and the row that label costs is worth more
 * than the word.
 */
export declare interface SourceListItem {
    readonly id: string;
    readonly label: string;
    readonly icon: LucideIcon;
    /**
     * A word about the row itself, trailing and muted. Not a count and not a
     * state of what the row holds — those belong to whatever the row is about.
     *
     * There is one today: a section brought by a package somebody is writing says
     * *Development*, because unsigned code running out of a working tree should
     * be visible from the column rather than only from the catalogue.
     */
    readonly note?: string;
}

export declare function SourceTree({ label, items, rootId, activeId, expanded, onSelect, onExpandedChange, indent, }: {
    /** What this tree is, for assistive technology. */
    label: string;
    /**
     * Every row, by id. A map rather than a nested shape because the rows arrive
     * flat — a list of folders is what the engine answers with — and building a
     * nesting here only to have the tree flatten it again would be two shapes to
     * keep in step.
     */
    items: ReadonlyMap<string, SourceTreeItem>;
    /**
     * The row every other row hangs from. It is never drawn: a source list shows
     * its contents, not a row standing for the list itself.
     */
    rootId: string;
    /** The selected row, or `null` while the selection is elsewhere. */
    activeId: string | null;
    /** Which rows are open. Held by the caller, because it outlives this tree:
     * collapsing a folder and coming back to the area should find it collapsed. */
    expanded: readonly string[];
    onSelect: (id: string) => void;
    onExpandedChange: (expanded: readonly string[]) => void;
    /**
     * Pixels of indent per level. Finder's is close to this; the default is set
     * against a 14px row icon so a child's icon starts under its parent's label.
     */
    indent?: number;
}): JSX.Element;

/**
 * A macOS source list with disclosure: the column that answers "where am I"
 * when where you are is nested.
 *
 * The sibling of [`SourceList`](./source-list.tsx) and deliberately its twin:
 * same row height, same selection, same one-tab-stop keyboard. A person moving
 * between the two should not be able to say which control they are in.
 *
 * **Selection follows focus**, which is what a native source list does and what
 * this window's foundation asks for. It is not what the WAI-ARIA tree pattern
 * does by default — there the arrows move focus and selecting is a second
 * keystroke — so the two arrow hotkeys are overridden below rather than left
 * alone. Left and Right collapse and expand, as they do in Finder.
 *
 * ## Why a library, and why you cannot see it from here
 *
 * The behaviour underneath is `@headless-tree/core`: expansion, focus, the
 * hotkeys, and the ARIA a flat-rendered tree needs — `role`, `aria-level`,
 * `aria-setsize`, `aria-posinset` — which is the part hand-written trees get
 * wrong. What it does *not* own is the markup: every element here is this
 * file's, so the row is a `<button>` with the window's own classes and the
 * window's one focus ring.
 *
 * That boundary is the point. Extensions are given this component and never the
 * library, so the library can be replaced without any of them noticing.
 */
/** One row of the tree. */
export declare interface SourceTreeItem {
    /** Unique within the tree, and what selection and expansion are stated in. */
    readonly id: string;
    readonly label: string;
    readonly icon?: LucideIcon;
    /** The ids of the rows below this one, in the order they are drawn. */
    readonly children?: readonly string[];
    /**
     * A number at the trailing edge, as the type rows carry. Absent draws
     * nothing, which is not the same as `0` — a folder holding no documents of
     * its own says so.
     */
    readonly count?: number;
    /**
     * Drawn quieter, for a row that exists without anything of ours in it — a
     * directory of the working tree no record is filed in. It is real, a person
     * sees it in Finder, and it is somewhere they can file into; it is just not
     * yet somewhere the project keeps anything.
     */
    readonly muted?: boolean;
    /**
     * What the secondary button opens. Built when asked for, so the commands act
     * on the row as it stands then rather than as it stood when it was drawn.
     */
    readonly menu?: () => readonly NativeMenuEntry[];
    /**
     * What this row carries when it is dragged, or absent for a row that is not
     * dragged at all.
     *
     * Opaque: this component carries it and never reads it. What a payload means
     * is the caller's, because what a drop *does* is theirs too.
     */
    readonly drag?: unknown;
    /**
     * What this row means as a destination, or absent for a row nothing may be
     * dropped on. Handed to whoever is listening above; this component never
     * reads it.
     */
    readonly drop?: unknown;
    /**
     * What the row says under the pointer, for one that has more to say than
     * fits. A node rather than a string because what belongs there is the
     * caller's: a type shows what it is for and where its documents live, and
     * neither is this component's business to compose.
     */
    readonly tooltip?: ReactNode;
}

/** Raising an agent, for a screen that is about to watch what it says. */
export declare function startSession(args: {
    agentId: string;
    cwd: string;
    model?: string | null;
}): Promise<OpenedSession>;

/**
 * The freshness state, as a mark and the engine's own word.
 *
 * A state this build has no mark for is shown as it arrived, with the neutral
 * ring: a newer engine naming a state we cannot draw is not a reason to claim
 * the record is in one we can.
 */
export declare function StateMark({ freshness, className, }: {
    freshness: Freshness;
    className?: string;
}): JSX.Element;

/** Stopping an agent, and keeping what it said. */
export declare function stopSession(key: string): Promise<void>;

/**
 * Whether this build satisfies a range, for a caller that only wants the fact.
 *
 * `false` for an unreadable range, and that is the only sensible reading: a
 * range nobody can parse is not one this build was stated to satisfy.
 */
export declare function supportsApiRange(range: string): boolean;

/**
 * The version of the surface this build publishes.
 *
 * Started at 1.0.0 rather than 0.x deliberately. A zero major says "nothing is
 * promised", which would be true of the code and false of the intent: the whole
 * point of the number is that a manifest can state a range and be believed. The
 * cost is honest major bumps, which is the cost of meaning it.
 *
 * **2.0.0** is the first of them, and it was paid for exactly what the rule
 * says: `ExtensionType` left the surface. A vocabulary is now a JSON file
 * inside the package rather than a constant in an extension's TypeScript, so
 * the type an extension used to name is a type that no longer describes
 * anything it writes. The contract an extension implements — `ExtensionHost`,
 * `AreaModule`, `ActivationResult` — arrived in the same commit, which on its
 * own would have been a minor.
 */
export declare const SYNC_API_VERSION: "2.0.0";

/**
 * What this build can do, as opposed to what its surface looks like.
 *
 * Semver answers *is this surface compatible*. It cannot answer *can this build
 * do the thing*: a platform with no bundled ACP sidecar exposes exactly the same
 * `useAgentSession` type and cannot raise an agent behind it. Expressing that as
 * a version would mean a different version number per platform, which is a lie
 * in the other direction.
 *
 * So a capability is a promise about behaviour, named, and a manifest may
 * require one. Reading whether one is present is allowed too — an extension
 * that degrades deliberately is doing something better than refusing.
 */
export declare const SYNC_CAPABILITIES: readonly ["records", "agents.acp", "markdown.plugins", "native-menu", "folders", "sheets"];

export declare type SyncCapability = (typeof SYNC_CAPABILITIES)[number];

/** The seven things a person can do to the table the caret is in. */
export declare interface TableCommands {
    insertRowAbove: () => void;
    insertRowBelow: () => void;
    insertColumnBefore: () => void;
    insertColumnAfter: () => void;
    deleteRow: () => void;
    deleteColumn: () => void;
    deleteTable: () => void;
}

export declare const TableCommandsProvider: Provider<(commands: TableCommands | null) => void>;

export declare function Tooltip({ ...props }: React_2.ComponentProps<typeof Tooltip_2.Root>): React_2.JSX.Element;

export declare function TooltipContent({ className, sideOffset, children, ...props }: React_2.ComponentProps<typeof Tooltip_2.Content>): React_2.JSX.Element;

export declare function TooltipProvider({ delayDuration, ...props }: React_2.ComponentProps<typeof Tooltip_2.Provider>): React_2.JSX.Element;

export declare function TooltipTrigger({ ...props }: React_2.ComponentProps<typeof Tooltip_2.Trigger>): React_2.JSX.Element;

/** What a write produced. */
export declare interface TransactionResult {
    revision: string;
    changed_keys: string[];
}

/** Everything a screen needs to draw one conversation. */
export declare interface Transcript {
    readonly entries: readonly Entry[];
    readonly status: SessionStatus;
    /** Why, for the states where the word is not enough. */
    readonly detail: string | null;
    /** The question the agent is stopped on, or `null`. */
    readonly question: OpenQuestion | null;
    /** How many events fell off the front of the session's history. */
    readonly dropped: number;
    /** The last figures the agent reported, or `null` if it reports none. */
    readonly usage: Usage | null;
    /** The mode the agent says it is in, for the agents that have modes. */
    readonly mode: string | null;
    /** How the last turn ended, in the protocol's word for it. */
    readonly stopReason: string | null;
}

/**
 * What a type is, as far as the window decides it.
 *
 * The identifier and the name are two answers, not one. `kind` is what the
 * engine stores on every record of the type; `title` is what a person reads,
 * and it can be several words. The window generates the first from the second
 * when a type is added and never again — a stored identifier is a fact, and one
 * re-derived on every save would move under the records carrying it.
 */
export declare interface TypeDefinition {
    kind: string;
    title: string;
    description: string;
    icon: string;
    /**
     * Which storage holds this type's documents, and what it needs to be told.
     * Answered when the type is created and never edited: where documents live is
     * not a setting whose change may quietly move data, and moving them is an
     * operation of its own with a plan and an acknowledgement.
     *
     * Omitted — or naming nothing — means the bodies live in the records, which
     * is what a definition saying nothing means to the engine.
     */
    storage?: TypeStorage;
}

/**
 * Which of the project's types this window lists, and searches.
 *
 * It sits in the bottom bar of the column it governs, beside the control that
 * adds a type: that bar is where macOS keeps the actions belonging to a source
 * list, and it is one of the two bands in that column that do not scroll. A
 * control that acts on one column from another is one you have to remember
 * rather than find; a control inside the scroller is one you have to scroll
 * back to.
 *
 * One control for one fact. Unticking a type takes it out of the navigator, out
 * of "All claims", out of the counts and out of search at the same time: a
 * window that hid a type from the list while still finding it would be
 * answering with something it refuses to show. Nothing is removed from the
 * project by it — the records stay, agents go on writing them, and the
 * preference never leaves this machine.
 *
 * It is the shell's rather than any area's for the same reason the preference
 * is: two controls over one stored fact would be two ways of asking the same
 * question, and the second one to be written would win silently. The palette
 * and the navigator mount the same component over the same state.
 */
export declare function TypeFilter({ types, counts, view, verb, align, }: {
    types: readonly MemoryType[];
    /**
     * How many records each listed kind holds. Omitted where the surface has no
     * count to stand behind — a palette knows what a search returned, not what
     * the corpus holds.
     */
    counts?: Readonly<Record<string, number>>;
    view: ProjectViewState;
    /** What this filter does to a type, in a word: `listed`, or `searched`. */
    verb?: string;
    align?: "start" | "end";
}): JSX.Element | null;

/**
 * What a kind is called, wherever one is shown.
 *
 * Every column that names a type goes through here, so the window has one
 * answer rather than one per surface. A kind the corpus no longer defines is
 * shown as the identifier itself: a record of a type the project has removed
 * still says what it was written as, and inventing a name for it would be the
 * window making something up.
 */
export declare function typeName(types: readonly MemoryType[], kind: string): string;

/**
 * Which type's folder a file belongs to, by where the file is.
 *
 * The deepest declared folder wins, because `docs` and `docs/adr` can both be
 * attached and a file under the second belongs to the second. Membership is a
 * question the engine has already answered for any file it reported; this only
 * says which type the answer was about.
 *
 * `null` when no attached type could hold it, so a file this window cannot
 * place is one it says nothing about rather than one it files under a guess.
 */
export declare function typeOfLocator(types: readonly MemoryType[], locator: string): MemoryType | null;

/**
 * Removing a type, and everything the project wrote as it.
 *
 * The records are not collateral damage — they are the substance of the
 * decision. The engine runs a strict schema, so a record whose kind has no
 * definition is one nothing can read, write or validate; leaving them behind
 * would leave the project holding claims it can no longer open. There is no
 * version of this that removes only the definition, which is why the sheet
 * states the number instead of hiding it behind a phrase like "and its data".
 *
 * **A type over a folder is detached rather than deleted, and the sheet says
 * so in the title, the sentence and the button.** Its records describe files
 * the repository had before Sync was asked about them: removing the type takes
 * what Sync knew and leaves what the team wrote. One word for two operations
 * would be this window promising, in the same sentence, both to delete
 * everything of a type and to leave most of it alone.
 *
 * The number is asked of the store when the sheet opens rather than read off
 * the row behind it. The row shows what the last read found and leaves out
 * whatever this window hides; a sentence that names a count is promising the
 * one that is about to be destroyed.
 */
export declare function TypeRemovalSheet({ open, onOpenChange, type, countRecords, onDelete, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The type about to go, or `null` when the sheet is closed. */
    type: MemoryType | null;
    countRecords: (kind: string) => Promise<number>;
    onDelete: (kind: string) => Promise<number>;
}): JSX.Element;

/**
 * Naming a type the project can then speak in, and saying where its records
 * live.
 *
 * A type is the one thing in this window that changes what the project is
 * *able* to say: the engine validates every record against the corpus, so a
 * kind that has no definition is a kind that cannot be written. That is why
 * this is a sheet rather than an inline row — it configures the project, and
 * the shell has one kind of modal for exactly that.
 *
 * Two questions, so two panes. **What the type is** — its name, what it is for,
 * the mark it is drawn with. **Where its records live** — which storage engine
 * holds them, and whatever that engine needs to be told. They are separated
 * because they are answered by different people at different times, and because
 * one form holding both is taller than a small window.
 *
 * Storage is chosen when the type is created and not afterwards. That is the
 * engine's rule and it is the right one: where records live is not a setting
 * whose edit can be allowed to move data behind somebody's back. Moving them is
 * an operation with a plan and an acknowledgement — `memory_migrate_storage` —
 * and it is not this form.
 *
 * The identifier is a fourth thing, and it is not a question. It is made from
 * the name when the type is added — lower case, one word — and then it stops
 * moving: every record of the type carries it, the definition's key is built
 * from it, and an agent writes it. It is shown, so it is never a secret, and it
 * is not editable, because the store has no rename.
 *
 * A name the kind alphabet cannot carry is given a generated identifier rather
 * than a refusal — see `lib/memory/type-identifier`. The window asks for a name
 * in the project's own language; what the store needs to key on is the window's
 * problem to solve, not the person's.
 */
export declare function TypeSheet({ open, onOpenChange, editing, onSubmit, existing, projectPath, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The type being redefined, or `null` while one is being named. */
    editing: MemoryType | null;
    onSubmit: (type: TypeDefinition) => Promise<void>;
    /** What the project already holds, so an identifier cannot collide with one. */
    existing: readonly MemoryType[];
    /** Where the repository is, so a folder is chosen from inside it. */
    projectPath: string;
}): JSX.Element;

/**
 * Where a type's documents live: a folder of the repository, or nothing at all.
 *
 * A type naming no folder keeps its bodies in its records — nothing else writes
 * them, and a record's body is part of the record. A type naming one points at
 * a directory of the working tree: the files are the team's, Git versions them,
 * a pull request shows them in its diff, and Memory writes nothing into them.
 * What it keeps beside each file is a record holding the key, the locator, the
 * digest, the tags and the links.
 *
 * The path is in the type definition itself, so a type that is attached is
 * always locatable — including one somebody else's build attached.
 */
export declare interface TypeStorage {
    /** The directory, relative to the repository root. Absent for a type whose bodies are records. */
    readonly folder?: string | null;
}

/**
 * The files a scan could not attribute to a record, and the question they ask.
 *
 * Everything else an attached folder does is settled without anybody: a file
 * edited in place, moved, gone, or back where a record said it was. This is the
 * fifth outcome, and it is not a matter of the engine trying harder. A file
 * renamed and edited in the same stroke matches no record by path and none by
 * bytes — and neither does a file somebody just wrote. Nothing about the file
 * says which it is.
 *
 * Deciding silently means one of two bad outcomes: a document loses its history
 * and every link pointing at it, or two unrelated documents are merged into
 * one. So the engine ranks the records it could be, the way Git scores renames,
 * and stops. This is where a person answers.
 *
 * It lives above "Needs attention" for the same reason that view exists: it is
 * the one thing in the window that is waiting on somebody rather than on the
 * code.
 */
export declare function UnmatchedFiles({ files, types, onResolve, }: {
    files: readonly ScanChange[];
    /** The project's types, to say which folder — and so which type — a file is in. */
    types: readonly MemoryType[];
    onResolve: (file: ScanChange, kind: string, adopt?: string) => Promise<void>;
}): JSX.Element | null;

/**
 * Change what the patch names in one record, and get the record back as stored.
 *
 * Only what the patch names travels. The command reads what is there and hands
 * the rest of the record back to the store untouched — scope, tags, links,
 * freshness and the fields the type declares — because a record rebuilt from
 * what this window happens to know would drop everything it does not.
 *
 * `null` means the record left the store between the write and the read.
 */
export declare function updateMemoryDocument(project: string, key: string, edits: DocumentPatch): Promise<MemoryDocument | null>;

/** What a turn cost, as the agent counted it. Not every agent reports any. */
export declare interface Usage {
    readonly totalTokens?: number;
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly thoughtTokens?: number | null;
    readonly cachedReadTokens?: number | null;
    readonly cachedWriteTokens?: number | null;
}

/**
 * The figures worth showing, as label and value.
 *
 * Only what the agent actually reported: a zero it never sent is a claim about
 * spending that nobody made.
 */
export declare function usageLines(usage: Usage | null): readonly {
    label: string;
    value: number;
}[];

/**
 * The agents this machine can raise.
 *
 * Read once and kept: what is installed changes when somebody installs
 * something, which is not during a render. `reload` is for after they have.
 */
export declare function useAgents(): {
    readonly agents: readonly Agent[];
    readonly isLoading: boolean;
    readonly reload: () => void;
};

export declare function useAgentSession(key: string | null): AgentSession;

/**
 * Keep the application menu in step with what the window can do.
 *
 * The menu belongs to the application rather than to a window, so it is one
 * menu whoever calls this: the shell installs it with nothing to create, and
 * the open project replaces it with its own kinds. It is rebuilt only when what
 * it *says* changes — a re-render that hands over new closures is not a new
 * menu, because the commands are read through a ref.
 */
/**
 * @param enabled False for an area that is mounted but not selected. Such an
 *   area keeps its state and its DOM, and must keep its hands off the menu:
 *   the window has one menu bar, and the area a person is looking at is the one
 *   that fills it.
 */
export declare function useAppMenu(file: WindowCommands | null, enabled?: boolean): void;

/**
 * @param active False while the area holding this is mounted but not selected.
 *   Such an area is frozen rather than torn down: it stops reading the store
 *   and stops watching for the window regaining focus, and goes on holding what
 *   it last read. Without this, ten installed areas would be ten scans of the
 *   working tree every time somebody switches back to the application — the
 *   cost of keeping state would exceed what keeping it is worth.
 */
export declare function useCorpus(projectPath: string, selection?: MemorySelection, hidden?: readonly string[], active?: boolean): Corpus;

export declare function useDocument(projectPath: string, key: string | null): OpenDocument;

/**
 * What makes one thing draggable, for a list that is not a tree.
 *
 * The tree wires its own rows; everything else — a row in a list, a card —
 * asks for this and spreads what it answers onto the element that should move.
 * `payload` is the caller's own and is handed back to `MoveArea`'s `onDrop`
 * untouched.
 */
export declare function useDragHandle(id: string, payload: unknown): {
    "data-dragging": boolean;
    role: string;
    tabIndex: number;
    'aria-disabled': boolean;
    'aria-pressed': boolean | undefined;
    'aria-roledescription': string;
    'aria-describedby': string;
    ref: (element: HTMLElement | null) => void;
};

/**
 * @param revision The corpus revision this tree should agree with. Passed in
 *   rather than read here so the two answers on screen come from one moment:
 *   a hook watching the store on its own would redraw the tree a beat before or
 *   after the records beside it, and a folder appearing without its documents
 *   reads as a bug in the project rather than in the timing. `null` is the
 *   corpus before its first answer, and is read on rather than waited for — the
 *   folders are a separate question and do not need the records to have arrived
 *   for the tree to be true.
 * @param active False while the area holding this is mounted but not selected.
 *   Such an area keeps what it last read and stops asking — ten installed areas
 *   must not be ten reads of the working tree on every revision.
 */
export declare function useFolders(projectPath: string, kinds: readonly string[], revision: string | null, active?: boolean): Folders;

/**
 * Every agent running right now, across every extension.
 *
 * This is what answers the two questions a person asks about a process the
 * application started for them — is it still going, and how do I stop it — and
 * it has to come from Rust rather than from React state, because the screen that
 * started an agent may be the one that is no longer mounted.
 *
 * Polled rather than pushed. A status change reaches the screen watching that
 * session immediately, on its own subscription; this list is the overview, and
 * an overview that is a second or two behind is not wrong in any way a person
 * can act on. The alternative — a second event channel per window — would be a
 * parallel truth to keep in step with the first.
 */
export declare function useLiveSessions(active?: boolean): {
    readonly sessions: readonly SessionRow[];
    readonly reload: () => void;
};

export declare function useProjectView(projectPath: string): ProjectViewState;

/**
 * What File can do at this moment. Every field is read at the moment a command
 * is chosen rather than when the menu was built, so a window that has since
 * moved on answers with what is true then.
 */
export declare interface WindowCommands {
    /**
     * The kind the workspace is showing, which is the one thing `⌘N` writes.
     * `null` where it is showing a view rather than a kind, and the command has
     * nothing to act on.
     */
    selected: MenuRecordType | null;
    /** Write a record of one kind, or `null` where the window cannot. */
    createRecord: ((kind: string) => void) | null;
    /** Name a new type, or `null` where the window cannot. */
    createType: (() => void) | null;
    /**
     * What can be done to the table the caret is in, or `null` when it is not in
     * one. A table is the one block whose editing is more than typing into it,
     * and this is the half of that a keyboard can reach — the other half is the
     * system's menu on the cell itself.
     */
    table: TableCommands | null;
}

/** Records how much of a session's history was already gone when we subscribed. */
export declare function withDropped(transcript: Transcript, dropped: number): Transcript;

export { }
