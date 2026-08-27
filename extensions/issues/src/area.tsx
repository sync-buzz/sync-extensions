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

import { CircleCheck, CircleDot, List, RefreshCw } from "lucide-react";

import {
  Button,
  KindMark,
  Markdown,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelPlaceholder,
  PanelSurface,
  ScrollArea,
  SourceList,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  projectRemote,
  type AreaProviderProps,
  type ExtensionNet,
  type SourceListItem,
} from "@sync-buzz/extension-api";

import {
  SLICES,
  ReadFailed,
  named,
  read,
  readOrigin,
  when,
  type Issue,
  type Origin,
  type Repository,
  type SliceId,
} from "./github";
import { cached, remember } from "./held";

/**
 * The package's own door out, as `activate` was handed it.
 *
 * A module-scoped variable rather than a prop, because the columns are
 * components the window renders itself: nothing of this package is between the
 * shell and a column, so there is nowhere to pass it. It is written once,
 * before the window can have mounted anything — `activate` returns these
 * components, so a render implies the assignment already happened.
 *
 * It is not exported. The permission behind it is this package's, and a second
 * module reaching it would be the one thing this shape exists to prevent.
 */
let net: ExtensionNet | null = null;

export function holdNet(door: ExtensionNet): void {
  net = door;
}

/**
 * Which repository this section is about, once git has been asked.
 *
 * Four states rather than a repository and a flag, because each of them is a
 * different sentence a person is owed: *still asking*, *this project has no
 * `origin`*, *its `origin` is not GitHub*, and the repository itself. Collapsed
 * to a nullable value, the first three would all read as an empty column.
 */
type Subject =
  | { readonly kind: "asking" }
  | { readonly kind: "none" }
  | { readonly kind: "elsewhere"; readonly said: string }
  | { readonly kind: "github"; readonly repository: Repository };

interface AreaState {
  readonly subject: Subject;
  readonly slice: SliceId;
  readonly setSlice: (slice: SliceId) => void;
  readonly issues: readonly Issue[];
  readonly reading: boolean;
  /** Why the last read did not answer, in a sentence, or `null`. */
  readonly failure: string | null;
  /** The list on screen was read from this machine rather than from GitHub. */
  readonly fromCache: boolean;
  readonly reread: () => void;
  readonly selected: number | null;
  readonly select: (issue: number | null) => void;
}

const Area = createContext<AreaState | null>(null);

function useArea(): AreaState {
  const held = useContext(Area);
  if (held === null) {
    throw new Error("An Issues column was drawn outside its own provider.");
  }
  return held;
}

/**
 * Issues, as an area of the window.
 *
 * **The section's subject is the project, and nothing here asks anybody which
 * repository they mean.** The machine already knows: it is `origin`, and a
 * column that asked would be asking for something it could look up — and would
 * let a typo point one project at another project's issues with nothing to say
 * so. A repository with no `origin` is told to fix that in the project, because
 * that is where it is wrong.
 */
export function IssuesProvider({ project, active, children }: AreaProviderProps) {
  const [subject, setSubject] = useState<Subject>({ kind: "asking" });
  const [slice, setSlice] = useState<SliceId>("open");
  const [issues, setIssues] = useState<readonly Issue[]>([]);
  const [reading, setReading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [selected, select] = useState<number | null>(null);
  // Bumped by the control in the bottom bar. A number rather than a flag so
  // that asking twice is two reads: pressing it again while nothing changed is
  // somebody saying *look now*, which is exactly when a cache is in the way.
  const [asked, setAsked] = useState(0);
  // Which ask has already been answered. Without it, the first press of *read
  // again* would put this section past every cache for the rest of the session:
  // the effect re-runs on each slice, sees a number that is no longer zero, and
  // spends one of the hour's sixty requests on a list it already holds.
  const served = useRef(0);

  // Asked again on every re-read, not only when the project opens: somebody who
  // has just run `git remote add origin` is owed the list without reopening the
  // window, and asking git is a child process rather than a request.
  useEffect(() => {
    if (!active) return;
    let dropped = false;
    void projectRemote(project.path).then(
      (url: string | null) => {
        if (dropped) return;
        if (url === null) {
          setSubject({ kind: "none" });
          return;
        }
        const origin: Origin = readOrigin(url);
        setSubject(
          origin.kind === "github"
            ? { kind: "github", repository: origin.repository }
            : { kind: "elsewhere", said: origin.said },
        );
      },
      () => {
        // Git not being runnable is the window's problem rather than this
        // section's, and it is already said where a project is opened.
        if (!dropped) setSubject({ kind: "none" });
      },
    );
    return () => {
      dropped = true;
    };
  }, [active, project.path, asked]);

  useEffect(() => {
    if (!active || subject.kind !== "github") return;
    const { repository } = subject;

    const held = cached(repository, slice);
    if (held !== null) {
      setIssues(held.issues);
      setFromCache(true);
      // Fresh enough, and this ask has been answered already: what is on this
      // machine is what GitHub would answer, and a request per visit would
      // spend the hour's sixty on a column somebody walked past.
      if (held.fresh && asked === served.current) return;
    } else {
      setIssues([]);
    }

    // Only ever null when this module was loaded without `activate` having run,
    // which is not a state the window can produce — and is a column drawing
    // nothing rather than one that throws while somebody is looking at it.
    if (net === null) {
      setFailure("Issues was started without its own door out, so it can read nothing.");
      return;
    }

    let dropped = false;
    served.current = asked;
    setReading(true);
    setFailure(null);
    void read(net, repository, slice)
      .then(
        (answered) => {
          if (dropped) return;
          setIssues(answered);
          setFromCache(false);
          remember(repository, slice, answered);
        },
        (refused: unknown) => {
          if (dropped) return;
          // What was cached stays on screen under the sentence. A list that is
          // an hour old and says so is worth more than an empty column.
          setFailure(
            refused instanceof ReadFailed || refused instanceof Error
              ? refused.message
              : String(refused),
          );
        },
      )
      .finally(() => {
        if (!dropped) setReading(false);
      });

    return () => {
      dropped = true;
    };
  }, [active, subject, slice, asked]);

  // An issue that is no longer in the list must not leave the two columns
  // beside it drawing something nobody can reach.
  useEffect(() => {
    if (selected !== null && !issues.some((issue) => issue.number === selected)) {
      select(null);
    }
  }, [issues, selected]);

  const value = useMemo<AreaState>(
    () => ({
      subject,
      slice,
      setSlice,
      issues,
      reading,
      failure,
      fromCache,
      reread: () => setAsked((count) => count + 1),
      selected,
      select,
    }),
    [subject, slice, issues, reading, failure, fromCache, selected],
  );

  return <Area.Provider value={value}>{children}</Area.Provider>;
}

/** The mark each slice carries, which is GitHub's own language for the three. */
const MARKS = { open: CircleDot, closed: CircleCheck, all: List } as const;

/**
 * The slices of this project's issues, and nothing else.
 *
 * A source list of three rows, the way every other navigator in this window is
 * a source list — no field, no label, no paragraph. What repository this is was
 * a question here until the section learned to ask `origin`; a column that asks
 * for what the machine already knows is a form, and this window does not put
 * forms in its navigator.
 *
 * There is no `+` in the header and nothing is missing: a header may carry the
 * command that writes into what it names, and this section writes nothing.
 */
export function IssuesNavigator() {
  const area = useArea();

  const rows: SourceListItem[] = SLICES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    icon: MARKS[entry.id],
    // Only on the row being shown, because it is the only one whose count this
    // section has read. A figure on the other two would be a claim about
    // something nobody asked GitHub for.
    ...(entry.id === area.slice && area.issues.length > 0
      ? { badge: { kind: "count" as const, value: area.issues.length } }
      : {}),
  }));

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Issues" />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {area.subject.kind === "github" ? (
            <SourceList
              label="Slices of this project's issues"
              items={rows}
              activeId={area.slice}
              onSelect={(id) => area.setSlice(id as SliceId)}
            />
          ) : null}
        </div>
      </ScrollArea>

      {/* Where macOS keeps what acts on a source list. One control, on the
          leading edge: read it again. Nothing in this bar writes what the list
          contains, which is the other half of the same convention — and here
          nothing writes anything at all. */}
      <PanelFooter>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Read again"
              disabled={area.reading}
              onClick={area.reread}
              className="text-fg-tertiary hover:text-fg"
            >
              <RefreshCw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Read again</TooltipContent>
        </Tooltip>
        <div className="min-w-0 flex-1" />
      </PanelFooter>
    </PanelSurface>
  );
}

/** What the workspace's band says it is showing. */
function heading(subject: Subject): string {
  switch (subject.kind) {
    case "github":
      return named(subject.repository);
    case "asking":
      return "Issues";
    default:
      return "Issues";
  }
}

/**
 * The slice, or one issue of it.
 *
 * The band at the top is the one every column in the slab shares, so its
 * hairline reads as a single line across the window. It names what is being
 * shown and how much of it there is — and while an issue is open it names the
 * repository, which is the way back to the list.
 */
export function IssuesWorkspace() {
  const area = useArea();
  const open = area.issues.find((issue) => issue.number === area.selected) ?? null;

  if (open !== null) {
    return (
      <section className="flex h-full min-w-0 flex-col bg-workspace">
        <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator pr-3 pl-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => area.select(null)}
            className="min-w-0 text-fg-secondary hover:text-fg"
          >
            <span className="truncate">{heading(area.subject)}</span>
          </Button>
          <span className="shrink-0 font-mono text-xs text-fg-tertiary tabular-nums">
            #{open.number}
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {/* The window's own measure and geometry for stored Markdown, so an
              issue reads as the same kind of page a record does. The renderer
              is the shell's — one dialect of Markdown in one window, and this
              package neither parses nor styles a line of it. */}
          <div className="prose-surface mx-auto w-full max-w-(--prose-measure) px-6 py-5">
            <h1 className="text-2xl font-semibold text-fg">{open.title}</h1>
            <p className="mt-1 text-xs text-fg-tertiary">
              {open.author} opened this on {when(open.createdAt)}
            </p>
            <div className="mt-5">
              {open.body.trim().length === 0 ? (
                <PanelPlaceholder
                  headline="No description"
                  detail="Whoever opened this issue wrote a title and nothing under it."
                />
              ) : (
                <Markdown>{open.body}</Markdown>
              )}
            </div>
          </div>
        </ScrollArea>
      </section>
    );
  }

  const count = area.issues.length;

  return (
    <section className="flex h-full min-w-0 flex-col bg-workspace">
      <div className="flex h-(--panel-header-height) shrink-0 items-center justify-between gap-3 border-b border-separator px-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-fg">
          {heading(area.subject)}
        </h2>
        {area.subject.kind === "github" ? (
          <span className="shrink-0 text-xs text-fg-tertiary tabular-nums">
            {area.reading && count === 0
              ? "Reading…"
              : `${count} ${count === 1 ? "issue" : "issues"}`}
          </span>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {/* A read that did not happen says so, above whatever was cached, in
            the one tier this window keeps for a refusal. */}
        {area.failure === null ? null : (
          <p className="max-w-[68ch] px-4 pt-4 text-xs text-danger">{area.failure}</p>
        )}
        <Slice />
      </ScrollArea>
    </section>
  );
}

/**
 * What the surface shows: the list, or the one sentence that replaces it.
 *
 * Every silence here says which silence it is. *No `origin`* and *`origin` is
 * not GitHub* look identical as an empty column and are different things to go
 * and do, and only one of them is anything to do with this section.
 */
function Slice() {
  const area = useArea();

  if (area.subject.kind === "asking") {
    return null;
  }

  if (area.subject.kind === "none") {
    return (
      <div className="p-6">
        <PanelPlaceholder
          headline="This project's repository has no origin"
          detail="Issues reads whatever origin names, so there is nothing to read yet. Give the repository one where it belongs — in the project, with git remote add origin — and read again."
        />
      </div>
    );
  }

  if (area.subject.kind === "elsewhere") {
    return (
      <div className="p-6">
        <PanelPlaceholder
          headline="This project's origin is not on GitHub"
          detail={`It is ${area.subject.said}. This section reads GitHub, so what it could show is somebody else's repository rather than yours — and it would rather show nothing.`}
        />
      </div>
    );
  }

  if (area.issues.length === 0) {
    return (
      <div className="p-6">
        <PanelPlaceholder
          headline={area.reading ? "Reading" : `Nothing ${area.slice === "closed" ? "closed" : "open"}`}
          detail={
            area.reading
              ? undefined
              : `${named(area.subject.repository)} has no issues in this slice. Pull requests are not counted: they are issues on GitHub's side of the wire and a different piece of work on this one.`
          }
        />
      </div>
    );
  }

  return (
    <>
      {/* The window's own list: rows separated by a hairline, each the full
          width of the surface, at the density Records reads a claim at. Nothing
          here is a card and nothing is rounded — a list of things is one
          surface with lines in it. */}
      <ul className="divide-y divide-separator">
        {area.issues.map((issue) => (
          <li key={issue.number}>
            <button
              type="button"
              onClick={() => area.select(issue.number)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-(--motion-duration-fast) ease-shell hover:bg-hover"
            >
              <KindMark icon={issue.state === "closed" ? "circle-check" : "circle-dot"} className="mt-px" />
              <span className="min-w-0 flex-1">
                <span className="block text-base text-fg">{issue.title}</span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-fg-tertiary">
                  <span className="shrink-0 font-mono tabular-nums">#{issue.number}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{issue.author}</span>
                  {issue.comments > 0 ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0 tabular-nums">
                        {issue.comments} {issue.comments === 1 ? "comment" : "comments"}
                      </span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">{when(issue.updatedAt)}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Where the list came from, said once and quietly. A column drawing a
          cached list without saying so is a column claiming to be current when
          the network is down. */}
      {area.fromCache ? (
        <p className="px-4 py-3 text-xs text-fg-tertiary">
          Read earlier on this machine, and kept here rather than in the project.
        </p>
      ) : null}
    </>
  );
}

/**
 * What is true of the open issue.
 *
 * Facts and nothing else — **there is no command in this column**, because
 * there is nothing this package may do to an issue: it reads, over a request
 * with no account behind it, and a control that closed or commented on one
 * would be an interface offering what the system cannot do.
 */
export function IssuesInspector() {
  const area = useArea();
  const open = area.issues.find((issue) => issue.number === area.selected) ?? null;

  if (open === null) {
    return (
      <PanelSurface className="bg-panel">
        <PanelHeader title="Issues" />
        <PanelBody className="space-y-5">
          <Sliced />
        </PanelBody>
      </PanelSurface>
    );
  }

  return (
    <PanelSurface className="bg-panel">
      {/* Each column's header says something the others do not: the navigator
          names the section, the workspace names what it is showing, and this
          one names what it describes. */}
      <PanelHeader title="Issue" />
      <PanelBody className="space-y-5">
        <section className="space-y-2">
          <Label>Facts</Label>
          <dl className="space-y-1.5">
            <Fact label="Number" value={`#${open.number}`} mono />
            <Fact label="State" value={open.state} />
            <Fact label="Opened by" value={open.author} />
            <Fact label="Opened" value={when(open.createdAt)} />
            <Fact label="Last touched" value={when(open.updatedAt)} />
            <Fact label="Comments" value={String(open.comments)} mono />
          </dl>
        </section>

        <section className="space-y-2">
          <Label>Labels</Label>
          {open.labels.length === 0 ? (
            <p className="text-xs text-fg-tertiary">None.</p>
          ) : (
            // Words rather than the colours GitHub gives them. This window
            // keeps colour for status and for destruction, and a row of tinted
            // pills would be the loudest thing in a column whose subject is the
            // text beside it.
            <ul className="flex flex-wrap gap-1">
              {open.labels.map((label) => (
                <li
                  key={label}
                  className="rounded-(--radius-control) border border-separator px-1.5 py-0.5 text-xs text-fg-secondary"
                >
                  {label}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <Label>Where it lives</Label>
          <p className="text-xs text-fg-tertiary">
            On GitHub, and only there. Nothing read here is written into this
            project&apos;s memory: an issue is somebody else&apos;s text about your
            work, and the corpus holds claims about this repository&apos;s own code.
          </p>
        </section>
      </PanelBody>
    </PanelSurface>
  );
}

/** What the column says while no issue is open: the slice it would describe. */
function Sliced() {
  const area = useArea();
  const slice = SLICES.find((entry) => entry.id === area.slice);

  return (
    <section className="space-y-2">
      <Label>Slice</Label>
      <dl className="space-y-1.5">
        <Fact
          label="Repository"
          value={area.subject.kind === "github" ? named(area.subject.repository) : "—"}
        />
        <Fact label="Showing" value={slice?.label ?? "—"} />
        <Fact label="Read" value={String(area.issues.length)} mono />
      </dl>
      <p className="text-xs text-fg-tertiary">
        {area.subject.kind === "github"
          ? (slice?.note ?? "")
          : "The repository is this project's own, as its origin names it — there is nothing here to choose."}
      </p>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold text-fg-tertiary">{children}</h3>;
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{label}</dt>
      <dd
        className={
          mono
            ? "shrink-0 font-mono text-xs text-fg-secondary tabular-nums"
            : "shrink-0 truncate text-xs text-fg-secondary"
        }
      >
        {value}
      </dd>
    </div>
  );
}
