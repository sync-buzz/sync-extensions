import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import {
  IssuesInspector,
  IssuesNavigator,
  IssuesProvider,
  IssuesWorkspace,
  holdNet,
} from "./area";

/**
 * Issues, as Sync starts it.
 *
 * One area in the `browse` frame: which repository and which slice of it, the
 * slice or one issue, and what is true of that issue.
 *
 * The one thing done here rather than in a column is taking the door out of the
 * host. `host.net` is this package's own — closed over its id, checked in Rust
 * against the `net.hosts` in the manifest beside this file — and `activate` is
 * the only place it is handed over. The columns are components the window
 * renders itself, so there is nothing of this package between the shell and a
 * column to pass it through.
 */
export default function activate(host: ExtensionHost): ActivationResult {
  holdNet(host.net);

  return {
    issues: {
      Provider: IssuesProvider,
      Navigator: IssuesNavigator,
      Workspace: IssuesWorkspace,
      Inspector: IssuesInspector,
    },
  };
}
