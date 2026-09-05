# Changelog

## 0.2.5

Rebuilt against a moved contract, and nothing else.

The extension surface is at 3.10.0, and every module here is compiled against
it — so this package comes out as a different file though not a line of it was
edited. A released version is immutable, which is why the number moves rather
than the bytes under it. Nothing it does has changed.

## 0.2.4

Filing a task, archiving one, and what the word *task* means.

Three things the instructions got wrong about the surface they describe. The
section on folders named five calls that do not exist — filing is `folder` on
the write itself, and the record describing a folder is `is_folder: true` on
one. Archiving a closed task is `archived: true` in the same write that closes
it, which is now sayable and now said. And *set a task* meant, to an agent
carrying its own harness, a sub-agent or a private checklist: the record is
what was asked for, and this says so.

The brief a task is handed to an agent with now names the project. Every call
to Sync's memory names one and there is no default, so the agent was spending a
call to find out which of the machine's projects it was standing in — or
guessing, and writing its report into somebody else's memory.

## 0.2.3

Rebuilt against a newer contract, and nothing else.

The module is built against the contract, and the contract moved to 3.4.0 — the
surface gained the working tree a conversation is held in. Nothing here uses it
and nothing here changed, but the built module is not the same file, and a
version that has been published is immutable. So the number moves rather than
the bytes under it.

## 0.2.2

A task is called by its title, not by its number.

This opened by saying that a task's key is *what every conversation about it
refers to*, and closed with an example doing exactly that. Both were wrong in
the same way: a key is permanent and is what every link resolves to, and it is
still an address rather than a name — whoever reads a sentence holding one
learns nothing from it and cannot open it. Both now name the task and let the
link carry the number.

## 0.2.1

The register's rows say what a task is, and its headings stop pretending to be
rows.

Every row carries the mark this window draws a record of a kind with, which is
the left edge a list is read down rather than anything new about the task. The
line under the title is built as a list of what is actually known — the key
first, because a key *is* the task's number and is the one thing always there —
so the separators between the facts cannot disagree with what is drawn. The
version that spelled each one beside its own value put a stray `·` at the head
of the line the moment the first value was missing.

A status heading is now a heading: the weight, colour and size the navigator's
own group labels use, with no rule under it. A line that only separates a label
from what it labels divides nothing, and the rows below already carry their own.

The empty state says what happened in fewer words.

## 0.2.0

First release.
