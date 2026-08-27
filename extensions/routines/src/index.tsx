import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import { RoutinesProvider, RoutinesWorkspace } from "./area";
import { RoutinesNavigator } from "./navigator";
import { RoutinesInspector } from "./inspector";

/**
 * Routines, as Sync starts it.
 *
 * One area, in the `browse` frame: the routines, the one that is open, and what
 * is true of it. Three columns rather than two because a routine *is* a record,
 * and this window reads a record in three: the claim in the middle, everything
 * about it beside. The first draft put the interval, the agent and the switch in
 * the middle column as a settings page, which is what a preferences pane looks
 * like and not what a record does.
 *
 * Nothing is done here that could not be: `activate` runs with the window
 * already up, in front of somebody opening a project.
 */
export default function activate(_host: ExtensionHost): ActivationResult {
  return {
    routines: {
      Provider: RoutinesProvider,
      Navigator: RoutinesNavigator,
      Workspace: RoutinesWorkspace,
      Inspector: RoutinesInspector,
    },
  };
}
