# Changelog

## 1.0.1

The archive now carries the stylesheet it declares.

`1.0.0` named `ui/index.css` in its manifest and did not contain it, so Sync
refused to open the package after downloading it — the download succeeded, the
sha256 matched the registry, and the install failed at the last step. Nothing in
the extension itself changed.

## 1.0.0

First release.
