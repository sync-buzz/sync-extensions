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
