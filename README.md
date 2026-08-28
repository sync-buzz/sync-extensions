# Sync extensions

Every extension Sync publishes, and nothing that is compiled into Sync itself.

An extension is a package: a manifest, the types it publishes, what it tells an
agent, and — when it draws something — a built ES module. Sync installs one from
a `.syncext` archive, from a folder while it is being written, or from the
registry this repository generates. There is no fourth way, and in
particular there is no way that involves rebuilding the application.

```
extensions/<id>/
  manifest.json           id, version, the API range it needs, what it brings
  types/*.json            one type definition per file, as the engine asks for them
  prompt/instructions.md  what a connected agent is told, as topic extension:<id>
  src/index.tsx           `export default function activate(host)`
  src/service.ts          the half that runs on a clock, with no window open
  ui/index.js             the drawn half, built by `pnpm build` and not committed
  service/index.js        the other half, built by the same command
  CHANGELOG.md            what changed, per version — the registry carries it in
```

The manifest is the only one of those every package has. `routines` is the only
one with the service half: a module the host runs on a clock in its own process,
so what it does happens with no window open at all, and nothing the drawn half
holds is reachable from it.

## What is here

| Extension | Brings | Publishes |
| --- | --- | --- |
| `records` | the Records section | nothing — it draws what other packages define |
| `project-memory` | the Questions section | five kinds of claim |
| `tasks` | the Tasks section | a task |
| `routines` | the Routines section | a routine |
| `chat` | the Chat section | a conversation |
| `posts` | the Posts section | a draft and a publication |
| `issues` | the Issues section | nothing — it reads a tracker over the network |

No version numbers in that table. They move on every release and the registry is
what answers for them; a number written in two places is a number that will
come to disagree with itself.

`project-memory` publishes five kinds and draws one of them, which is worth
saying out loud because both halves are cases an extension system usually gets
wrong. A vocabulary and a prompt reach a project without a line of the package
being executed, and four of these kinds are read in the section that reads
records — so an extension is not necessarily a screen, and Sync's manifest
reader treats a missing `ui` as an answer rather than as an omission. The fifth
kind is a question, and a question is the one record here addressed to somebody:
it waits on an answer, and answering it is a choice and a sentence rather than
an edit somewhere in a body of text. That is what a section is for, so it has
one — and the other half of the same rule bites here, because a section declared
with no code to draw it is refused.

## Building

```
pnpm install
pnpm verify        # type-check, build, and check the build against the manifests
```

Then point Sync at a folder — *Extensions → From folder…* — and it is read where
it lies, marked *Development* on its card **and beside its section in the
sidebar**. Unsigned code running out of somebody's working tree should be
visible from wherever a person is standing.

To produce the archives:

```
pnpm run pack      # every extension, into dist/
```

`run` rather than `pnpm pack`, which is pnpm's own command for something else.
The release does it by the same script, so there is one spelling of where the
archives go.

An archive is reproducible — the same input produces the same bytes — so
"build it yourself and compare" is available from the first one.

## What an extension may import, and how it reaches the window's objects

Two modules, and nothing else: `react`, and `@sync-buzz/extension-api`. The lint rule
that used to say so inside Sync is now the resolver: there is no Sync source to
reach into, so an import that goes past the contract does not type-check.

Neither of those two can be bundled, and the build replaces both with shims that
read what the host published before it fetched the module:

- **React must be the window's.** Two copies in one document means the first
  hook an extension calls throws — the copy holding the dispatcher is not the
  copy being called.
- **The surface must be the window's objects**, not a second implementation. A
  bundled component library would be a second set of portals, focus traps and
  scroll locks in one window, and "the same styles" would quietly become "the
  same as of the last time both were published".

`lucide-react` is the exception and is bundled normally. An icon is a pure SVG
component with no identity to preserve, so a second copy of the six an extension
uses costs a couple of kilobytes — where serving the library from the host would
mean the application bundling fifteen hundred icon modules so an extension can
pick six.

The contract is an ordinary dependency, installed from npm and pinned in the
lockfile. CI builds against the published package rather than against a checkout
beside it, which is the difference worth paying for: an author outside this
organisation installs the same package, and a green build here means what they
get is what these extensions were built against. `pnpm contract` publishes a new
one, and is the single command here that needs a Sync checkout next to this
repository. The package carries the rolled-up declarations and the list of which
of their names exist at runtime; the second cannot be derived
downstream, because a `.d.ts` describes types and values in one grammar and a
shim that guessed would bind interfaces to `undefined`.

## The rules a package is held to

Sync enforces every one of these when it reads a package, and `pnpm check`
enforces them at the end of a build — the same refusal, in the terminal of the
person who caused it rather than in front of somebody opening a project.

- **Every kind is prefixed with the extension's id and a dot.** Two extensions
  may both want to call something a decision, and neither may redefine the
  other's.
- **The module must return what the manifest declared.** An area renamed in one
  and not the other type-checks perfectly and installs as an empty column;
  nothing in the type system relates JSON to a runtime value, so it is checked
  by running it.
- **An area fills its frame's columns and no others.** `browse` has a navigator
  and an inspector, `list` a navigator, `detail` an inspector, `single`
  neither. Returning a column the frame does not have is refused rather than
  dropped.
- **Unknown fields are refused**, in the manifest and in a type definition
  alike. These files are written by tools; a field nobody recognises is a typo
  or a newer format, and both are better as a refusal naming the field.
- **`engines.syncApi` is checked before anything runs.** An extension outside
  the range is not loaded and says which way the mismatch goes.

## Releasing

One tag, and everything after it is derived. Pushing `v*` packs every extension
from its manifest, attaches the archives to a release, generates `registry.json`
and the per-extension ledgers under `registry/` from those same manifests, and
commits the two back to `main`. Nobody writes the index and nobody edits a
ledger, so the registry cannot come to disagree with the packages it indexes.

Two things it refuses rather than works around:

- **The tag has to be the head of `main`.** A tag anywhere else releases one
  tree and indexes another, and the two differ by exactly whatever was pushed in
  between — which nobody notices until an archive does not match its manifest.
- **A version already published with different bytes stops the run.** The ledger
  keeps the sha256 of what was released and a project's record is checked
  against it, so overwriting a version would make that check compare against a
  lie. The number moves instead.

A release covers every package at once, because the index is generated from all
of the manifests together. There is no way to release one extension on its own,
and a tag that changed no manifest changes no index.
