# Changelog

## 1.2.0

The conversation starts, and what it is held with is chosen beside it.

`+ New conversation` opened a menu of five agents and would not go further until
one was picked. Most people pick the same one every day, so what stood between
wanting to say something and being able to was a question with a known answer.
It now opens a conversation with the agent this project was last held with — read
from the list, which already knows — and the caret is in the field.

Which agent, which model and which mode are a strip above the field, drawn as
pop-up buttons because each is a choice between mutually exclusive states. The
agent is a control until the first word and a fact after it: a conversation is
held *by* a process, and changing that would be a different conversation.

**Modes.** Plan, Accept Edits and Default on Claude Code, and whatever an agent
offers elsewhere. The agents have been stating these all along, in the same
answer the model options arrive in; nothing in the window read them, so the
choice a person makes several times an hour could not be made here at all.

The model picker has left the inspector, and that column is better for it: an
inspector says what is true of the thing in the workspace and does nothing to
it, which is the rule this window states and the one control there broke. It is
also the column that collapses, and below a certain width cannot be opened —
so the most frequent choice in the section lived in the one place that can go
away. It says the model now, as a fact, beside the mode.

**The menu lists the agents this machine can raise.** The four rows saying an
agent was not installed were four refusals in a list somebody opened to pick one
of the two that work. It is still said, once, under the list, and Settings ▸
Agents still lists every one. The catalogue the host answers with is unchanged:
an extension ordering work names an agent without consulting this column.

`⌘N` opens a conversation. `File ▸ New Conversation` is the same command, and it
is the one way to open one while the navigator is collapsed.

A conversation nobody has spoken in is a draft, and there is only ever one of
them: opening a second ends the first. Nothing is lost — a session with nothing
said in it writes no pointer — and three presses no longer leave three agents
running for three sentences nobody wrote.

Conversations an extension ordered are untouched by all of this. They keep their
own headings, they are raised the same way, and opening one now draws the same
mode control as one raised here.

**Reading back through a conversation no longer fights the agent writing it.**
Every chunk of an answer threw the view to the bottom, wherever the reader had
scrolled to, so the one moment somebody wants to check what was said earlier —
while the agent is working — was the one moment they could not. The end is now
followed only for a reader who is at it: scroll away and the stream stops moving
the view at all; come back within reach of the bottom and it resumes on its own.
A round control appears at the trailing edge while the end is not being
followed, and returns to it.

Needs Sync's extension API 2.12.0 for `ScrollArea`'s `viewportRef`, which is
what lets this panel read how far from the end it is. Stated as `^2.12` rather
than `^2.8`: on an older host the ref is dropped, and a conversation would stop
following the answer at all rather than follow it too eagerly.

## 1.1.0

Conversations are grouped by who asked for them.

An extension can order work now, and what it orders is an ordinary conversation:
it is in this list, it can be watched and stopped, and its name is whatever the
package called it. Until now nothing told it apart from a conversation somebody
started by typing, so setting an extension working on five things filled this
column with rows that had to be read one at a time to find out which was which.

Each extension that ordered something gets a heading of its own, with a count
and a disclosure. What nobody ordered stays under `Conversations` and leads,
because a person's own work does not move down the window because an extension
has begun some.

Splitting this list has been tried and reverted once — `Running` and `Not
running` — and it failed because a conversation changed group the moment it was
continued. Who *asked* cannot change: it is set when the work is ordered and
never edited, so a row stays where it is. Groups are ordered by their newest
conversation and rows within them by their own age, so "what happened last" is
still the top of the list.

Needs Sync's extension API 2.7.0 for `SessionRow.source`. On an older build the
field is absent, every conversation lands under `Conversations`, and this column
reads exactly as it did before.

## 1.0.1

The archive now carries the stylesheet it declares.

`1.0.0` named `ui/index.css` in its manifest and did not contain it, so Sync
refused to open the package after downloading it — the download succeeded, the
sha256 matched the registry, and the install failed at the last step. Nothing in
the extension itself changed.

## 1.0.0

First release.
