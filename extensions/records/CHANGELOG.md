# Changelog

## 1.2.1

Rebuilt against a moved contract, and nothing else.

The extension surface is at 3.10.0, and every module here is compiled against
it — so this package comes out as a different file though not a line of it was
edited. A released version is immutable, which is why the number moves rather
than the bytes under it. Nothing it does has changed.

## 1.2.0

The section says where its edges are.

Two of them are met constantly and neither was written down. A type cannot be
created by an agent — the surface has no such call — so an agent that needs a
kind the project lacks was quietly filing the record under the nearest kind
that would accept it, which is wrong in the one place nobody checks. And a
folder that has a record describing it is describing what belongs there, which
is worth reading before filing rather than after.

## 1.1.1

Rebuilt against a newer contract, and nothing else.

The module is built against the contract, and the contract moved to 3.4.0 — the
surface gained the working tree a conversation is held in. Nothing here uses it
and nothing here changed, but the built module is not the same file, and a
version that has been published is immutable. So the number moves rather than
the bytes under it.

## 1.1.0

Asks for a Sync that has the surface it is built against.

Sync's extension surface reached `3.2.0`: `net.read` was replaced by
`net.fetch`, a package may hold its own secrets, and it may offer an agent
tools. Nothing here uses any of it — this extension draws records — but its
`engines.syncApi` said `^2.0`, and a build publishing `3.2.0` refuses that
range outright. A package that will not open says less about itself than one
that names the version it wants.

A minor rather than a patch, because what changed is who may install it: an
older Sync no longer can, and that is a fact about the package rather than
about its bytes.

## 1.0.2

Relinked against a newer contract. Nothing in the extension changed.

`ui/index.js` is built against `@sync-buzz/extension-api`, and the shim that
build generates lists the surface it was generated from — so a contract that
moved from `2.2.1` to `2.13.0` is a different archive for identical source.
A released version is immutable, which leaves a version of its own as the only
honest way to ship it: the alternative is a registry whose sha256 no longer
matches the bytes anybody downloads.

## 1.0.1

The archive now carries the stylesheet it declares.

`1.0.0` named `ui/index.css` in its manifest and did not contain it, so Sync
refused to open the package after downloading it — the download succeeded, the
sha256 matched the registry, and the install failed at the last step. Nothing in
the extension itself changed.

## 1.0.0

First release.
