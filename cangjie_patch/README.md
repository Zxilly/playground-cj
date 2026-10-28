# Browser toolchain build

The browser LSP and formatter use Cangjie STS 1.2.0. Their standard-library
CJO files come from the same SDK and STDX 1.2.0.1 archives as the production
runner, rather than from a separate nightly SDK.

- `wasm-build.lock.json` pins the upstream compiler, tools, dependencies, and
  Emscripten version.
- `all-subprojects.diff` contains the browser adaptations against those exact
  compiler and tools commits.
- `../cj-runner/cangjie-toolchain.lock.json` pins the official SDK and STDX
  archives and their SHA-256 checksums.

## Build in WSL

Use an x86-64 Linux filesystem for the build directory. Install Git, CMake,
Ninja, Clang, Python 3, jq, curl, tar, unzip, and Emscripten 5.0.6. Keep the
Emscripten SDK outside the build directory.

```sh
EMSDK_ROOT=/root/emsdk BUILD_JOBS=8 \
  bash scripts/build-wasm-assets.sh /root/playground-cj-wasm-1.2.0
```

The script checks out the locked sources, applies the patch, builds the compiler
frontend, LSP, and formatter, and packages the matching CJO modules. It writes
`wasm_assets.zip` and `wasm_assets.zip.sha256` to the build directory. The archive
also includes both provenance locks and the SDK/STDX licenses. Archive entry
ordering and timestamps are fixed.

The build directory is reusable for the same source revisions. Use a fresh
directory when changing the release; the script rejects an unexpected source
revision and leaves the existing checkout unchanged.

## Completion and diagnostic concurrency

The WASM adaptation serializes top-level protocol handling, diagnostic rebuilds,
and completion through one compiler mutex. A rebuild can replace AST nodes before
updating the file cache, so the file-cache lock alone does not keep nodes alive
while completion reads them. Compiler pool jobs remain parallel within each
operation and do not acquire this mutex.

Completion also reserves its running slot before starting its thread, preventing
adjacent requests from starting concurrent owners of the completion cache. The
browser regression test sends overlapping completion requests while repeatedly
changing a document and checking its diagnostics; it requires the latest request
to return the local variable from the current source.

## Publish and verify

Publish fixes as a new prerelease, such as `wasm-assets-1.2.0-r2`, keeping previous
asset URLs available. Update the release URL and archive checksum in
`scripts/download-wasm-assets.mjs`, and the checksum fixture in
`tests/scripts/download-wasm-assets.test.mts`.

```sh
pnpm prep
pnpm test:browser
pnpm build
```

Browser tests verify the packaged provenance, instantiate the real WASM worker,
check cache reuse/invalidation, and exercise language-service behavior. Build
and test the production image separately:

```sh
docker build -t ghcr.io/zxilly/cj-runner:1.2.0 cj-runner
python3 cj-runner/test_image.py ghcr.io/zxilly/cj-runner:1.2.0
docker push ghcr.io/zxilly/cj-runner:1.2.0
```

See `../modal/README.md` for importing the resulting immutable image into Modal.
