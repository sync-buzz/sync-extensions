# Changelog

## 0.3.1

Opening a folder showed every routine in the project.

The read is deliberately not narrowed to the folder — 0.3.0 says why — which
left the cut to the surface, and the surface never made it: the rows were
filtered by the archive flag and by nothing else. Every view drew the whole
page.

What decides a row is now a function of the records and the view, and it is
tested directly rather than looked at. That is the repair behind the repair: a
folder's view lives in the provider's state, so no static render reaches it,
and a filter that was never written passed every check there was. Thirteen
cases now ask it what belongs where — the root against a named folder, a folder
against the one nested under it, the archive against both.

A folder's count comes from the same page its rows do. The engine counts every
document filed in a folder, archived ones included; a folder holding two live
routines and one put away said three on its row and drew two beneath it.

**The checkbox has gone from the row.** A checkbox in a list is how a list says
*this one is chosen* or *this one is done*, and a routine is neither. Nor does
any list in this window carry a control: a row in Records and a row in Tasks is
a mark, some text and a second mark, with the whole row one button.
`design-foundation.md` §466 does say a flag is a checkbox — about the panel
beside the record, which is where this one still is.

So a row says whether it runs in words, the way §284 has a row say a state, and
in both directions: a row that fell silent when a routine was off would put the
answer in an absence, and *nothing here is running* is what somebody most needs
to see. Switching one on or off is the secondary button, or the flag in the
inspector.

## 0.3.0

The navigator is where you stand; the surface beside it is what is there.

0.2.x put the routines themselves into the tree, under the row that stands for
the whole list — so one triangle folded the entire section shut, and a row that
is not a folder behaved like one. That division is not this package's to
invent: Records draws its types and their folders in the navigator and its
records on the surface, and Tasks does the same with its register. This now
does what they do.

**The navigator holds three kinds of row and no others**: `All routines`, the
folders somebody made, and `Archived`. Every one is a place to stand. The
folder counts, the drop that takes a routine back out of a group, and the
archive as a place rather than a preference all stay exactly as they were.

**The surface holds the list**, which is the only place a row can carry a
control. Whether a routine runs is a decision somebody makes several times a
day, and on this system that is a checkbox in the row — Mail's rules keep one,
System Settings' login items keep one. It replaces the dimming 0.2.1 used, and
with it the last of the state the mark was carrying: the glyph says what a
routine is and the checkbox says whether it runs, which is the division
`design-foundation.md` §284 asks for.

Under each name: how often, which agent, and the folder it is filed in when the
list is not already one folder's. Writing a routine is `+` beside the list it
joins, where macOS puts the command that belongs to the content.

A folder's own description is a strip above its list rather than a button in an
empty column, and it opens the ordinary editor because it is an ordinary
document.

## 0.2.2

A routine could be dragged into a group and not out again.

Every folder took drops and nothing stood for *no folder*, so the gesture
worked in one direction only and getting a routine back out meant finding a
menu. `All routines` is that row — the top of the hierarchy the folders hang
from, carrying the drop that files something at the top. It is the row Records
gives each of its types and Tasks gives its register, spelled the way they
spell it.

It is a folder everywhere the rest of this column is concerned — where a new
routine is written, what a drop means — and two of the four folder commands are
refused on it rather than hidden: there is nothing above the top to rename it
into, and deleting it would mean deleting the list.

An archived routine no longer offers to be dragged. It would have moved and
stayed exactly where it is drawn, under `Archived`, which is not a folder — a
gesture that looks like it failed. Bringing it back comes first.

## 0.2.1

Four things 0.2.0 got wrong, and none of them was cosmetic.

**Folders were created and drawn nowhere.** Every answer the engine gives to
*what folders has this type got* carries an entry for the root — the records
filed nowhere — and this package took it for an ordinary folder. The folder
above `""` is `""`, so the root became its own parent, and every top-level
folder was hung under a row nothing reaches. The folders were written, were
returned, and were invisible; nothing could be filed into one, renamed or
deleted. The root is now what it always was — this tree's own root — and the
routines in it are the ungrouped ones drawn at the end.

The indent came back with them. `SourceTree` reserves the disclosure column
across the whole tree the moment one folder exists, and with no folder ever
reaching it the column stayed flat.

**The mark said two things at once.** A switched-off routine was drawn with a
struck-through alarm clock, which reads as a silenced alarm rather than an
automation that is not running — and it made a routine appear to change kind
when somebody switched it off. `design-foundation.md` §284 divides these: a
kind is a glyph, a state is a mark of its own, and neither is the other. Every
row now draws the mark the project's own type names, and *not running* is said
by dimming the row, which is the one device this system uses for it.

**Archived routines came back into the list as rows nothing told apart.** A
filter in the bottom bar returned them among the live ones, undimmed if they
happened to be switched on, which made archiving and deleting look like the
same word — the distinction §510 exists to keep. They are a place now: an
`Archived` group at the foot of the tree, with its own count, drawn only while
it holds something, the way an archived message is in a mailbox rather than
behind a preference over the inbox. The filter and the preference it stored are
gone.

Measured rather than argued: the fixture the columns are rendered against now
carries the root entry the engine really returns, which is what the first pass
left out and why the tree shipped broken.

## 0.2.0

Routines can be grouped, and managed from the list they are in.

**Folders.** The first column is a tree rather than a flat list: the folders a
person makes, the routines filed in each, and the ones filed nowhere below them.
They are the engine's own folders — the same ones Records draws — so what is
filed where travels with the repository, a folder can say what it is for, and a
routine is moved by dragging it onto a group or by `Move Out of Folder`.

**A row says whether it runs.** Every row used to be a title and one glyph, so
*what is running in this project* could not be answered without opening each
routine in turn. The mark carries it now — a clock, or a clock struck through,
with the quieter tier behind it — and the tooltip says the interval and the
agent. It reads the same in greyscale, and it spends no colour: switched off is
a setting rather than something going wrong.

**Nothing has to be opened to be acted on.** The secondary button on a routine
offers `Run Now`, `Switch On`/`Switch Off`, `Archive` and `Delete`, and the same
commands are in the bottom bar where a keyboard can reach them. Running one no
longer means opening it first: the instruction is the body, a listing does not
carry a body, so the run is ordered and starts when that read lands.

**Deleting asks first.** It opens the window's own confirmation, which tells the
project what links to the routine and what merely mentions it, rather than
deleting on the spot.

**Archiving means what it means everywhere else.** An archived routine leaves
the list — the handler already refused to run it — and the control on the
trailing edge of the bottom bar brings the archived ones back into view.

**A command the store refused says so**, in a strip above the record, in the
store's own words. Several of these commands write, and until now a refusal was
a control that appeared to do nothing.

**A routine opened from elsewhere arrives.** A search result or a backlink now
selects the routine it names, opening the folder it is filed in and un-hiding it
if it was archived. The area used to ignore the ask entirely.

**`+` moved out of the bottom bar.** That bar is where macOS keeps what acts on
a source list and never what the list contains, so writing a routine is in the
column's header, beside the name of the list it joins. The bar now adds a
folder, which is what it is for.

Needs Sync's extension API `^2.10`: a row carries the fields it draws, which is
what lets a list say whether a routine runs without opening it.

## 0.1.0

First release.
