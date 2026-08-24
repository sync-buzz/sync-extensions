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
  ui/index.js             the built module, for an extension that draws something
```

## What is here now

| Extension | Brings | Publishes | Code |
| --- | --- | --- | --- |
| `project-memory` | nothing to look at | five kinds of claim | none |

`project-memory` has no `ui` at all, and that is worth saying out loud because
it is the case an extension system usually gets wrong: an extension is not
necessarily a screen. This one publishes a vocabulary and a prompt, both of
which reach a project without a line of its code being executed. Sync's manifest
reader treats a missing `ui` as an answer rather than as an omission — a stub
module whose only reader is the packer would be a file nobody wants.

## Building and installing

An extension with no code needs no build. Point Sync at the folder — *Extensions
→ From folder…* — and it is read where it lies, marked *development*, and
re-read whenever it is reloaded. That is the loop an author wants: edit, reload,
look.

To produce an archive, use Sync's packer until `sync-ext pack` exists:

```
node ../sync/scripts/pack-extension.mjs extensions/project-memory --out /tmp
```

The archive is reproducible — the same input produces the same bytes — so
"build it yourself and compare" is available from the first one.

## The rules a package is held to

These are enforced by Sync when it reads a package, not by convention:

- **Every kind is prefixed with the extension's id and a dot.** Two extensions
  may both want to call something a decision, and neither may redefine the
  other's.
- **Unknown fields are refused**, in the manifest and in a type definition
  alike. These files are written by tools; a field nobody recognises is a typo
  or a newer format, and both are better as a refusal naming the field.
- **A path may not climb out of the package**, and a file the manifest does not
  name is not packed.
- **A section needs code to draw it.** Declaring an area without a `ui` is
  refused rather than shipped as an empty column.
- **`engines.syncApi` is checked before anything runs.** An extension outside
  the range is not loaded and says which way the mismatch goes.

## What is not here yet

`registry.json` and `dist/`, which arrive with the registry; the `sync-ext` CLI
and the published `@sync/extension-api`, which arrive with the contract
repository. Until then a folder or a locally packed archive is how an extension
reaches a window.
