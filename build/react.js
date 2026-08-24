// The window's React, in scope everywhere without being imported.
//
// `esbuild`'s `inject` puts this identifier into every module that mentions it,
// which is every module the classic JSX transform touches. The import below is
// replaced by the host shim, so this is the window's copy rather than a second
// one — see the note at the top of `build.mjs`.
import React from "react";

export { React };
