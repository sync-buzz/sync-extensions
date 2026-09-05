/**
 * The terminals themselves, held outside the layout that arranges them.
 *
 * **This is the one structural decision in the package.** A tile is an empty
 * box; the terminal's element is created once, here, and put into whichever box
 * is currently drawing it. It was measured before it was written: with the
 * terminal owned by the tile component, moving it out of one arrangement and
 * into another destroyed it — history from ninety lines to twenty-four, and the
 * process talking to a screen nobody could see.
 *
 * What it buys beyond that is that the layout library never owns anything that
 * matters. Splitting, resizing, hiding a tab and reloading the window are
 * rearrangements of empty boxes.
 */

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import { door } from "./host";

/** One terminal, and everything about it that is not a React render. */
export interface Screen {
  /** What the host calls it. */
  readonly name: string;
  /** Created once and moved between tiles. Never re-created. */
  readonly element: HTMLDivElement;
  readonly terminal: Terminal;
  readonly fit: FitAddon;
  /** How far into the output this screen has been told. */
  offset: number;
  /** How the process finished, once it has. */
  exit: { code: number; signal: string | null } | null;
  opened: boolean;
}

const screens = new Map<string, Screen>();

/**
 * The screen the keyboard is owed, once there is one to give it to.
 *
 * A shell is raised before the tile that draws it exists, so "put the caret in
 * the one I just made" cannot be done where it is asked for. It is written down
 * here and honoured by the first `attach` that answers to the name — which is
 * the moment the screen first has somewhere to be.
 */
let owed: string | null = null;

/**
 * The colours a terminal draws its own chrome in, taken from the window.
 *
 * Only the four that are the *window's* to decide: the surface, the text, the
 * caret and the selection. The sixteen a program picks from are deliberately
 * left at the emulator's own — those belong to whatever is running, not to
 * Sync, and a window that recoloured somebody's `ls` would be answering a
 * question nobody asked it.
 */
function palette(from: HTMLElement) {
  const style = getComputedStyle(from);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    background: token("--surface-workspace"),
    foreground: token("--text-primary"),
    cursor: token("--text-primary"),
    cursorAccent: token("--surface-workspace"),
    selectionBackground: token("--state-selected"),
  };
}

/** Base64 to bytes. Output crosses encoded because a chunk can end mid-character. */
function bytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    out[index] = binary.charCodeAt(index);
  }
  return out;
}

/** Raise a shell and take a screen for it. */
export async function open(project: string, cwd: string): Promise<Screen> {
  const name = await door().open({
    project,
    cwd,
    // A size nothing has measured yet. The first fit after it is attached is
    // what the far end is actually told, and it happens before anything is
    // typed — but a pty has to start at *some* size, and the classic one is
    // the one every program already copes with.
    size: { rows: 24, cols: 80 },
  });

  const element = document.createElement("div");
  element.className = "absolute inset-0";

  const terminal = new Terminal({
    // The system's monospaced face, in the order macOS resolves it.
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: 12,
    cursorBlink: true,
    // Option composes characters on this system — Option-3 is a hash, not a
    // meta key — and Terminal.app ships with the same answer. Somebody who
    // wants meta is somebody who will go and ask for it.
    macOptionIsMeta: false,
    // Secondary click belongs to the system menu this package draws, not to
    // the emulator's own idea of what to do with it.
    rightClickSelectsWord: false,
    scrollback: 5000,
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);

  const screen: Screen = { name, element, terminal, fit, offset: 0, exit: null, opened: false };
  screens.set(name, screen);
  return screen;
}

/**
 * Put the keyboard into one shell.
 *
 * Dividing a tab and then having to click the half that appeared is the whole
 * of what this is for: the command that made it is the command that meant to
 * work in it, which is what every terminal on this system does.
 */
export function focusOn(name: string): void {
  const screen = screens.get(name);
  if (screen?.opened && screen.element.isConnected) {
    screen.terminal.focus();
    return;
  }
  owed = name;
}

/**
 * Put a screen into a box, opening it the first time and only then.
 *
 * Everything after the first time is a move: the element is appended somewhere
 * else and the emulator is not told, because nothing about it has changed.
 */
export function attach(screen: Screen, box: HTMLElement): void {
  box.appendChild(screen.element);
  const settle = () => {
    if (owed === screen.name) {
      owed = null;
      screen.terminal.focus();
    }
  };
  if (screen.opened) {
    fitTo(screen);
    settle();
    return;
  }

  screen.terminal.options.theme = palette(box);
  screen.terminal.open(screen.element);
  screen.opened = true;
  fitTo(screen);
  settle();

  screen.terminal.onData((data) => {
    void door().write(screen.name, data);
  });
  screen.terminal.onResize(({ rows, cols }) => {
    void door().resize(screen.name, { rows, cols });
  });

  void door().watch(screen.name, screen.offset, (event) => {
    if (event.kind === "output") {
      // Bytes were dropped, so what is on the screen is the top half of
      // something. Clearing says so; drawing the rest on top of it would not.
      if (event.gapped) {
        screen.terminal.reset();
      }
      screen.terminal.write(bytes(event.base64));
      screen.offset = event.to;
      return;
    }
    if (event.kind === "ended") {
      screen.exit = { code: event.code, signal: event.signal };
    }
  });
}

/**
 * Measure the box and tell the far end.
 *
 * Guarded because a box that has not been laid out — or is behind another tab —
 * measures nothing, and `fit` on a zero-sized element throws rather than
 * declining.
 */
export function fitTo(screen: Screen): void {
  const box = screen.element.parentElement;
  if (!box || box.clientWidth === 0 || box.clientHeight === 0) {
    return;
  }
  screen.fit.fit();
}

export function held(name: string): Screen | undefined {
  return screens.get(name);
}

/** End one, and let go of everything drawn for it. */
export function close(name: string): void {
  const screen = screens.get(name);
  if (!screen) {
    return;
  }
  if (owed === name) {
    owed = null;
  }
  screens.delete(name);
  screen.terminal.dispose();
  screen.element.remove();
  void door().close(name);
}
