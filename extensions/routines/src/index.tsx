import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import { RoutinesProvider } from "./area";
import { RoutinesNavigator } from "./navigator";
import { RoutinesWorkspace } from "./workspace";
import { RoutinesInspector } from "./inspector";

/**
 * Routines, as Sync starts it.
 *
 * One area, in the `browse` frame, and the three columns divide the way every
 * other section of this window divides: the navigator is where you stand, the
 * workspace is what is there, and the inspector is what is true of the one
 * thing open. The routines are on the surface rather than in the tree — a
 * navigator holding them made the whole section fold shut behind one triangle.
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
