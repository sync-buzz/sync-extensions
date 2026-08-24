# Project memory

Five kinds of claim about this project: what was chosen, what is forbidden,
what was found, what is unresolved, and what is worth pointing at. They outlive
the conversation that produced them and travel with the repository. Nothing here
tracks work — no tasks, no plan — and nothing here is a conversation.

## Which kind to write

**decision** — one chosen path, the reason for it, and what it beat. The
choice, not a summary of the discussion.

**constraint** — one rule the project holds to, and what breaks when it is
violated.

**observation** — one non-obvious fact about the system, with the evidence for
it. What is true, not what ought to be.

**question** — one unresolved fork, and its answer once it has one. Raise these
yourself: the moment you are about to ask the user something whose answer is
not already recorded, write the question first, then ask. If the conversation
ends, the next session finds it open instead of losing it.

**artifact** — a pointer to something produced outside this memory: a design
file, an issue, a gist. The record says what it is for; the thing stays where
it is.

**A document is a narrative, not a claim store.** A project keeps prose of its
own — guides, overviews, the files of a folder somebody attached — and it is
written to be read end to end. When you catch yourself writing a settled choice,
a hard rule or a non-obvious fact into one, stop: it belongs in a record of the
five above, linked from the document. A claim buried in prose is invisible to
freshness — nothing can flag that one paragraph rotted — and unreachable by a
link, because nothing can point at a sentence.

## The schema

Every record is an envelope: `key`, `kind`, `title`, `content` (Markdown),
`tags`, `links`, `paths_observed`, `scope_paths`. Freshness and the archive flag
are on it too and are not yours to state. Each kind adds this, and the engine
refuses a field or a relation the type does not declare:

- **decision** — no fields. Relations: `supersedes` → decision, `references` → any.
- **constraint** — no fields. Relations: `references` → any.
- **observation** — no fields. Relations: `references` → any.
- **question** — `status`: `open` | `answered`, required, starts at `open`.
  `answer`: prose, written when it is answered. `options`: a list of strings,
  when the answer is a choice rather than free text. `multi_select`: true when
  more than one option may be chosen. Relations: `answered_by` → decision,
  `references` → any.
- **artifact** — `url`: required. `source`: `figma` | `url` | `file` | `gist` |
  `other`, default `url`. Relations: `references` → any.

Keys are `<kind>-<six hex characters>`: `decision-3ad25f`, `observation-bb8cb8`.
You choose one when you create a record and it is permanent: there is no rename,
and every link points at it.

`scope_paths` is what makes freshness work — the engine marks a record stale
when the code under those paths changes. A claim about code with no scope path
is a claim nothing can ever flag. `paths_observed` is the evidence: the files
you actually read to write it.

## How to write one

Two readers, neither able to ask you a follow-up: the next agent rebuilding
context, and the person skimming the window.

- **Never write a secret.** This memory travels with the repository. Name where
  a secret lives — an environment variable, a vault entry — never its value. If
  you find one already stored, say so plainly: it is in Git history, so it must
  be rotated rather than deleted.
- **One fact per record.** A decision records one decision; a constraint states
  one rule. Splitting is what lets freshness flag exactly what rotted and a link
  point exactly at what it depends on.
- **Decompose what you ingest and what you produce.** A long explanation from
  the user, or your own write-up at the end of a task, is never one record.
- **Lead with the conclusion.** The title states the claim outright and the
  first line lands it. No "This document describes…" — the kind already says
  what it is.
- **Factual and scannable.** Bullets over prose. State what is true; explain why
  only where the what does not make it obvious.
- **Plain words, at the reader's level.** The person reading the window is often
  not an expert in this code. Gloss a load-bearing term in a few words, or pick
  a plainer one.
- **Concrete over abstract.** Name the file, the function, the line:
  `src/lib/record-link.ts:120`.
- **Diagram when structure beats prose.** A fenced `mermaid` block renders as a
  diagram in the window. Reach for one when a relationship is easier to see than
  to read.
- **One paragraph, one line.** No hard wrapping inside a paragraph; a blank line
  between them. Breaks that carry structure — list items, table rows, the lines
  of a fence — stay.
- **Write in the project's language.** `sync_project` says which one. It is the
  language a person reads in the window, not your default.

## Linking

Two different things, and a good record carries both.

**In the prose, a link is a readable name.** Write
`[the title of the record](sync://<kind>/<key>)`. Never put a bare key in a
sentence: it is unreadable and tells the reader nothing, while the title tells
them whether to follow it. You already hold both — every search hit and every
listing carries the title, the kind and the key.

    Superseded by [Freshness is derived, never declared](sync://project-memory.decision/decision-3ad25f).

For a document that is a file in an attached folder, link the file the way
GitHub does: `[Setup](./setup.md)`, `[ADR 7](../adr/0007.md)`, or
`[Index](/docs/index.md)` from the repository root.

**In `links`, a link is typed**: `{"key": "…", "relation": "supersedes"}`. That
is what the window's relations panel shows and what the engine validates against
the type; a relation the type does not declare is refused.

Write the typed link when the relation is one the type declares, and the prose
link wherever a reader would otherwise have to go looking.

## Freshness

Every record carries a state the engine derives rather than anybody declaring:
it reconciles code history against the record's scope paths.

- `fresh`, `unverified` — usable.
- `stale`, `invalid` — the code moved under the claim. **A flag, never a fact.**
  Do not quote the body as true. Read the paths it covers, then say which of
  three it is: the claim still holds, it needs editing, or it is obsolete. Say
  it in one line before you act on it.

Live code is the final arbiter. A record that disagrees with what the code does
is a record to fix, not evidence — and fixing it is part of shipping the change,
not a chore for later.

When you start work in an area, notice how much of what you would rely on is
flagged. If a large share of it is, say so before starting rather than
afterwards: a revision pass costs a session, and those records will mislead the
work either way.

## The loop

1. `sync_project` — the kinds this project holds and the language it writes in.
2. `memory_search` the topic before acting. Read `matched` on each hit: `words`
   and `both` are matches, `meaning` alone is the nearest thing rather than an
   answer.
3. `memory_list_records` with `kind: "project-memory.question"` before you ask
   the user anything — an open question may already be waiting for exactly the
   answer you are about to produce.
4. Trust-check what you rely on, by freshness.
5. Write with `sync_apply` the moment something is true, not at the end of the
   task. Correct what your change falsified in the same session.
6. **Say what you wrote, in one line.** "Recorded `decision-3ad25f`; edited the
   constraint it contradicted." The user can then push back before it becomes
   history. A silent write is the worst outcome.
