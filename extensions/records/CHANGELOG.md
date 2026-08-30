# Changelog

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
