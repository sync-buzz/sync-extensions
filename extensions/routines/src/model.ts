/**
 * What a routine is, as every column here reads it.
 *
 * Three columns and a tree ask the same four questions of a record — how often,
 * by whom, whether it runs, where it is filed — and each of them answered in
 * its own file was four spellings of `fields.every` drifting apart. The
 * envelope is the store's, so what is read out of it is stated once.
 */

/** The kind this package publishes, and the only one it reads. */
export const KIND = "routines.routine";

/**
 * The intervals a routine may be set to.
 *
 * A closed set rather than a number somebody types, and the reason is in
 * `service.ts`: each one is a handler the manifest declares, which is what lets
 * a routine be carried out on a clock without this package keeping a clock of
 * its own.
 */
export const INTERVALS = [
  { id: "15m", label: "Every 15 minutes", brief: "every 15 minutes" },
  { id: "1h", label: "Hourly", brief: "hourly" },
  { id: "6h", label: "Every 6 hours", brief: "every 6 hours" },
  { id: "24h", label: "Daily", brief: "daily" },
] as const;

/**
 * The fields a row carries, asked for by name.
 *
 * A listing brings what it was asked for and nothing else, so a column that
 * says *this one runs, hourly, as Claude* names the three fields here rather
 * than opening every record to find out. Absent asks for none, which is what
 * this column used to get — and why its rows could say nothing but a title.
 */
export const ROW_FIELDS = ["every", "agent", "enabled"] as const;

/** What a routine with no interval of its own is on. Absent means hourly. */
const DEFAULT_EVERY = "1h";

/** What a routine with no agent named is carried out by. */
const DEFAULT_AGENT = "claude";

type Fields = Readonly<Record<string, unknown>> | undefined;

export function everyOf(fields: Fields): string {
  const every = fields?.every;
  return typeof every === "string" &&
    INTERVALS.some((interval) => interval.id === every)
    ? every
    : DEFAULT_EVERY;
}

export function agentOf(fields: Fields): string {
  const agent = fields?.agent;
  return typeof agent === "string" && agent.length > 0 ? agent : DEFAULT_AGENT;
}

/**
 * Whether it runs.
 *
 * `=== true` rather than `!== false`, which is the same test the handler makes
 * and for the same reason: a routine written by hand, or by an agent, carries
 * no field at all, and a missing answer must not read as consent.
 */
export function enabledOf(fields: Fields): boolean {
  return fields?.enabled === true;
}

/** How often it is carried out, in the words a row has room for. */
export function everyLabel(every: string): string {
  return INTERVALS.find((interval) => interval.id === every)?.brief ?? every;
}

/**
 * The row every other row hangs from. Never drawn — a source list shows its
 * contents, not a row standing for the list itself.
 */
export const TREE_ROOT = "/root";

/**
 * Row ids, and why both halves are prefixed.
 *
 * A tree states selection and expansion in ids, so one namespace has to hold a
 * record key and a folder path without either being able to spell the other. A
 * key is the store's and a path is the project's, and neither promises to avoid
 * the shape of the other — so the prefix is what makes the answer to *what is
 * this row* a read rather than a guess.
 */
export const routineRow = (key: string) => `routine:${key}`;
/**
 * The whole list, which is the top of the hierarchy the folders are in.
 *
 * A row of its own rather than the tree's invisible root, and it earns that by
 * being **the only way back out of a folder by dragging**. A routine could be
 * dragged into a group and never out again: every folder took drops and nothing
 * stood for *no folder*, so the gesture worked in one direction only. It is the
 * same row `Records` gives each of its types and `Tasks` gives its register,
 * and it is spelled the way they spell it.
 */
export const ROOT_ROW = "/all";
/**
 * The heading the archived routines hang under. A row of the tree and the
 * subject of none: `rowSubject` answers `null` for it, which is what keeps a
 * heading from being selected as though it were a routine.
 */
export const ARCHIVED = "group:archived";
export const folderRow = (path: string) => `folder:${path}`;

/** What a row is, read back from its id. */
export function rowSubject(
  id: string | null,
): { routine: string } | { folder: string } | null {
  if (id === null) return null;
  // The top of the hierarchy is the root folder, said in the tree's vocabulary
  // rather than in a third one: everything that acts on a folder — where a new
  // routine is written, what a drop means — then works there without branching.
  if (id === ROOT_ROW) return { folder: "" };
  if (id.startsWith("routine:")) return { routine: id.slice("routine:".length) };
  if (id.startsWith("folder:")) return { folder: id.slice("folder:".length) };
  return null;
}

/** The folder above this one, or `""` for one at the top. */
export function parentOf(folder: string): string {
  const cut = folder.lastIndexOf("/");
  return cut === -1 ? "" : folder.slice(0, cut);
}

/** The last segment of a path, which is what a row is labelled with. */
export function nameOf(folder: string): string {
  const cut = folder.lastIndexOf("/");
  return cut === -1 ? folder : folder.slice(cut + 1);
}

/**
 * The branches that have to be open for one folder to be visible.
 *
 * A row inside a closed branch is a selection nobody can see, so anything that
 * moves the selection into a folder opens the folder *and everything above it*.
 * Opening only the immediate parent left a new folder two levels down invisible
 * and the column apparently unchanged.
 */
export function openTo(expanded: readonly string[], folder: string): readonly string[] {
  const wanted: string[] = [];
  let path = folder;
  while (path !== "") {
    const row = folderRow(path);
    if (!expanded.includes(row) && !wanted.includes(row)) wanted.push(row);
    path = parentOf(path);
  }
  return wanted.length === 0 ? expanded : [...expanded, ...wanted];
}
