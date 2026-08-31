import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import { PostsProvider, holdDoors } from "./area";
import { PostsInspector } from "./inspector";
import { PostsNavigator } from "./navigator";
import { PostsWorkspace } from "./workspace";

/**
 * Posts, as Sync starts it.
 *
 * One area in the `browse` frame: which half of the section, the thing itself,
 * and what would happen if it went out.
 *
 * The one thing done here rather than in a column is taking the two doors out
 * of the host. `host.net` and `host.vault` are this package's own — closed over
 * its id in Rust, checked against the hosts and the namespace it declared — and
 * `activate` is the only place they are handed over. The columns are components
 * the window renders itself, so there is nothing of this package between the
 * shell and a column to pass them through.
 */
export default function activate(host: ExtensionHost): ActivationResult {
  holdDoors({ net: host.net, vault: host.vault });

  return {
    posts: {
      Provider: PostsProvider,
      Navigator: PostsNavigator,
      Workspace: PostsWorkspace,
      Inspector: PostsInspector,
    },
  };
}
