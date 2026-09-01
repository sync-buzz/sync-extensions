# Tasks

The work this project has committed to. One task is one record of kind
`tasks.task`. Its key is its number: permanent, and what every link resolves to
— but it is an address, not a name. In a sentence a task is called by its
title, carrying the address:
`[Fix the login redirect loop](sync://tasks.task/task-3ad25f)`. A bare key
tells whoever reads it nothing and opens nothing.

A task asks for something to be done. It is not a claim about the project, and
nothing here replaces the records that hold those: a settled choice is a
decision, a rule is a constraint, something you found out is an observation. If
you catch yourself writing *why we do it this way* into a task, that sentence
belongs in a record of the kind that keeps it, linked from here.

Do not write a task for work you are about to do in this same conversation. A
task is a note to somebody who is not here — the next session, the next person,
an agent nobody has raised yet. Work you are doing now is done, not filed.

**Being asked to set a task is being asked for this record.** Somebody saying
*set a task*, *file a task* or *put that in the tasks* means one written here,
with `sync_apply`, where it will still be tomorrow. Whatever your own harness
calls a task — a sub-agent, a checklist of your own, a plan you keep in the
conversation — is not one: those end when the turn does, and nobody but you can
open one. Where the request could be read either way, the one that leaves a
record is the one that was asked for.

## The shape of one

Three sections, in this order, and nothing else. Write them in the project's
language — `sync_project` says which.

```markdown
## What to do
One or two sentences. What changes, and where.

## Done when
- [ ] a criterion an agent can settle
- [ ] another one

## Out of bounds
- what this task must not touch
```

**The title is an instruction, not a topic.** A verb and its object, under
sixty characters: *Fix the login redirect loop*, not *Login redirect*. Somebody
scanning the list has to know what they would be agreeing to do.

**`Done when` is the whole point of the record.** It is an ordinary Markdown
task list, which means a person ticks a box with the mouse and you write `- [ ]`
and `- [x]` — the same list, one spelling. Between two and five items. One item
is usually the title said twice; more than five is a task that should have been
split.

**`Out of bounds` is not optional padding.** It is what keeps an agent from
rewriting three modules to close one criterion. Leave it out only when there is
genuinely nothing adjacent to break.

**This shape is read back.** Not the headings — a project writes those in its
own language — but the three things they hold: prose that says what to do, a
task list that decides when it is finished, and plain bullets that say what is
out of bounds. A task missing any of them is marked as missing it in the panel
beside it, and an agent handed such a task is told to repair the record before
it starts anything. Writing it properly the first time costs less than either.

## A criterion has to be checkable, or it is not a criterion

Every item under `Done when` must be settleable by an agent, by one of four
means, and it is worth naming which:

- **Running something** — a test, a build, a lint, a command with an exit code.
- **Reading the code** — a named file contains, or no longer contains,
  something specific.
- **Running the application** — a stated sequence produces a stated result on
  screen.
- **Reading a record** — something is written in the project's memory.

A criterion nobody can settle produces a task nobody can close, and a register
of tasks nobody closes is a tip. So these are refused:

| Refused | Why | Instead |
| --- | --- | --- |
| Improve performance | No number, so nothing decides it | The list of 1000 records renders in under 100 ms, measured with the profiler |
| Make it more convenient | Convenient to whom, judged how | Deleting a tag takes one Backspace rather than finding the comma |
| Refactor `use-corpus.ts` | No stated end state | `use-corpus.ts` no longer parses a list on every keystroke; the existing tests pass unchanged |
| Cover it with tests | Cover what, to what depth | There is a test for an empty list, for adding, and for a refused write |
| Check whether X works | Checking is not a change | Either a criterion that states what X must do, or a question record — this is not a task |

**Something only a person's eye can settle is still allowed**, and it is written
as what would be on screen: *the selected row is distinguishable in greyscale*.
An agent takes it as far as showing the result; the person deciding is the
person who reads it. Say so in the criterion rather than pretending it is
automatic.

## The schema

Every record is an envelope — `key`, `title`, `content`, `tags`, `links`,
`scope_paths`, `paths_observed`, the archive flag — and this type adds three
fields. The engine refuses anything the type does not declare.

- **`status`** — `todo` | `in_progress` | `in_review` | `blocked` | `done` |
  `canceled`. Required, starts at `todo`.
- **`priority`** — `high` | `normal` | `low`. Required, starts at `normal`.
  Leave it at `normal` unless you can say what is worse if it waits. A register
  where everything is `high` sorts nothing.
- **`type`** — `feature` | `fix` | `refactor` | `chore` | `docs` | `test`.
  Required, starts at `feature`. This is read before the body: it decides which
  skills to load and what counts as evidence.

Relations: `references` → any record this task rests on — the decision that
called for it, the observation that exposed it. `subtask_of` → another task.

**Do not give a task `scope_paths`.** Freshness is the engine reconciling code
history against a record's claim about the code, and a task claims nothing about
the code — it asks for a change to it. Scoped, every task would be marked stale
by the very commit that closed it. `paths_observed` is fine and useful: it is
what you actually read.

It follows that a task is always `unverified` and that `verified: true` on one
is refused. Nothing is wrong: verification is for claims, and this is a
request. What the work *found out* goes in the records that hold claims, and
those are the ones worth verifying.

## Status, and who moves it

```
todo ──▶ in_progress ──▶ in_review ──▶ done
             │                          ▲
             ├──▶ blocked ──▶ todo      │
             └──▶ canceled              └── only a reader, never the worker
```

Move it as it happens, not at the end:

- **`in_progress`** — the moment you start. Before reading the code, not after
  writing it. A task somebody else opens while you work must not look untouched.
- **`in_review`** — every box under `Done when` is ticked and you have said in
  `Progress` how each one was settled. This is as far as you go.
- **`done`** — **never yours.** Whoever did the work is the last person who
  should judge it. Leave it at `in_review` and say what a reviewer should look
  at.
- **`blocked`** — you cannot go on without an answer. Write the question in
  `Progress` as one sentence, in `blocked`, and stop. Do not guess and do not
  quietly do something adjacent instead.
- **`canceled`** — the task should not be done at all. Say why in `Progress`.
  Not for *not now*: that is a task left in `todo`.

**A closed task is archived.** Setting `done` or `canceled` and archiving are
one act — `status` and `archived: true` in the same write. The register lists
what is open, and the count on the section's row is what remains. Nothing is
lost: an archived record keeps every link, is found by search, and comes back
with `archived: false`.

Every other write should say nothing about `archived`, and then nothing happens
to it. A task put away last month stays away while you add a `Progress` line to
it.

## Reporting back into the task

When you have worked on a task, its record is where the account of it goes. A
fourth section, added when there is something to say:

```markdown
## Progress
- 2026-08-26 · in_progress · classified as fix, area `src/lib/memory`, loaded the tdd skill
- 2026-08-26 · Reproduced it: the redirect loops when the session expires mid-request, `client.ts:214`
- 2026-08-26 · in_review · all four criteria settled; the third was checked by hand, `pnpm test` passes
```

One line per entry: the date, the state if it changed, and what became true.
Name the file and the line rather than describing the neighbourhood. A dead end
is worth a line too — it is what stops the next agent walking into it.

**What does not go here.** The transcript of your reasoning, a diff, a list of
everything you read, or a summary of the code. The conversation already holds
those and it is kept in Chat. This section is what somebody needs who never saw
that conversation: three lines, not thirty.

## Before you touch anything

Handed a task, do these three in order and say so in one line — this is the
first entry in `Progress` and the point at which the task moves to
`in_progress`:

1. **Classify.** What kind of change is it really, and does that agree with
   `type`? A task filed as `feature` that turns out to be a `fix` is worth
   correcting on the record, not silently working around.
2. **Name the area.** Which files this touches, before you open them. If you
   cannot, that is the first thing to find out and the first line to write down.
3. **Load the skills.** What you pull is decided by the type and the area
   together — the testing skill for a `test`, the platform's own guidance for
   anything that changes the window, the project's design foundation before
   anything visual. Say which you loaded and why, in the same line. Loading
   nothing is an answer, and it is worth stating as one.

Then read `Out of bounds` again and stay inside it. If the work cannot be done
inside those bounds, that is `blocked` and a sentence, not permission to widen
them.

## Splitting

A task whose `Done when` runs past five items, or whose parts could be worked on
by different people at once, is two tasks. Write them as separate records with
`subtask_of` pointing at the original, and leave the original holding only what
is left of it.

**Do not split for the sake of parallelism you are not going to use.** Two tasks
that must be done in order, by the same hands, are one task with two criteria.

## Where a task is filed

Tasks are grouped in folders, and the grouping is by **what the work is about**
— a subsystem, a release, a part of the product. Never by status, priority or
type: those are fields, the register groups and sorts by them on its own, and a
folder called `in progress` would be a second answer to a question the record
already answers, going out of date the moment somebody moves the task on.

A folder is a name until somebody says what it is for, and what it says is an
ordinary document filed in it. **Read that before filing anything into it** — it
is the whole of how a folder means the same thing to you as to whoever made it.

- `memory_list_folders` with `kind: "tasks.task"` — how this project already
  groups its work, how many tasks sit in each group, and which of those groups
  has a record describing itself. Read that record before filing into it.
- `sync_apply` with `folder` on the task — write it where it belongs in the one
  call that writes it, rather than loose and moved afterwards. The same member
  on a task that already exists is how one is refiled; there is nothing else to
  call.
- A group nobody has made yet is made by filing something into it: the folder is
  the name in `folder`, and it exists because a record says so.
- `sync_apply` with `is_folder: true` — the record that *is* that folder, saying
  what belongs in it in a sentence or two. A folder made and left undescribed is
  a word the next agent has to guess at, and it will guess differently.

**Make a folder only when the work does not fit one that exists.** Three tasks
with something in common are a group; one task in a folder of its own is a task
with a longer name. Nesting is the same judgement again: a folder three deep is
work filed where nobody browsing will look for it.

**The record that *is* a folder is not a task.** It carries no status, no
priority and no type — the engine does not hold it to this type's fields, and
nothing counts it among the folder's tasks. What it holds is what belongs there,
and what does not.

## The loop

1. `sync_project` — the kinds this project holds and the language it writes in.
2. `memory_search` before writing a task: the thing may already be filed, or may
   be a question nobody has answered rather than work anybody has agreed to.
3. `memory_list_records` with `kind: "tasks.task"` and `status: "todo"` before
   proposing new work. An open register is the answer to *what should I do next*.
   `memory_list_folders` beside it is the answer to *where does this go*, and it
   is read before a task is written rather than after.
4. Write with `sync_apply` the moment something is true — the state when it
   changes, the `Progress` line when it happens — not in one write at the end.
5. **Say what you wrote, in one line, naming the task rather than its key.**
   "Moved [Fix the login redirect loop](sync://tasks.task/task-3ad25f) to in
   review; recorded what settled each criterion." A silent write is the worst
   outcome.
