# Posts

What this project says outside itself. Three kinds of record, and the
differences between them are the only thing here worth learning first.

**channel** — one account this project publishes as. `network` is which
service, `account` and `author` are who, `chat` is where inside the service the
posts go where the service needs telling, and `secret` is the *name* the
credential is kept under in Sync's vault. The credential itself is not in the
record and is not available to you.

**draft** — something the project is about to say, while it can still be
changed. The body is the post as a stranger would read it; `channel` is the key
of the channel record it is written for.

**publication** — something the project said. The body is the text exactly as it
went out, with the network, the time and the identifier the service issued.

A draft becomes a publication by being delivered. It is never renamed into one:
they are two records, because one may be edited and the other may not.

## Who sends it

**This package sends it, and you ask it to.** Call `posts.publish` with the
draft's key. Sync reads the channel, takes the credential out of its vault,
makes the request and answers with what the network called the post. You never
see the credential, cannot choose the account, and cannot change a word of the
text — which is the point of the tool rather than a limitation of it.

A person can do the same thing themselves by pressing Publish in the window.
Both paths make the same request.

The four networks below are the ones a channel can name, and every one of them
is reached this way. A tool of your own for one of these networks is a second
route to the same account, and using it means the publication record is written
from your account of what happened rather than from the network's answer — so
prefer this one.

## Nothing goes out without a person saying so

This is the rule the whole section is built around, and it does not bend.

- **A person decides.** Writing a draft is not permission to send it, and
  neither is being asked to write one. Ask, and wait to be told.
- **Word for word.** Do not improve, shorten, retitle or extend what you were
  given — hashtags included. They agreed to that wording, not to yours.
- **That channel or nowhere.** A draft names one channel. If you cannot reach
  it, stop and say so; posting to a different account or network instead is the
  obliging failure, and it is worse than not posting.
- **Never on a schedule of your own.** Something published under somebody's own
  name while they sleep is not something they agreed to.

## What differs between networks

`network` on the channel decides two things:

| | Longest | Visibility | Who is speaking |
| --- | --- | --- | --- |
| LinkedIn | 3000 | `public`, `connections` | the person whose token it is |
| Bluesky | 300 | none | the account the handle belongs to |
| Threads | 500 | none | the account that authorised the app |
| Telegram | 4096 | none | a bot, in the chat named by `chat` |

`visibility` is written in the vocabulary of the draft's own network, which is
why it is a plain string rather than one shared set: `connections` means
something on LinkedIn and nothing anywhere else, and the other three networks
give an ordinary account nothing to choose.

**Telegram is not a person speaking.** What goes out is a message from a bot
into a chat or channel it administers, and it reads as an announcement rather
than as somebody's own post. Write it that way, and do not move a draft written
for a personal account onto a Telegram channel without saying so.

**A text is written for one network.** Three thousand characters are not two
hundred and eighty, so do not copy a draft between channels and hope — write the
shorter one as its own draft, for its own audience.

What a channel cannot say in its fields, its body can: the tone it uses, who
reads it, what it never talks about. Read it before writing a draft for that
channel.

## After it has gone out

**The record is yours to write.** `posts.publish` answers with everything it
needs and writes nothing itself: a handler in Sync may read the project's memory
and may not write to it. So as soon as the post is live, and not before, write
it down with `sync_apply`:

1. A record of kind `posts.publication`, whose body is the text **exactly as it
   went**. Set `channel` to the channel's key, `network`, `sent` (ISO 8601), and
   `visibility` as it was sent. Set `identifier` to whatever the service calls
   the post — a URN on LinkedIn, an AT URI on Bluesky, a numeric id on Threads,
   the chat and message together on Telegram. It comes back in the tool's
   answer. If there is none there, leave it out; do not invent it.
2. Link it to the draft with the relation `sent_from`.
3. Archive the draft. It has been said; it is not waiting to be said any more.

**If it did not go out, write nothing.** A publication record for a post that
never appeared is worse than no record: it is an account of something that did
not happen, and nothing downstream can tell the difference.

## Writing a draft

Ordinary work, and you may do it without being asked: a decision worth
announcing is a draft worth writing.

- Say what changed and why it matters to somebody who has never seen this
  project. A changelog entry is not a post.
- No record keys, no internal names, no headings. It is prose, not a document.
- Link the records it was assembled from with `assembled_from`, so a claim in it
  can be checked rather than believed.
- Set `channel` and keep inside that network's length. Leave `channel` unset
  only if you genuinely do not know where it should go — a draft without one
  cannot be sent, which is the right state until somebody decides.

## The credential

You will not see one, and you do not need one. A channel's `secret` is a name in
Sync's vault; the value is in the machine's keychain, and neither the window nor
this prompt will hand it to you. If a channel has none, the person connects it
in the section — that is theirs to do, and there is nothing useful you can do
about it beyond saying which channel is waiting.
