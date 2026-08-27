import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import { TasksProvider } from "./area";
import { TasksInspector } from "./inspector";
import { TasksNavigator } from "./navigator";
import { TasksWorkspace } from "./workspace";

/**
 * Tasks, as Sync starts it.
 *
 * One area in the `browse` frame: where the work is filed, the register itself,
 * and what is true of the task that is open. Three columns rather than two
 * because a task is a record, and what makes it checkable — the criteria —
 * belongs in the body a person reads, not in a panel of fields beside it.
 *
 * Nothing is done here that could not be: `activate` runs with the window
 * already up, in front of somebody opening a project.
 */
export default function activate(_host: ExtensionHost): ActivationResult {
  return {
    tasks: {
      Provider: TasksProvider,
      Navigator: TasksNavigator,
      Workspace: TasksWorkspace,
      Inspector: TasksInspector,
    },
  };
}
