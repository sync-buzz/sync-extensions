# Changelog

## 0.1.0

Shells in this project's folder, in tabs and tiles.

A terminal here is started the way this machine starts one — your login shell,
so the tools you installed are on the path — in the project's own folder. Tabs
hold as many tiles as they are split into: drag a divider to change how the
space is shared, close a tile and its neighbour takes the room back.

**What runs is held by Sync, not by the screen showing it.** Leaving this
section, hiding a tile behind another tab, resizing the window, reloading —
none of them reaches the process. A build started before lunch is where it got
to when you come back. Closing the project is what ends them, and nothing else
is.

This package runs commands in the project's folder as you, which is what a
terminal is; nothing it does is narrower than that, and the card says so in
those words rather than in a sentence about processes.

Needs Sync 0.11 or newer: the shell it opens is held by the application, and
older builds have nowhere to put one.
