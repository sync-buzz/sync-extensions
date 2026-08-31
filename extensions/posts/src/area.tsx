"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  RecordRemovalSheet,
  explain,
  updateMemoryDocument,
  useDocument,
  type AreaIntent,
  type AreaProviderProps,
  type ExtensionNet,
  type ExtensionVault,
  type MemoryRecord,
  type OpenDocument,
} from "@sync-buzz/extension-api";

import { Area, type AreaState, type Sent } from "./context";
import { Refused } from "./door";
import { usePosts, type SliceId } from "./filter";
import { connect as reach, post } from "./networks";
import {
  CHANNEL,
  DRAFT,
  EMPTY,
  PUBLICATION,
  accountOf,
  authorOf,
  channelKeyOf,
  chatOf,
  network,
  networkLabel,
  networkOf,
  remaining,
  secretName,
  secretOf,
  visibilityOf,
} from "./model";

/**
 * The package's own doors, as `activate` was handed them.
 *
 * Module-scoped rather than props, because the columns are components the
 * window renders itself: nothing of this package is between the shell and a
 * column, so there is nowhere to pass them. They are written once, before the
 * window can have mounted anything — `activate` returns these components, so a
 * render implies the assignment already happened.
 *
 * Not exported. The permissions behind them are this package's, and a second
 * module reaching them would be the one thing this shape exists to prevent.
 */
let net: ExtensionNet | null = null;
let vault: ExtensionVault | null = null;

export function holdDoors(doors: { net: ExtensionNet; vault: ExtensionVault }): void {
  net = doors.net;
  vault = doors.vault;
}

/**
 * Posts, as an area of the window.
 *
 * Three columns, because a post *is* a record and this window reads a record in
 * three: which half of the section, the thing itself, and what would happen if
 * it went out.
 */
export function PostsProvider({
  project,
  active,
  intent,
  children,
}: AreaProviderProps & { children?: ReactNode }) {
  const [slice, setSlice] = useState<SliceId>("drafts");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [sending, setSending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [hasSecret, setHasSecret] = useState<boolean | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const { drafts, publications, channels } = usePosts(project.path, active);
  const corpus =
    slice === "drafts" ? drafts : slice === "published" ? publications : channels;
  const open = useDocument(project.path, openKey);

  const openIsPublication = open.document?.kind === PUBLICATION;
  const openIsChannel = open.document?.kind === CHANNEL;

  // A record that was deleted, or a project that answered without it, must not
  // leave the other two columns drawing something nobody can reach.
  useEffect(() => {
    if (
      openKey !== null &&
      !corpus.isLoading &&
      open.document === null &&
      open.error !== null
    ) {
      setOpenKey(null);
    }
  }, [corpus.isLoading, open.document, open.error, openKey]);

  const saved = open.save.status === "saved";
  const reload = corpus.reload;
  useEffect(() => {
    if (saved) reload();
  }, [saved, reload]);

  /**
   * Whether the open channel has a token on this machine.
   *
   * Asked by trying to read it, because the door offers no *is there one*: a
   * refusal is the answer. The value is dropped in the same expression it
   * arrives in — what is kept is a boolean, so a token never sits in this
   * window's state waiting to be found in a heap dump.
   */
  useEffect(() => {
    if (!openIsChannel || open.document === null) {
      setHasSecret(null);
      return;
    }
    const name = secretOf(open.document.fields) || secretName(open.document.key);
    let dropped = false;
    setHasSecret(null);
    void vault?.read(name).then(
      () => {
        if (!dropped) setHasSecret(true);
      },
      () => {
        if (!dropped) setHasSecret(false);
      },
    );
    return () => {
      dropped = true;
    };
  }, [openIsChannel, open.document]);

  const closePost = useCallback(() => {
    if (openKey === null) return;
    setOpenKey(null);
    setSent(null);
    void open.write().then(() => corpus.reload(), () => undefined);
  }, [corpus, open, openKey]);

  const select = useCallback(
    (next: SliceId) => {
      closePost();
      setSlice(next);
    },
    [closePost],
  );

  useApplied(intent, active, (key, kind) => {
    setSlice(kind === PUBLICATION ? "published" : kind === CHANNEL ? "channels" : "drafts");
    setOpenKey(key);
  });

  const createDraft = useCallback(() => {
    void (async () => {
      try {
        const made = await drafts.createRecord(DRAFT);
        await updateMemoryDocument(project.path, made.key, { content: EMPTY });
        setFailure(null);
        setSent(null);
        drafts.reload();
        setSlice("drafts");
        setOpenKey(made.key);
        setJustCreated(made.key);
      } catch (refused) {
        setFailure(explain(refused));
      }
    })();
  }, [drafts, project.path]);

  /**
   * Write a channel for one network and open it.
   *
   * The secret's name is settled here, from the record's own key, and written
   * into the record — see `secretName`. Doing it at creation rather than at
   * connection is what keeps a channel that was never connected still able to
   * say what it is waiting for.
   */
  const createChannel = useCallback(
    (id: string) => {
      void (async () => {
        try {
          const made = await channels.createRecord(CHANNEL);
          await updateMemoryDocument(project.path, made.key, {
            title: networkLabel(id),
            fields: { network: id, secret: secretName(made.key) },
          });
          setFailure(null);
          channels.reload();
          setSlice("channels");
          setOpenKey(made.key);
          setJustCreated(made.key);
        } catch (refused) {
          setFailure(explain(refused));
        }
      })();
    },
    [channels, project.path],
  );

  const archive = useCallback(
    (record: MemoryRecord) => {
      void (async () => {
        try {
          await updateMemoryDocument(project.path, record.key, {
            archived: !record.archived,
          });
          setFailure(null);
          corpus.reload();
        } catch (refused) {
          setFailure(explain(refused));
        }
      })();
    },
    [corpus, project.path],
  );

  const deletePosts = useCallback(
    async (keys: readonly string[]) => {
      keys.forEach(open.forget);
      await corpus.deleteRecords(keys);
      setFailure(null);
      if (openKey !== null && keys.includes(openKey)) setOpenKey(null);
    },
    [corpus, open, openKey],
  );

  /**
   * Give the open channel what its network asks for.
   *
   * **Checked before it is stored, and that order is the whole care here.** A
   * credential the network will not answer is one that would have failed at the
   * moment somebody pressed Publish, in front of a post they had written. What
   * comes back is written into the record — the account so a person can tell two
   * of them apart, the author because the network insists on it and nobody
   * should have to go and look it up.
   */
  const connect = useCallback(
    (secret: string, identity: string) => {
      const document_ = open.document;
      if (document_ === null || net === null || vault === null) return;
      const within = network(networkOf(document_.fields));
      if (within === null) {
        setSent({ said: "This channel names no network this build knows.", failed: true });
        return;
      }
      const typed = secret.trim();
      if (typed === "" && hasSecret !== true) {
        setSent({
          said: `There is no ${within.secret.label.toLowerCase()} in the field.`,
          failed: true,
        });
        return;
      }
      if (within.identity !== null && identity.trim() === "") {
        setSent({
          said: `${within.identity.label} is what this channel is missing; ${within.label} cannot be reached without it.`,
          failed: true,
        });
        return;
      }

      const name = secretOf(document_.fields) || secretName(document_.key);
      setConnecting(true);
      setSent(null);
      void (async () => {
        try {
          // An empty field where this machine already has one means *use that
          // one*. The chat a bot posts into is changed far more often than the
          // token is, and the token is the one value this window can never show
          // back to somebody who has mislaid it.
          const held = typed === "" ? await (vault as ExtensionVault).read(name) : typed;
          const found = await reach(net as ExtensionNet, within, { secret: held, identity });

          await (vault as ExtensionVault).write(name, held);
          await updateMemoryDocument(project.path, document_.key, {
            title: `${within.label} · ${found.account}`,
            fields: {
              ...(document_.fields as Record<string, unknown>),
              account: found.account,
              author: found.author,
              chat: found.chat,
              secret: name,
            },
          });
          channels.reload();
          setHasSecret(true);
          setSent({
            said: `Connected as ${found.account}.${found.note === "" ? "" : ` ${found.note}`}`,
            failed: false,
          });
        } catch (refused) {
          setSent({
            said: refused instanceof Refused ? refused.message : explain(refused),
            failed: true,
          });
        } finally {
          setConnecting(false);
        }
      })();
    },
    [channels, hasSecret, open.document, project.path],
  );

  const disconnect = useCallback(() => {
    const document_ = open.document;
    if (document_ === null || vault === null) return;
    const name = secretOf(document_.fields) || secretName(document_.key);
    void vault
      .forget(name)
      .then(() => {
        setHasSecret(false);
        setSent({ said: "The token is gone from this machine.", failed: false });
      })
      .catch((refused: unknown) => {
        setSent({ said: explain(refused), failed: true });
      });
  }, [open.document]);

  /**
   * Publish the open draft, and write down what went out.
   *
   * The order is the whole of the care. The draft is written first, so nothing
   * is sent that is only in this window. Then it goes; and only once something
   * has actually gone does anything else change — a publication carrying the
   * text as it went and the identifier the network issued, and the draft
   * archived, so the two lists say the same thing about it.
   *
   * **The publication is written from what was sent**, not read back from the
   * record afterwards: reading again would open a gap in which a keystroke
   * lands between the send and the copy, and the account of what was said would
   * quietly be of something else.
   */
  const send = useCallback(() => {
    const document_ = open.draft ?? open.document;
    if (openKey === null || document_ === null || net === null || vault === null) return;

    const text = document_.content ?? "";
    const channelKey = channelKeyOf(document_.fields);
    const channel = channels.records.find((record) => record.key === channelKey);
    const within = network(networkOf(channel?.fields));
    const visibility = visibilityOf(document_.fields);

    const stopped = unsendable(text, channel, within);
    if (stopped !== null || channel === undefined || within === null) {
      setSent({ said: stopped ?? "This draft cannot be sent.", failed: true });
      return;
    }

    const name = secretOf(channel.fields) || secretName(channel.key);

    setSending(true);
    setSent(null);
    void open
      .write()
      .then(() => vault?.read(name) ?? Promise.reject(new Error("no vault")))
      .catch(() => {
        throw new Refused(
          `This channel has nothing on this machine to sign with. Open it under Channels and connect it: ${within.connecting}`,
        );
      })
      .then((secret: string) =>
        post(net as ExtensionNet, within, {
          secret,
          account: accountOf(channel.fields),
          author: authorOf(channel.fields),
          chat: chatOf(channel.fields),
          text,
          visibility,
        }),
      )
      .then(async (identifier) => {
        const made = await publications.createRecord(PUBLICATION);
        await updateMemoryDocument(project.path, made.key, {
          title: document_.title,
          content: text,
          fields: {
            channel: channel.key,
            network: within.id,
            identifier,
            sent: new Date().toISOString(),
            visibility,
          },
          links: [{ key: openKey, relation: "sent_from" }],
        });
        await updateMemoryDocument(project.path, openKey, { archived: true });
        drafts.reload();
        publications.reload();
        setSlice("published");
        setOpenKey(made.key);
        setSent({
          said:
            identifier === ""
              ? `It went out. ${within.label} did not name it, so the record carries no identifier.`
              : "It went out, and is kept here as it went.",
          failed: false,
        });
      })
      .catch((refused: unknown) => {
        setSent({
          said: refused instanceof Refused ? refused.message : explain(refused),
          failed: true,
        });
      })
      .finally(() => setSending(false));
  }, [channels.records, drafts, open, openKey, project.path, publications]);

  const state = useMemo<AreaState>(
    () => ({
      project,
      slice,
      select,
      drafts,
      publications,
      channels,
      corpus,
      openKey,
      open,
      openPost: (key: string) => {
        setSent(null);
        setOpenKey(key);
      },
      closePost,
      openIsPublication,
      openIsChannel,
      justCreated,
      createDraft,
      createChannel,
      archive,
      askRemoval: setRemoving,
      connect,
      connecting,
      hasSecret,
      disconnect,
      send,
      sending,
      sent,
      dismissSent: () => setSent(null),
      failure,
      dismissFailure: () => setFailure(null),
    }),
    [
      archive,
      channels,
      closePost,
      connect,
      connecting,
      corpus,
      createChannel,
      createDraft,
      disconnect,
      drafts,
      failure,
      hasSecret,
      justCreated,
      open,
      openIsChannel,
      openIsPublication,
      openKey,
      project,
      publications,
      select,
      send,
      sending,
      sent,
      slice,
    ],
  );

  return (
    <Area.Provider value={state}>
      {children}
      <RecordRemovalSheet
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
        record={rowFor(corpus.records, open.document, removing)}
        types={corpus.types}
        dependentsOf={corpus.dependentsOf}
        onDelete={deletePosts}
      />
    </Area.Provider>
  );
}

/**
 * Why this draft cannot go out, or `null` when nothing is in the way.
 *
 * One function rather than a condition in each of the places that ask, so that
 * a draft the window offers to send is a draft the sending accepts.
 */
export function unsendable(
  text: string,
  channel: MemoryRecord | undefined,
  within: ReturnType<typeof network>,
): string | null {
  if (text.trim().length === 0) return "There is nothing in this draft to send.";
  if (channel === undefined) {
    return "No channel is chosen, so there is nowhere for this to go.";
  }
  if (within === null) return "This channel names no network.";
  if (authorOf(channel.fields) === "") {
    return "This channel has not been connected yet, so nothing knows who would be posting.";
  }
  if (within.identity?.kept === "chat" && chatOf(channel.fields) === "") {
    return `This channel does not say which ${within.identity.label.toLowerCase()} to post into, and ${within.label} has no default.`;
  }
  const left = remaining(within, text);
  if (left !== null && left < 0) {
    return `Longer than ${within.label} accepts, by ${-left} characters.`;
  }
  return null;
}

/**
 * The record a confirmation is about, wherever it can be found.
 *
 * The page first, and the open document after it: something may have been
 * opened from a slice the list has since moved off, and a sheet with nothing to
 * show is a sheet asking somebody to confirm a blank.
 */
function rowFor(
  rows: readonly MemoryRecord[],
  document: OpenDocument["document"],
  key: string | null,
): MemoryRecord | null {
  if (key === null) return null;
  const listed = rows.find((record) => record.key === key);
  if (listed !== undefined) return listed;
  if (document === null || document.key !== key) return null;
  return {
    key: document.key,
    kind: document.kind,
    title: document.title,
    fields: document.fields,
    freshness: document.freshness,
    scope: document.scope,
    archived: document.archived,
    tags: document.tags,
    locator: document.locator,
    presence: document.presence,
    folder: document.folder,
    isFolder: document.isFolder,
  };
}

/**
 * Open what the window asked for.
 *
 * Identity is the signal rather than the key: the same object is handed over
 * until the next ask, so asking twice for one record is two objects and opens
 * it twice — somebody who wandered off and wants it back, not a duplicate to
 * swallow.
 */
function useApplied(
  intent: AreaIntent | null | undefined,
  active: boolean,
  show: (key: string, kind: string) => void,
) {
  const [settled, setSettled] = useState<AreaIntent | null>(null);
  useEffect(() => {
    if (!active || !intent || intent === settled) return;
    if (
      intent.show === "record" &&
      (intent.kind === DRAFT || intent.kind === PUBLICATION || intent.kind === CHANNEL)
    ) {
      show(intent.key, intent.kind);
    }
    setSettled(intent);
  }, [intent, settled, active, show]);
}
