# Changelog

## 0.6.2

Rebuilt against a moved contract, and nothing else.

The extension surface is at 3.10.0, and every module here is compiled against
it — so this package comes out as a different file though not a line of it was
edited. A released version is immutable, which is why the number moves rather
than the bytes under it. Nothing it does has changed.

## 0.6.1

Archiving the draft says how.

The step after a post goes out is *archive the draft*, and nothing said what
that is: the flag was not on Sync's write when this was written, so an agent
following the instruction either left the draft where it was or set a product
field of its own invention. It is `archived: true` on the record, in the write
that files the publication.
