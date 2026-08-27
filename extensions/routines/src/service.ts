import { memory, work, type Handlers } from "@sync-buzz/extension-api/service";

/**
 * The half of Routines that runs with no screen.
 *
 * One handler per interval the manifest declares, and each does the same thing:
 * read the routines this project holds, take the ones set to its own interval
 * and switched on, and order the work. Ordering is all it does — a handler is
 * gone in milliseconds and the agent it asked for may run for an hour, so what
 * happens after the order is Sync's.
 *
 * # Why four handlers rather than one with a stored clock
 *
 * A handler may read the corpus and may not write to it, so there is nowhere to
 * record *when this routine last ran*. Four intervals declared in the manifest
 * put that bookkeeping where it already exists: Sync stamps each handler, and a
 * routine picks which handler it belongs to by naming an interval. The cost is
 * that the intervals are a fixed set rather than a number somebody types, which
 * is also the honest thing to offer — an agent asked something every three
 * minutes is a bill, not a routine.
 */

const KIND = "routines.routine";

/** The intervals a routine may name, and the handler that carries each out. */
const EVERY = {
  quarterly: "15m",
  hourly: "1h",
  sixHourly: "6h",
  daily: "24h",
} as const;

interface Ordered {
  readonly key: string;
  readonly title: string;
  readonly work: string;
}

/**
 * A record as this half of the package reads it.
 *
 * Open, because an envelope is: its members are the engine's, a type adds its
 * own beside them, and a shape written out here would be a second vocabulary
 * going stale at its own rate.
 */
type Envelope = Record<string, unknown>;

/**
 * The envelope inside whatever `memory.record` answered.
 *
 * A record crosses as its envelope — `key`, `kind`, `title`, and the fields the
 * type declares as members beside them. This is here for the older Sync that
 * hands the store's durable representation across instead,
 * `{representation, envelope}`, and it is recognised by the tag rather than by
 * the `envelope` member: `envelope` is not a name the store reserves, so a type
 * is free to declare a field called that.
 *
 * **This is where the routine that never ran was hiding.** The first draft read
 * `record.fields`, which is what the *window* is handed and what no handler
 * ever gets. Every routine came back with `fields` undefined, every one failed
 * the `enabled !== true` test, and the clock ticked for a day ordering nothing —
 * with no error, because nothing is not an error.
 */
function envelopeOf(record: Envelope): Envelope {
  if (typeof record.representation === "string") {
    const inner = record.envelope;
    if (inner !== null && typeof inner === "object") return inner as Envelope;
  }
  return record;
}

/**
 * Carry out every routine set to one interval.
 *
 * Reading each record in turn rather than trusting the listing: a listing row
 * carries what a list needs to draw — key, kind, title — and the fields a
 * routine is *made* of are on the record. Ten routines is ten reads against a
 * local engine, which is cheaper than the wrong answer.
 */
async function carryOut(every: string, project: string): Promise<Ordered[]> {
  // `kind`, singular. The engine ignores `kinds` without saying so, which reads
  // as "no filter" — every record in the project, quietly.
  const listing = await memory.list({ kind: KIND, limit: 200 });
  const ordered: Ordered[] = [];

  for (const row of listing.records) {
    const key = typeof row.key === "string" ? row.key : null;
    if (key === null) continue;

    const view = await memory.record(key);
    if (view.record === null) continue;
    // The fields a routine is made of are members of the envelope, beside the
    // key and the title rather than under anything.
    const record = envelopeOf(view.record as Envelope);

    // An archived routine is one somebody took out of the lists. Running it
    // would be the one place in Sync where archiving does not mean "out of the
    // way".
    const archive = (record.archive ?? {}) as Record<string, unknown>;
    if (archive.archived === true) continue;

    // Switched off is the default, and it is checked as `!== true` rather than
    // as `=== false`: a routine written by hand, or by an agent, has no field
    // at all, and a missing answer must not read as consent.
    if (record.enabled !== true) continue;
    if (record.every !== every) continue;

    const body = await memory.content(key);
    const text = (body.content ?? "").trim();
    // A routine with no body is a routine with nothing to ask. Raising an agent
    // to hand it an empty instruction spends tokens to be told nothing.
    if (text.length === 0) continue;

    const title = typeof record.title === "string" ? record.title : "Routine";
    const agent = typeof record.agent === "string" ? record.agent : "claude";

    ordered.push({
      key,
      title,
      work: await work.order({
        kind: "agent.session",
        agent,
        title,
        // Which routine this run is of, and it is what makes the next line
        // mean anything: the slot a conversation replaces is named by a record.
        about: key,
        prompt: { text: instruct(text, project) },
        // The whole point of a routine is that it finishes without anybody
        // there. A routine that waited for a person to come back would be a
        // reminder, which is a different product.
        onInterrupted: "continue",
        // One conversation per routine, and it is the run you have not read
        // yet. A routine on fifteen minutes is ninety-six runs a day; a project
        // keeps a hundred conversation pointers, so a week of this without a
        // slot is a list holding nothing but one instruction repeating.
        //
        // What is lost is comparing this run with yesterday's, and that is the
        // honest trade: the account of *every* run is the journal's, and a
        // conversation worth keeping is kept as a record — which this leaves
        // alone.
        keep: "latest",
      }),
    });
  }

  return ordered;
}

/**
 * What the agent is actually sent: the person's instruction, and the two facts
 * it cannot know about the occasion.
 *
 * **Said once, here, rather than in every routine somebody writes.** That it is
 * unattended is what changes an agent's behaviour most — no questions can be
 * asked, and nothing that waits for an answer will get one — and a person
 * writing their third routine should not have to remember to repeat it.
 *
 * What it deliberately does *not* say is anything about speaking. Whether the
 * machine has a voice, and whether this agent may use it, is Sync's answer and
 * the agent already has it: `sync_speak` is in its tool catalogue when it is
 * allowed and absent when it is not. A line here telling it to speak would be
 * this package guessing at a setting it cannot read.
 */
function instruct(text: string, project: string): string {
  return `${text}\n\n---\nThis is a Sync routine, running on a clock in ${project}. Nobody is watching: there is no one to ask, and anything you wait for will not arrive. If there is nothing worth reporting, stop and say nothing.`;
}

export default function register(): Handlers {
  const on = (every: string) => async (payload: { project: { path: string } }) => {
    const project = payload.project.path;
    const ordered = await carryOut(every, project);
    // One line per tick with what it did, which until the journal exists is the
    // only account of a routine there is. Silence is a real answer and is said
    // as one: nothing switched on is not the same as nothing happening.
    console.log(
      ordered.length === 0
        ? `every ${every}: nothing switched on`
        : `every ${every}: ordered ${ordered
            .map((one) => `${one.title} (${one.work})`)
            .join(", ")}`,
    );
    return { ordered };
  };

  return {
    "routines.quarterly": on(EVERY.quarterly),
    "routines.hourly": on(EVERY.hourly),
    "routines.sixHourly": on(EVERY.sixHourly),
    "routines.daily": on(EVERY.daily),
  };
}
