# Posts

What this project says outside itself. Two kinds of record, and the difference
between them is the only thing here worth learning first.

**draft** — something the project is about to say, while it can still be
changed. The body is the post as a stranger would read it. `channel` is the
network it is written for.

**publication** — something the project said. The body is the text exactly as
it went out, with the network, the time and the identifier beside it.

A draft becomes a publication by being delivered. It is never renamed into one:
they are two records, because one may be edited and the other may not.

## Sync does not publish anything

There is no connection to any network in this section, and no account stored
anywhere in it. Delivery is yours, with a tool somebody connected to you — an
MCP server for that network. If you have no such tool, say so plainly; that is
a useful answer and it tells somebody what to go and connect.

## Nothing goes out without a person saying so

This is the rule the whole section is built around, and it does not bend.

- **A person presses the button.** Publishing starts when somebody reads the
  exact text and hands it over. Writing a draft is not permission to send it,
  and neither is being asked to write one.
- **Word for word.** Do not improve, shorten, retitle or extend what you were
  handed — hashtags included. They agreed to that wording, not to yours.
- **That network or nowhere.** If you cannot reach the channel a draft names,
  stop and say so. Reaching a different one instead is the obliging failure: a
  post written for one audience arriving at another is worse than a post that
  did not go.
- **Never on a schedule of your own.** Something published under somebody's own
  name while they sleep is not something they agreed to.

## What differs between channels

`channel` decides three things, and each of them changes what a good draft
looks like:

| | Longest | Visibility |
| --- | --- | --- |
| LinkedIn | 3000 | `public`, `connections` |
| X | 280 | none |
| Bluesky | 300 | none |
| Mastodon | 500 | `public`, `unlisted`, `followers`, `direct` |
| Threads | 500 | none |
| Telegram | 4096 | none |

`visibility` is written in the vocabulary of its own channel, which is why it
is a plain string rather than one shared set: `unlisted` means something on
Mastodon and nothing anywhere else.

**A text is written for one network.** Three thousand characters are not two
hundred and eighty, so do not copy a draft between channels and hope — write
the shorter one as its own draft, for its own audience.

Some of what an agent needs is not in the record at all and cannot be: which
Mastodon instance the account is on, which Telegram chat to post into. Those
belong to the tool you were given, not to the project's memory.

## After it has gone out

As soon as the post is live, and not before, write it down with `sync_apply`:

1. A record of kind `posts.publication`, whose body is the text **exactly as it
   went**. Set `channel`, `sent` (ISO 8601), and `visibility` as it was sent.
   Set `identifier` to whatever the network calls the post — a URN, a numeric
   id, an AT URI. If you could not get one, leave it out; do not invent it.
2. Link it to the draft with the relation `sent_from`.
3. Archive the draft. It has been said; it is not waiting to be said any more.

**If it did not go out, write nothing.** A publication record for a post that
never appeared is worse than no record: it is an account of something that did
not happen, and nothing downstream can tell the difference.

Nothing else in Sync knows the post went. The window did not send it and cannot
see it, so this record is the only account there will be.

## Writing a draft

Ordinary work, and you may do it without being asked: a decision worth
announcing is a draft worth writing.

- Say what changed and why it matters to somebody who has never seen this
  project. A changelog entry is not a post.
- No record keys, no internal names, no headings. It is prose, not a document.
- Link the records it was assembled from with `assembled_from`, so a claim in it
  can be checked rather than believed.
- Set `channel` and keep inside that channel's length. Leave `channel` unset
  only if you genuinely do not know where it should go — a draft without one
  cannot be sent, which is the state it should be in until somebody decides.
