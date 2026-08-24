# Sync extensions

Every extension Sync publishes, and nothing that is compiled into Sync itself.

An extension is a package: a manifest, the types it publishes, what it tells an
agent, and — when it draws something — a built ES module. Sync installs one from
a `.syncext` archive, from a folder while it is being written, or from the
registry this repository will generate. There is no fourth way, and in
particular there is no way that involves rebuilding the application.

```
extensions/<id>/
  manifest.json           id, version, the API range it needs, what it brings
  types/*.json            one type definition per file, as the engine asks for them
  prompt/instructions.md  what a connected agent is told, as topic extension:<id>
  src/index.tsx           `export default function activate(host)`
  ui/index.js             the built module — produced by `pnpm build`, not committed
```

## What is here

| Extension | Brings | Publishes | Code |
| --- | --- | --- | --- |
| `records` | the Records section | nothing | yes |
| `chat` | the Chat section | a conversation | yes |
| `project-memory` | nothing to look at | five kinds of claim | none |

`project-memory` has no `ui` at all, and that is worth saying out loud because
it is the case an extension system usually gets wrong: an extension is not
necessarily a screen. This one publishes a vocabulary and a prompt, both of
which reach a project without a line of its code being executed. Sync's manifest
reader treats a missing `ui` as an answer rather than as an omission — and
refuses the other half of it, a section declared with no code to draw it.

## Building

```
pnpm install
pnpm verify        # type-check, build, and check the build against the manifests
```

Then point Sync at a folder — *Extensions → From folder…* — and it is read where
it lies, marked *Development* on its card **and beside its section in the
sidebar**. Unsigned code running out of somebody's working tree should be
visible from wherever a person is standing.

To produce an archive, use Sync's packer until `sync-ext pack` exists:

```
node ../sync/scripts/pack-extension.mjs extensions/records --out /tmp
```

The archive is reproducible — the same input produces the same bytes — so
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

The contract itself is vendored in `vendor/`, refreshed by `pnpm contract` from
a Sync checkout beside this one. It carries the rolled-up declarations and the
list of which of their names exist at runtime; the second cannot be derived
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

## What is not here yet

`registry.json` and `dist/`, which arrive with the registry; the `sync-ext` CLI
and the published `@sync-buzz/extension-api`, which arrive with the contract
repository. Until then a folder or a locally packed archive is how an extension
reaches a window.
