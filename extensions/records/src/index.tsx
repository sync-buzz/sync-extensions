import type { ActivationResult, ExtensionHost } from "@sync/extension-api";

import {
  RecordsAreaProvider,
  RecordsInspector,
  RecordsNavigator,
  RecordsWorkspace,
} from "./area";

/**
 * Records, as Sync starts it.
 *
 * The whole of what a package is asked for: one entry per area its manifest
 * declared, each holding what the frame that area chose has columns for. The
 * host checks the two against each other before it mounts anything, so an
 * inspector returned for a frame with no inspector is a refusal at load rather
 * than a component nobody ever sees.
 *
 * Nothing is done here that could be done at module scope. `activate` is called
 * once, with the window already up, and an extension that did work in it would
 * be doing that work in front of somebody opening a project.
 */
export default function activate(_host: ExtensionHost): ActivationResult {
  return {
    records: {
      Provider: RecordsAreaProvider,
      Navigator: RecordsNavigator,
      Workspace: RecordsWorkspace,
      Inspector: RecordsInspector,
    },
  };
}
