"use client";

import { useState, type ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { Button, PanelBody, PanelHeader, PanelSurface } from "@sync-buzz/extension-api";

import { useArea } from "./context";
import { unsendable } from "./area";
import {
  accountOf,
  authorOf,
  channelKeyOf,
  chatOf,
  identifierOf,
  identityOf,
  length,
  network,
  networkLabel,
  networkOf,
  remaining,
  secretName,
  secretOf,
  sentAtOf,
  visibilityLabel,
  visibilityOf,
  when,
} from "./model";

/**
 * What is true *of* the open record — and the one command that acts on it.
 *
 * Each control is the one its value asks for, by the shell's own rule: a choice
 * over a closed set is a pop-up over exactly that set. What is not here is a
 * second copy of the text or a preview of it; the column beside this one is the
 * post, and a panel that redrew it smaller would be two places to read one
 * thing.
 */
export function PostsInspector() {
  const area = useArea();
  const document_ = area.open.draft ?? area.open.document;

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

  // Keyed on the record, so the boxes empty when another channel is opened: a
  // credential typed for one account and left standing in a panel now showing
  // another is the one mistake this panel could make on somebody's behalf.
  if (area.openIsChannel) return <ChannelPanel key={area.openKey} />;
  if (area.openIsPublication) return <PublicationPanel />;
  return <DraftPanel />;
}

/**
 * A channel, and what it needs before anything can go out through it.
 *
 * **The credential is typed here and read nowhere.** It goes to the machine's
 * vault under the name the record carries, and what this panel shows afterwards
 * is only that there is one — a value drawn on a screen is a value in a
 * screenshot.
 *
 * **What is asked for comes from the network, not from a condition here.** One
 * network signs in with a handle beside an app password, another needs to be
 * told which chat it posts into, and two need neither. The panel draws the
 * boxes its network declares, so a network added to `model.ts` arrives here
 * with the right form and no edit to this file.
 */
function ChannelPanel() {
  const area = useArea();
  const document_ = area.open.document;
  const [secret, setSecret] = useState("");
  // `null` until somebody types: what is shown before that is what the channel
  // already knows, so replacing a token does not mean typing a handle again.
  const [identity, setIdentity] = useState<string | null>(null);

  if (document_ === null) return null;

  const within = network(networkOf(document_.fields));
  const account = accountOf(document_.fields);
  const author = authorOf(document_.fields);
  const name = secretOf(document_.fields) || secretName(document_.key);
  const asked = within?.identity ?? null;
  const named = identity ?? identityOf(within, document_.fields);
  const chat = chatOf(document_.fields);
  const connectable =
    !area.connecting &&
    (secret.trim() !== "" || area.hasSecret === true) &&
    (asked === null || named.trim() !== "");

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Channel" />
      <PanelBody className="space-y-5">
        <section className="space-y-2">
          <Label>Network</Label>
          <p className="text-xs text-fg-secondary">
            {networkLabel(networkOf(document_.fields))}
          </p>
          <p className="text-xs text-fg-tertiary">{within?.connecting}</p>
        </section>

        <section className="space-y-2">
          <Label>Account</Label>
          <p className="text-xs text-fg-secondary">
            {account === "" ? "Not connected yet" : account}
          </p>
          {author === "" ? null : (
            <p className="font-mono text-xs break-all text-fg-tertiary">{author}</p>
          )}
          <p className="text-xs text-fg-tertiary">
            Read back from the network when the credential is accepted, so it
            cannot disagree with what will actually post.
          </p>
        </section>

        {asked === null ? null : (
          <section className="space-y-2">
            <Label>{asked.label}</Label>
            <input
              type="text"
              value={named}
              onChange={(event) => setIdentity(event.target.value)}
              placeholder={asked.placeholder}
              spellCheck={false}
              autoComplete="off"
              aria-label={asked.label}
              className="h-(--control-height-sm) w-full rounded-(--radius-control) border border-separator-strong bg-raised px-2 font-mono text-xs text-fg"
            />
            <p className="text-xs text-fg-tertiary">
              {asked.kept === "chat"
                ? "Checked with the token when this is connected, so a chat the bot was never added to is said here rather than at the moment somebody publishes."
                : "The account this signs in as. What the channel shows afterwards is the handle the network answered with, which is not always the one typed."}
            </p>
          </section>
        )}

        <section className="space-y-2">
          <Label>
            {area.hasSecret === true
              ? `Replace the ${within?.secret.label.toLowerCase() ?? "credential"}`
              : (within?.secret.label ?? "Credential")}
          </Label>
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={
              area.hasSecret === true
                ? "Leave empty to keep the one on this machine"
                : (within?.secret.placeholder ?? "Paste it here")
            }
            spellCheck={false}
            autoComplete="off"
            aria-label={within?.secret.label ?? "Credential"}
            className="h-(--control-height-sm) w-full rounded-(--radius-control) border border-separator-strong bg-raised px-2 font-mono text-xs text-fg"
          />
          <Button
            variant="default"
            size="sm"
            className="w-full"
            disabled={!connectable}
            onClick={() => {
              area.connect(secret, named);
              // Dropped the moment it is handed over: this field is the one
              // place in the window a credential exists, and it should stop
              // being one as early as it can.
              setSecret("");
            }}
          >
            {area.connecting ? "Asking the network…" : "Connect"}
          </Button>
          <p className="text-xs text-fg-tertiary">
            {area.hasSecret === null
              ? "Checking whether this machine has one…"
              : area.hasSecret
                ? "There is a credential for this channel on this machine. It is kept in the vault and never travels with the repository."
                : "Nothing on this machine to sign with. The channel and everything sent through it are here; the credential is not."}
          </p>
        </section>

        {chat === "" ? null : (
          <section className="space-y-2">
            <Label>Posts into</Label>
            <p className="font-mono text-xs break-all text-fg-secondary">{chat}</p>
            <p className="text-xs text-fg-tertiary">
              Where every draft sent through this channel goes. It travels with
              the repository, which the credential does not.
            </p>
          </section>
        )}

        <section className="space-y-2">
          <Label>Kept as</Label>
          <p className="font-mono text-xs break-all text-fg-secondary">{name}</p>
          <p className="text-xs text-fg-tertiary">
            The name in Settings ▸ Vault, not the value. A colleague opening this
            project sees which secret this channel expects and that their machine
            has not got it.
          </p>
          {area.hasSecret === true ? (
            <Button variant="outline" size="sm" className="w-full" onClick={area.disconnect}>
              Forget the token
            </Button>
          ) : null}
        </section>
      </PanelBody>
    </PanelSurface>
  );
}

/** What is true of something already sent. */
function PublicationPanel() {
  const area = useArea();
  const document_ = area.open.document;
  if (document_ === null) return null;

  const within = network(networkOf(document_.fields));
  const identifier = identifierOf(document_.fields);
  const visibility = visibilityLabel(within, visibilityOf(document_.fields));

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Sent" />
      <PanelBody className="space-y-5">
        <section className="space-y-2">
          <Label>Where</Label>
          <p className="text-xs text-fg-secondary">
            {networkLabel(networkOf(document_.fields))}
          </p>
        </section>
        <section className="space-y-2">
          <Label>When</Label>
          <p className="text-xs text-fg-secondary">{when(sentAtOf(document_.fields))}</p>
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
            What the network called this post when it took it. Read from its own
            answer, which is what makes this a receipt rather than a claim.
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

/** What would happen if this draft went out, and the command that sends it. */
function DraftPanel() {
  const area = useArea();
  const document_ = area.open.draft ?? area.open.document;
  if (document_ === null) return null;

  const fields = (document_.fields ?? {}) as Record<string, unknown>;
  const text = document_.content ?? "";
  const channelKey = channelKeyOf(fields);
  const channel = area.channels.records.find((record) => record.key === channelKey);
  const within = network(networkOf(channel?.fields));
  const visibility = visibilityOf(fields);
  const left = remaining(within, text);
  const stopped = unsendable(text, channel, within);

  // **A single choice is written at once**, which is the shell's rule for a
  // discrete value: there is nothing to confirm and nothing to undo, and a
  // window closed within the save delay would otherwise lose a decision
  // somebody watched themselves make.
  const set = (patch: Record<string, unknown>) => {
    area.open.edit({ fields: { ...fields, ...patch } });
    void area.open.write().then(() => area.drafts.reload(), () => undefined);
  };

  /**
   * Choosing another channel drops a visibility the new network never heard of.
   *
   * `connections` is LinkedIn's and means nothing on Bluesky. Carried over, it
   * would sit in the record as a value the section cannot draw and nothing can
   * honour.
   */
  const setChannel = (next: string) => {
    const to = area.channels.records.find((record) => record.key === next);
    const toNetwork = network(networkOf(to?.fields));
    const keeps = toNetwork?.visibilities.some((entry) => entry.id === visibility) === true;
    set({ channel: next, ...(keeps ? {} : { visibility: "" }) });
  };

  return (
    <PanelSurface className="bg-panel">
      <PanelHeader title="Sending" />
      <PanelBody className="space-y-5">
        <section className="space-y-2">
          <Label>Channel</Label>
          <Choice
            label="Channel"
            value={channelKey}
            options={[
              { id: "", label: "Not chosen" },
              ...area.channels.records.map((record) => ({
                id: record.key,
                label:
                  accountOf(record.fields) === ""
                    ? `${networkLabel(networkOf(record.fields))} — not connected`
                    : `${networkLabel(networkOf(record.fields))} · ${accountOf(record.fields)}`,
              })),
            ]}
            onChange={setChannel}
          />
          <p className="text-xs text-fg-tertiary">
            {area.channels.records.length === 0
              ? "There are no channels yet. Add one under Channels — it is the account a post goes out as."
              : within === null
                ? "Which account this goes out as. It decides how long the post may be and who may read it."
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
          <Label>Publish</Label>
          <Button
            variant="default"
            size="sm"
            className="w-full"
            disabled={area.sending || stopped !== null}
            onClick={area.send}
          >
            {area.sending ? "Sending…" : "Publish"}
          </Button>
          <p className="text-xs text-fg-tertiary">
            {stopped ??
              "It goes out now, exactly as written. Nothing here sends anything on a clock."}
          </p>
        </section>
      </PanelBody>
    </PanelSurface>
  );
}

/** What the section holds, when nothing is open. */
function SectionFacts() {
  const area = useArea();
  const connected = area.channels.records.filter(
    (record) => accountOf(record.fields) !== "",
  ).length;

  return (
    <>
      <section className="space-y-2">
        <Label>Held here</Label>
        <dl className="space-y-1.5">
          <Count label="Drafts" value={area.drafts.records.length} />
          <Count label="Published" value={area.publications.records.length} />
          <Count label="Channels" value={area.channels.records.length} />
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
        <Label>Publishing</Label>
        <p className="text-xs text-fg-tertiary">
          {area.channels.records.length === 0
            ? "Nothing can go out until there is a channel: one account, with a token kept in this machine's vault."
            : connected === 0
              ? "No channel has a token on this machine yet, so nothing can go out from here."
              : `${connected} of ${area.channels.records.length} channels are connected on this machine.`}
        </p>
      </section>
    </>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{label}</dt>
      <dd className="shrink-0 font-mono text-xs text-fg-secondary tabular-nums">{value}</dd>
    </div>
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
