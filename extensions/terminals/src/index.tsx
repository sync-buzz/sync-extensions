import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import { TerminalsProvider } from "./area";
import { remember } from "./host";
import { TerminalsNavigator } from "./navigator";
import { TerminalsWorkspace } from "./workspace";

/**
 * Terminals, as Sync starts it.
 *
 * One area in the `list` frame: the tabs, and the tab that is open. No third
 * column, because there is nothing true *of* a shell that is not on its screen
 * already — a panel of properties beside it would be a panel of the same words
 * the prompt is printing.
 *
 * The door is kept before anything is drawn. Nothing is opened here: `activate`
 * runs with the window already up, in front of somebody who has not yet asked
 * for a shell.
 */
export default function activate(host: ExtensionHost): ActivationResult {
  remember(host.terminal);
  return {
    terminals: {
      Provider: TerminalsProvider,
      Navigator: TerminalsNavigator,
      Workspace: TerminalsWorkspace,
    },
  };
}
