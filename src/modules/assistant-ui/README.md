# assistant-ui module

`registry/` contains assistant-ui registry source added through the shadcn CLI flow. Treat it like vendored UI source: keep local fixes small and avoid mixing product-specific composition into this folder.

`registry/hooks/` contains non-visual hooks extracted from registry components. They are still registry-owned code, not product chat composition.

`chat/` contains handwritten composition for this app's chat surface. It may import from `registry/`, but registry files should not import from `chat/`.
