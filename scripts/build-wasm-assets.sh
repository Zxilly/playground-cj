#!/usr/bin/env bash
# Build the browser toolchain on Linux/WSL from pinned upstream sources.
set -euo pipefail

repository=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
work=$(realpath -m -- "${1:?Usage: EMSDK_ROOT=/path/to/emsdk bash scripts/build-wasm-assets.sh /path/to/build-directory}")
lock="$repository/cangjie_patch/wasm-build.lock.json"
native_lock="$repository/cj-runner/cangjie-toolchain.lock.json"
jobs=${BUILD_JOBS:-8}
emsdk=${EMSDK_ROOT:?Set EMSDK_ROOT to an Emscripten SDK installation}

for command in git cmake ninja python3 jq curl tar unzip sha256sum; do
  command -v "$command" >/dev/null || { echo "Missing build dependency: $command" >&2; exit 1; }
done
test "$(uname -s)" = Linux && test "$(uname -m)" = x86_64
source "$emsdk/emsdk_env.sh"
release=$(jq -er .release "$lock")
test "$release" = "$(jq -er .release "$native_lock")"
emcc --version | head -n 1 | grep -F "$(jq -er .emscripten "$lock")"
mkdir -p "$work"
if git -C "$work" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo 'Use a build directory outside an existing Git checkout' >&2
  exit 1
fi
mkdir -p "$work/downloads"

checkout() {
  local key=$1 directory=$2 revision url
  revision=$(jq -er ".$key.commit" "$lock")
  url=$(jq -er ".$key.repository" "$lock")
  if [ ! -d "$directory/.git" ]; then
    git init "$directory"
    git -C "$directory" remote add origin "$url"
    git -C "$directory" fetch --depth 1 origin "$revision"
    git -C "$directory" checkout --detach FETCH_HEAD
  fi
  test "$(git -C "$directory" rev-parse HEAD)" = "$revision" || {
    echo "Unexpected source revision in $directory; use a fresh build directory" >&2
    exit 1
  }
}

download() {
  local url=$1 hash=$2 path=$3
  if [ ! -f "$path" ]; then
    curl --fail --location --retry 5 --connect-timeout 30 \
      --proto '=https' --proto-redir '=https' -A 'Mozilla/5.0' \
      --output "$path.download" "$url"
    printf '%s  %s\n' "$hash" "$path.download" | sha256sum --check
    mv -- "$path.download" "$path"
  else
    printf '%s  %s\n' "$hash" "$path" | sha256sum --check
  fi
}

compiler="$work/cangjie_compiler"
tools="$work/cangjie_tools"
lsp="$tools/cangjie-language-server"
formatter="$tools/cjfmt"
sdk="$work/sdk-wasm"
checkout compiler "$compiler"
checkout tools "$tools"
patch="$repository/cangjie_patch/all-subprojects.diff"
if ! git -C "$work" apply --reverse --check "$patch" 2>/dev/null; then
  git -C "$work" apply --check "$patch"
  git -C "$work" apply "$patch"
fi

# This dependency was added after the previous alpha browser build. The
# upstream preparation function applies its required floating-point patch.
checkout tinytoml "$compiler/third_party/tinytoml"
if [ ! -f "$compiler/third_party/tinytoml/toml.h" ]; then
  python3 - "$compiler/build.py" <<'PY'
import logging, runpy, sys
runpy.run_path(sys.argv[1], init_globals={'LOG': logging.getLogger('build')})['download_and_patch_tinytoml']()
PY
fi

emcmake cmake -S "$compiler" -B "$compiler/build-wasm" -G Ninja \
  -DBUILD_WASM=ON -DCMAKE_BUILD_TYPE=Release -DCJ_SDK_VERSION="$release" \
  -DCMAKE_INSTALL_PREFIX="$sdk"
cmake --build "$compiler/build-wasm" --target cangjie-lsp-wasm --parallel "$jobs"
mkdir -p "$sdk/include" "$sdk/tools/lib"
cp -a "$compiler/include/." "$sdk/include/"
cp -a "$compiler/build-wasm/include/flatbuffers" "$sdk/include/"
cp -p "$compiler/build-wasm/lib/libcangjie-lsp-wasm.a" "$sdk/tools/lib/"

checkout flatbuffers "$lsp/third_party/flatbuffers"
checkout json "$lsp/third_party/json-v3.11.3"
flatbuffers="$lsp/third_party/flatbuffers"
# flatc is a host executable; do not configure it through emcmake.
cmake -S "$flatbuffers" -B "$flatbuffers/build" -G Ninja -DFLATBUFFERS_BUILD_TESTS=OFF
cmake --build "$flatbuffers/build" --target flatc --parallel "$jobs"
"$flatbuffers/build/flatc" --cpp -o "$flatbuffers/include" "$lsp/generate/index.fbs"
mkdir -p "$lsp/src/lib/cangjie/include" "$lsp/src/lib/cangjie/lib/cjnative"
cp -a "$sdk/include/." "$lsp/src/lib/cangjie/include/"
cp -p "$sdk/tools/lib/libcangjie-lsp-wasm.a" "$lsp/src/lib/cangjie/lib/cjnative/"
emcmake cmake -S "$lsp" -B "$lsp/build-wasm" -G Ninja -DBUILD_WASM=ON -DCMAKE_BUILD_TYPE=Release
cmake --build "$lsp/build-wasm" --target LSPServer-wasm --parallel "$jobs"
emcmake cmake -S "$formatter" -B "$formatter/build-wasm" -G Ninja \
  -DBUILD_WASM=ON -DCMAKE_BUILD_TYPE=Release -DCANGJIE_HOME="$sdk"
cmake --build "$formatter/build-wasm" --target cjfmt-wasm --parallel "$jobs"

sdk_archive="$work/downloads/cangjie-sdk-linux-x64-$release.tar.gz"
stdx_version=$(jq -er .stdx.version "$native_lock")
stdx_archive="$work/downloads/cangjie-stdx-linux-x64-$stdx_version.zip"
download "$(jq -er .sdk.url "$native_lock")" "$(jq -er .sdk.sha256 "$native_lock")" "$sdk_archive"
download "$(jq -er .stdx.url "$native_lock")" "$(jq -er .stdx.sha256 "$native_lock")" "$stdx_archive"
mkdir -p "$work/sdk-native" "$work/stdx"
tar -xzf "$sdk_archive" -C "$work/sdk-native"
unzip -oq "$stdx_archive" -d "$work/stdx"
printf '%s  %s\n' "$(jq -er .compiler.executableSha256 "$native_lock")" \
  "$work/sdk-native/cangjie/bin/cjc" | sha256sum --check

python3 - "$work" "$repository" <<'PY'
import hashlib, pathlib, sys, zipfile
work, repo = map(pathlib.Path, sys.argv[1:])
lsp = work / 'cangjie_tools/cangjie-language-server/output/bin'
formatter = work / 'cangjie_tools/cjfmt/build-wasm/bin'
files = {name: lsp / name for name in ('LSPServer-wasm.js', 'LSPServer-wasm.wasm')}
files.update({name: formatter / name for name in ('cjfmt-wasm.mjs', 'cjfmt-wasm.wasm')})
target = 'linux_x86_64_cjnative'
for root in (work / 'sdk-native/cangjie/modules' / target, work / 'stdx' / target / 'dynamic'):
    modules = sorted(root.rglob('*.cjo'))
    if not modules:
        raise RuntimeError(f'No CJO modules under {root}')
    for path in modules:
        files[f'modules/{target}/{path.relative_to(root).as_posix()}'] = path
files['wasm-build.lock.json'] = repo / 'cangjie_patch/wasm-build.lock.json'
files['cangjie-toolchain.lock.json'] = repo / 'cj-runner/cangjie-toolchain.lock.json'
files['licenses/cangjie/LICENSE'] = work / 'sdk-native/cangjie/LICENSE'
files['licenses/stdx/LICENSE'] = work / 'stdx' / target / 'LICENSE'
archive = work / 'wasm_assets.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for name, path in sorted(files.items()):
        entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        output.writestr(entry, path.read_bytes(), compresslevel=9)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(work / 'wasm_assets.zip.sha256').write_text(f'{digest}  wasm_assets.zip\n')
print(f'{digest}  {archive}')
print(f'Packaged {sum(name.endswith(".cjo") for name in files)} standard library modules.')
PY
