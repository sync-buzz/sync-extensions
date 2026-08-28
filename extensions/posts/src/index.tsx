import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import { PostsProvider } from "./area";
import { PostsInspector } from "./inspector";
import { PostsNavigator } from "./navigator";
import { PostsWorkspace } from "./workspace";

/**
 * Posts, as Sync starts it.
 *
 * One area in the `browse` frame: which half of the section, the post itself,
 * and what would happen if it went out.
 *
 * Nothing is taken from the host. The manifest beside this file asks for no
 * network, so there is no door to hold on to — what this package reaches is the
 * project's memory, through the same functions every other section uses.
 *
 * Nothing is done here that could not be: `activate` runs with the window
 * already up, in front of somebody opening a project.
 */
export default function activate(_host: ExtensionHost): ActivationResult {
  return {
    posts: {
      Provider: PostsProvider,
      Navigator: PostsNavigator,
      Workspace: PostsWorkspace,
      Inspector: PostsInspector,
    },
  };
}
