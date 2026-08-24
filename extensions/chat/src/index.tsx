import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import {
  ChatAreaProvider,
  ChatInspector,
  ChatNavigator,
  ChatWorkspace,
} from "./area";

/** Chat, as Sync starts it. One area, on the `browse` frame. */
export default function activate(_host: ExtensionHost): ActivationResult {
  return {
    chat: {
      Provider: ChatAreaProvider,
      Navigator: ChatNavigator,
      Workspace: ChatWorkspace,
      Inspector: ChatInspector,
    },
  };
}
