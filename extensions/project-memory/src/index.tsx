import type { ActivationResult, ExtensionHost } from "@sync-buzz/extension-api";

import { QuestionsProvider } from "./area";
import { QuestionsInspector } from "./inspector";
import { QuestionsNavigator } from "./navigator";
import { QuestionsWorkspace } from "./workspace";

/**
 * Project memory's one screen, as Sync starts it.
 *
 * The package publishes five kinds of claim and draws one of them, which is not
 * an inconsistency: four of them are read, and the fifth is *acted on*. A
 * question is the only record here that is addressed to somebody — it waits on
 * an answer, and answering it is a choice and a sentence rather than an edit
 * somewhere in a body of text. So it gets a section, and the other four are
 * read in the section that reads records.
 *
 * Three columns: which questions, the question with what it is about and the
 * controls that settle it, and what is true of the one that is open.
 *
 * Nothing is done here that could not be: `activate` runs with the window
 * already up, in front of somebody opening a project.
 */
export default function activate(_host: ExtensionHost): ActivationResult {
  return {
    questions: {
      Provider: QuestionsProvider,
      Navigator: QuestionsNavigator,
      Workspace: QuestionsWorkspace,
      Inspector: QuestionsInspector,
    },
  };
}
