# Chat

A conversation somebody chose to keep: what was said, what the agent ran, what
it planned. One is a record of kind `chat.conversation`, and it is written by
the window as the conversation happens — not by you.

**Do not write one.** The fields are the session's own — which agent, which
working directory, when it opened, how many tokens it spent — and a record
assembled by hand is an account of a conversation that never happened in the
form it claims. If you are being asked to save what was just said, the answer
is that Chat already did.

## Reading one

A kept conversation is evidence of **how a decision was reached**, and it is
not the decision. Nothing in it has been checked: it holds what somebody said,
including what they said before changing their mind, and the engine cannot
reconcile prose against code the way it reconciles a claim with scope paths.

So a conversation is a source to read and never a source to quote as settled.
What it settled belongs in a record of the kind that settles things — a
decision, a constraint, an observation — written plainly, with the
conversation linked from it if the reasoning is worth reaching. When you find
something in one that was never written down properly, that is exactly the
moment to write it down properly.

## Its own working tree

`workdir` is where the agent was actually standing. Two conversations about
the same project may have been held in different trees, and a claim from one
of them is a claim about the code that was there — worth checking before you
carry it into work in another.

## Handing work to a second agent

`chat.delegate` raises another agent in a conversation of its own, in this
project, and hands it one piece of work. Call it through `sync_call`.

**It answers with the key of the order and nothing else.** The agent has not
been raised when you get that answer, and what it was asked may take hours.
There is no tool to ask whether it has finished, and that is not an omission:
work that runs for a day would be asked about thousands of times for one
result.

**End your turn after delegating.** Whatever that agent says last comes back
here as an ordinary message, once this conversation is not in the middle of a
turn — so waiting in a loop costs somebody money and arrives no sooner. If you
were about to say *I will check on it*, say what you delegated and stop.

Write the whole of the work into `prompt`. The agent doing it starts in this
project's folder and reads nothing that was said here, so what it needs is in
that text or nowhere.

**`parent` is the conversation the work comes out of, and you can only know it
if you were told it.** Work delegated by an agent that was itself delegated
carries the identifier it was given in its own instruction; work delegated from
a conversation somebody opened themselves carries none, and stands on its own.
Do not put anything else there — a guess files this work under somebody else's
heading.

## `@name`, and what it is not

Conversations have names, given by the people in them, and `@name` is how one is
referred to. **Agents have no names here and are not what `@` points at.** Which
agent holds a conversation is a choice of tool, made when it opens.

**A person's message that begins with `@name` was sent to that conversation and
not to you.** You will not see it. What you may see is the name written
somewhere further into a sentence, and there it is somebody naming a
conversation and nothing more: *see what @checks comes back with* is an ordinary
sentence. Read it as one, and treat the name as the address it is.

**Writing `@name` yourself does nothing.** It is text in a reply, and text in a
reply is read rather than run. To hand work over, call `chat.delegate` — the
field where `@` means something belongs to a person, and you do not have one.

If you are asked to follow a conversation you did not start, what you have is
its name and the records this project keeps — a conversation somebody chose to
save is readable like anything else. There is no way to watch a running one from
outside it. Say so if that is what was wanted, rather than promising to keep an
eye on something and going quiet.
