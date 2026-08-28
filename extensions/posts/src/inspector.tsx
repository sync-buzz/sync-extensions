"use client";

import type { ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { Button, PanelBody, PanelHeader, PanelSurface } from "@sync-buzz/extension-api";

import { useArea } from "./context";
import {
  CHANNELS,
  channel,
  channelLabel,
  channelOf,
  identifierOf,
  length,
  remaining,
  sentAtOf,
  unsendable,
  visibilityLabel,
  visibilityOf,
  when,
} from "./model";

/**
 * What is true *of* the open post — and the one command that hands it over.
 *
 * Each control is the one its value asks for, by the shell's own rule: a choice
 * over a closed set is a pop-up over exactly that set. What is not here is a
 * second copy of the text or a preview of it; the column beside this one is the
 * post, and a panel that redrew it smaller would be two places to read one
 * thing.
 *
 * **The channel is first, and everything under it reads from it.** How long the
 * post may be and who may read it are that network's answers, not ours, so the
 * two controls below change when the one above does.
 */
export function PostsInspector() {
  const area = useArea();
  const document_ = area.open.draft ?? area.open.document;

  // With nothing open this column describes the section rather than one post,
  // which is what the shell's own panel does when no record is open: it answers
  // about the corpus instead of going blank.
  if (area.openKey === null || document_ === null) {
    return (
      <PanelSurface className="bg-panel">
        <PanelHeader title="Posts" />
        <PanelBody className="space-y-5">
          <SectionFacts />
        </PanelBody>
      </PanelSurface>
    );
  }

  if (area.openIsPublication) {
    const within = channel(channelOf(document_.fields));
    const identifier = identifierOf(document_.fields);
    const visibility = visibilityLabel(within, visibilityOf(document_.fields));
    return (
      <PanelSurface className="bg-panel">
        <PanelHeader title="Sent" />
        <PanelBody className="space-y-5">
          <section className="space-y-2">
            <Label>Where</Label>
            <p className="text-xs text-fg-secondary">
              {channelLabel(channelOf(document_.fields))}
            </p>
          </section>
          <section className="space-y-2">
            <Label>When</Label>
            <p className="text-xs text-fg-secondary">
              {when(sentAtOf(document_.fields))}
            </p>
          </section>
          {visibility === "" ? null : (
            <section className="space-y-2">
              <Label>Who could read it</Label>
              <p className="text-xs text-fg-secondary">{visibility}</p>
            </section>
          )}
          <section className="space-y-2">
            <Label>Identifier</Label>
            <p className="font-mono text-xs break-all text-fg-secondary">
              {identifier === "" ? "—" : identifier}
            </p>
            <p className="text-xs text-fg-tertiary">
              What the network calls this post, and the only handle anybody has
              on it afterwards.
            </p>
          </section>
          <section className="space-y-2">
            <Label>Why this cannot be edited</Label>
            <p className="text-xs text-fg-tertiary">
              It is the text as it went out. Changing it here would change the
              account of what was said without changing what was said — so a
              correction is a new post, not an edit to this one.
            </p>
          </section>
        </PanelBody>
      </PanelSurface>
    );
  }

  const fields = (document_.fields ?? {}) as Record<string, unknown>;
  const within = channel(channelOf(fields));
  const visibility = visibilityOf(fields);
  const text = document_.content ?? "";
  const left = remaining(within, text);
  const stopped = unsendable(within, text);

  // **A single choice is written at once**, which is the shell's rule for a
  // discrete value: there is nothing to confirm and nothing to undo, and a
  // window closed within the save delay would otherwise lose a decision
  // somebody watched themselves make.
  const set = (patch: Record<string, unknown>) => {
    area.open.edit({ fields: { ...fields, ...patch } });
    void area.open.write().then(() => area.drafts.reload(), () => undefined);
  };

  /**
   * Choosing a network drops a visibility the new one has never heard of.
   *
   * `unlisted` is Mastodon's and means nothing on LinkedIn. Carried over, it
   * would sit in the record as a value the section cannot draw and the agent
   * cannot honour — so the field is cleared unless the new channel offers the
   * same name.
   */
  const setChannel = (next: string) => {
    const to = channel(next);
    const keeps = to?.visibilities.some((entry) => entry.id === visibility) === true;
    set({ channel: next, ...(keeps ? {} : { visibility: "" }) });
  };

  return (
    <PanelSurface className="bg-panel">
      {/* Each column's header says something different: the navigator names the
          section, the workspace names what it is showing, and this one names
          what it describes — what would happen if this went out. */}
      <PanelHeader title="Sending" />
      <PanelBody className="space-y-5">
        <section className="space-y-2">
          <Label>Channel</Label>
          <Choice
            label="Channel"
            value={channelOf(fields)}
            // The empty option is the state a draft starts in and is offered
            // rather than hidden: a network chosen by mistake has to be
            // un-chooseable, and a pop-up with no way back is a trap.
            options={[
              { id: "", label: "Not chosen" },
              ...CHANNELS.map((entry) => ({ id: entry.id, label: entry.label })),
            ]}
            onChange={setChannel}
          />
          <p className="text-xs text-fg-tertiary">
            {within === null
              ? "Which network this text is written for. It decides how long the post may be and who may read it."
              : `Up to ${within.longest} characters.`}
          </p>
        </section>

        {within === null || within.visibilities.length === 0 ? null : (
          <section className="space-y-2">
            <Label>Who could read it</Label>
            <Choice
              label="Who could read it"
              value={visibility}
              options={[
                { id: "", label: "Not chosen" },
                ...within.visibilities.map((entry) => ({
                  id: entry.id,
                  label: entry.label,
                })),
              ]}
              onChange={(next) => set({ visibility: next })}
            />
            <p className="text-xs text-fg-tertiary">
              {within.visibilities.find((entry) => entry.id === visibility)?.note ??
                `What ${within.label} lets an account choose for one post.`}
            </p>
          </section>
        )}

        <section className="space-y-2">
          <Label>Length</Label>
          {/* The number that matters is what is left, not what has been used:
              somebody writing is deciding whether the next sentence fits. Over
              the limit it keeps counting rather than resting at zero, because
              *over by 40* is what tells them how much to cut. */}
          {left === null ? (
            <p className="font-mono text-xs text-fg-secondary tabular-nums">
              {length(text)}
            </p>
          ) : (
            <p
              className={
                left < 0
                  ? "font-mono text-xs text-danger tabular-nums"
                  : "font-mono text-xs text-fg-secondary tabular-nums"
              }
            >
              {left < 0 ? `${-left} over` : `${left} left`}
            </p>
          )}
          <p className="text-xs text-fg-tertiary">
            {within === null
              ? `${length(text)} characters, and no limit to count against until a channel is chosen.`
              : `${length(text)} of ${within.longest} characters.`}
          </p>
        </section>

        <section className="space-y-2">
          <Label>Send</Label>
          <Button
            variant="default"
            size="sm"
            className="w-full"
            disabled={area.sending || stopped !== null}
            onClick={area.send}
          >
            {area.sending ? "Handing over…" : "Publish"}
          </Button>
          <p className="text-xs text-fg-tertiary">
            {stopped ??
              "Sync sends nothing itself. This hands the post to an agent, which delivers it with a tool you connected to it."}
          </p>
        </section>
      </PanelBody>
    </PanelSurface>
  );
}

/**
 * What the section holds, when no post is open.
 *
 * Two counts and one sentence. It is the answer to *what is this section for*
 * given to somebody who has just arrived at it, which is the only question the
 * column can answer with nothing selected.
 */
function SectionFacts() {
  const area = useArea();

  return (
    <>
      <section className="space-y-2">
        <Label>Held here</Label>
        <dl className="space-y-1.5">
          <div className="flex items-center gap-2">
            <dt className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
              Drafts
            </dt>
            <dd className="shrink-0 font-mono text-xs text-fg-secondary tabular-nums">
              {area.drafts.records.length}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
              Published
            </dt>
            <dd className="shrink-0 font-mono text-xs text-fg-secondary tabular-nums">
              {area.publications.records.length}
            </dd>
          </div>
        </dl>
      </section>
      <section className="space-y-2">
        <Label>What this section is</Label>
        <p className="text-xs text-fg-tertiary">
          What this project says outside itself. A draft can be changed and a
          publication cannot, which is why they are two lists rather than one
          with a mark on some of the rows.
        </p>
      </section>
      <section className="space-y-2">
        <Label>Who delivers</Label>
        <p className="text-xs text-fg-tertiary">
          Not Sync. Publishing hands the post to an agent, which reaches the
          network with a tool you connected to it — so nothing goes out from a
          machine whose agent has no hands, and nothing goes out unasked.
        </p>
      </section>
    </>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold text-fg-tertiary">{children}</h3>;
}

/**
 * A choice over a closed set, which on this system is a pop-up.
 *
 * `appearance-none` and a chevron of our own: a `select` left to itself is
 * drawn by the engine at whatever height it likes, with an arrow of its own,
 * and lines up with nothing above or below it. The menu it opens is still the
 * system's, which is the half worth keeping.
 */
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-(--control-height-sm) w-full cursor-default appearance-none rounded-(--radius-control) border border-separator-strong bg-raised pr-7 pl-2 text-xs text-fg"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-fg-tertiary"
      />
    </div>
  );
}
