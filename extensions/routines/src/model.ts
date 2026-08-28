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
 * What the switch on a row is called, for anybody not looking at it.
 *
 * The control is a checkbox and the name has to say what ticking it does, not
 * what it is: *Read the inbox* beside a tick is a label a screen reader reads
 * as a routine's name twice.
 */
export function enabledLabel(record: { title: string; key: string }): string {
  const named = record.title.trim() || record.key;
  return `Run ${named} on its clock`;
}
