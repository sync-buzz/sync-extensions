"use client";

import type { ReactNode } from "react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
  type Agent,
  type SessionConfigOption,
  type SessionConfigValue,
} from "@sync-buzz/extension-api";
import { ChevronDown } from "lucide-react";

/**
 * Choosing which agent to talk to.
 *
 * Every agent is listed, including the ones this machine cannot raise. An
 * absence would be the window quietly deciding a person did not want Codex; a
 * row that says the executable was not found is something they can act on.
 *
 * Finding them is two reads — the catalogue, and which adapters have been
 * downloaded — and both cross into Rust, so a menu opened in the first moment
 * of the section has nothing to draw yet. It says so. An empty menu is a claim
 * that this machine can raise nothing, which is a different answer from not
 * knowing yet, and it is the answer a person would act on by closing the menu.
 */
export function AgentPicker({
  agents,
  loading,
  starting,
  onChoose,
  trigger,
}: {
  agents: readonly Agent[];
  /** Whether the two reads behind {@link agents} are still out. */
  loading: boolean;
  starting: string | null;
  onChoose: (agentId: string) => void;
  trigger: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={starting !== null}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>Agents on this machine</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          // The one punctuation this shell allows: an action in progress.
          <div className="px-2 py-1.5 text-sm text-fg-tertiary">Looking for agents…</div>
        ) : null}
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            disabled={!agent.available}
            onSelect={() => onChoose(agent.id)}
            className="flex-col items-start gap-0.5"
          >
            <span className={cn("text-sm", !agent.available && "text-fg-tertiary")}>
              {agent.name}
            </span>
            <Note agent={agent} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The one line under an agent's name.
 *
 * Whichever fact is most worth knowing before choosing it, and only when there
 * is one. An agent reached through an adapter used to be marked slow to start
 * unconditionally; now the adapter is downloaded when the extension is
 * installed, so the warning is only true when it has not been — and saying it
 * anyway would be a warning about something that is no longer the case.
 */
function Note({ agent }: { agent: Agent }) {
  if (!agent.available) {
    return <span className="text-xs text-fg-tertiary">{agent.unavailableReason}</span>;
  }
  if (agent.adapterReady === false) {
    return (
      <span className="text-xs text-fg-tertiary">
        Downloads its adapter on first use
      </span>
    );
  }
  if (!agent.verified) {
    return <span className="text-xs text-fg-tertiary">Not proven end to end</span>;
  }
  return null;
}

/**
 * Choosing a model.
 *
 * Drawn from what the session said it offers, never from a table in this build.
 * The agents that answer `session/new` with a model option are the ones that get
 * a picker; the ones that take a model only when they are raised get the note
 * beside this, because offering a choice that cannot be applied is worse than
 * saying there is none.
 */
export function ModelPicker({
  option,
  onChoose,
}: {
  option: SessionConfigOption;
  onChoose: (valueId: string) => void;
}) {
  const values = flatten(option);
  const current = values.find((value) => value.value === option.currentValue);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="justify-between">
          <span className="min-w-0 truncate">{current?.name ?? option.currentValue ?? "—"}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuRadioGroup
          value={option.currentValue ?? ""}
          onValueChange={(value) => onChoose(value)}
        >
          {values.map((value) => (
            <DropdownMenuRadioItem key={value.value} value={value.value}>
              {value.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The values of a select, whether the agent grouped them or not.
 *
 * Grouping is the agent's presentation of its own list; a picker in one column
 * of a panel is not where it earns its keep, and flattening keeps one shape to
 * draw instead of two.
 */
function flatten(option: SessionConfigOption): readonly SessionConfigValue[] {
  const raw = option.options ?? [];
  return raw.flatMap((entry) =>
    "options" in entry ? entry.options : [entry as SessionConfigValue],
  );
}
