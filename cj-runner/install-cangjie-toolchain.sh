#!/bin/sh
set -eu

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
lock_file="$script_directory/cangjie-toolchain.lock.json"
sdk_parent=
archive=
stdx_root=
install_staging=
installed_sdk_target=
installed_stdx_target=
archive_download=
stdx_download=

cleanup() {
  if [ -n "$installed_sdk_target" ]; then
    rm -rf -- "$installed_sdk_target"
  fi
  if [ -n "$installed_stdx_target" ]; then
    rm -rf -- "$installed_stdx_target"
  fi
  if [ -n "$archive_download" ]; then
    rm -f -- "$archive_download"
  fi
  if [ -n "$stdx_download" ]; then
    rm -f -- "$stdx_download"
  fi
  if [ -n "$install_staging" ]; then
    rm -rf -- "$install_staging"
  fi
}
trap cleanup 0 HUP INT TERM

while [ "$#" -gt 0 ]; do
  case "$1" in
    --lock)
      if [ "$#" -lt 2 ]; then
        printf '%s\n' '--lock requires a value' >&2
        exit 2
      fi
      lock_file=$2
      shift 2
      ;;
    --sdk-parent)
      if [ "$#" -lt 2 ]; then
        printf '%s\n' '--sdk-parent requires a value' >&2
        exit 2
      fi
      sdk_parent=$2
      shift 2
      ;;
    --archive)
      if [ "$#" -lt 2 ]; then
        printf '%s\n' '--archive requires a value' >&2
        exit 2
      fi
      archive=$2
      shift 2
      ;;
    --stdx-root)
      if [ "$#" -lt 2 ]; then
        printf '%s\n' '--stdx-root requires a value' >&2
        exit 2
      fi
      stdx_root=$2
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

if [ -z "$sdk_parent" ]; then
  printf '%s\n' '--sdk-parent is required' >&2
  exit 2
fi
if [ ! -f "$lock_file" ] || [ -L "$lock_file" ]; then
  printf 'Toolchain lock must be a regular, non-symlink file: %s\n' \
    "$lock_file" >&2
  exit 1
fi

for command in jq curl sha256sum tar mktemp mv; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required installer command is unavailable: %s\n' "$command" >&2
    exit 1
  fi
done

# Validate the complete schema before using any field. Keeping this check in
# the installer means a direct runner image build cannot bypass the stricter
# TypeScript validation used by Content Pack generation.
if ! jq -e '
  . as $lock
  | type == "object"
  and keys == ["compiler", "release", "schemaVersion", "sdk", "stdx"]
  and .schemaVersion == 1
  and (.release | type == "string"
    and test("^[A-Za-z0-9][A-Za-z0-9.+-]*$"))
  and (.compiler | type == "object"
    and keys == ["backend", "executableSha256", "name", "target", "version"])
  and .compiler.name == "cjc"
  and .compiler.version == .release
  and .compiler.backend == "cjnative"
  and .compiler.target == "x86_64-unknown-linux-gnu"
  and (.compiler.executableSha256 | type == "string"
    and test("^[a-f0-9]{64}$"))
  and (.sdk | type == "object"
    and keys == ["platform", "sha256", "url"])
  and .sdk.platform == "linux-x64"
  and (.sdk.sha256 | type == "string" and test("^[a-f0-9]{64}$"))
  and (.sdk.url | type == "string"
    and test("^https://cangjie-lang[.]cn/v1/files/auth/downLoad[?]nsId=142267&fileName=cangjie-sdk-linux-x64-[A-Za-z0-9.+-]+[.]tar[.]gz&objectKey=[A-Za-z0-9]+$"))
  and (.sdk.url | contains(
    "fileName=cangjie-sdk-linux-x64-" + $lock.release + ".tar.gz"
  ))
  and (.stdx | type == "object"
    and keys == ["releasePage", "sha256", "url", "version"])
  and (.stdx.version | type == "string"
    and test("^[A-Za-z0-9][A-Za-z0-9.+-]*$"))
  and (.stdx.sha256 | type == "string" and test("^[a-f0-9]{64}$"))
  and .stdx.releasePage
    == ("https://gitcode.com/Cangjie/cangjie_stdx/releases/tag/v"
      + .stdx.version)
  and .stdx.url
    == ("https://gitcode.com/Cangjie/cangjie_stdx/releases/download/v"
      + .stdx.version + "/cangjie-stdx-linux-x64-" + .stdx.version + ".zip")
' "$lock_file" >/dev/null; then
  printf 'Cangjie toolchain lock has an invalid schema or upstream URL\n' >&2
  exit 1
fi

release=$(jq -er '.release' "$lock_file")
compiler_version=$(jq -er '.compiler.version' "$lock_file")
compiler_backend=$(jq -er '.compiler.backend' "$lock_file")
compiler_target=$(jq -er '.compiler.target' "$lock_file")
compiler_sha256=$(jq -er '.compiler.executableSha256' "$lock_file")
sdk_url=$(jq -er '.sdk.url' "$lock_file")
sdk_sha256=$(jq -er '.sdk.sha256' "$lock_file")

if [ "$release" != "$compiler_version" ]; then
  printf '%s\n' 'Toolchain lock release and compiler version differ' >&2
  exit 1
fi

mkdir -p "$sdk_parent"
sdk_root="$sdk_parent/cangjie"
if [ -e "$sdk_root" ] || [ -L "$sdk_root" ]; then
  printf 'Refusing to merge a locked SDK into existing path: %s\n' \
    "$sdk_root" >&2
  exit 1
fi
if [ -z "$archive" ]; then
  archive="$sdk_parent/cangjie-sdk-linux-x64-$release.tar.gz"
fi
mkdir -p "$(dirname -- "$archive")"
if [ -e "$archive" ] || [ -L "$archive" ]; then
  if [ ! -f "$archive" ] || [ -L "$archive" ]; then
    printf 'SDK cache must be a regular, non-symlink file: %s\n' \
      "$archive" >&2
    exit 1
  fi
else
  archive_download=$(mktemp "$archive.download.XXXXXX")
  curl --proto '=https' --proto-redir '=https' \
    --fail --location --retry 5 --retry-all-errors \
    --connect-timeout 30 --output "$archive_download" "$sdk_url"
  printf '%s  %s\n' "$sdk_sha256" "$archive_download" | sha256sum --check
  mv -T --no-clobber -- "$archive_download" "$archive"
  if [ -e "$archive_download" ] || [ -L "$archive_download" ]; then
    rm -f -- "$archive_download"
  fi
  archive_download=
fi
if [ ! -f "$archive" ] || [ -L "$archive" ]; then
  printf 'SDK cache must be a regular, non-symlink file: %s\n' \
    "$archive" >&2
  exit 1
fi
printf '%s  %s\n' "$sdk_sha256" "$archive" | sha256sum --check

install_staging=$(mktemp -d "$sdk_parent/.cangjie-install.XXXXXX")
tar -xzf "$archive" -C "$install_staging"
staged_sdk_root="$install_staging/cangjie"
if [ ! -f "$staged_sdk_root/bin/cjc" ] \
  || [ ! -x "$staged_sdk_root/bin/cjc" ] \
  || [ -L "$staged_sdk_root/bin/cjc" ]; then
  printf 'Locked SDK did not install a regular cjc at %s\n' \
    "$staged_sdk_root/bin/cjc" >&2
  exit 1
fi
printf '%s  %s\n' "$compiler_sha256" "$staged_sdk_root/bin/cjc" \
  | sha256sum --check

compiler_output=$("$staged_sdk_root/bin/cjc" --version)
expected_compiler_output=$(printf \
  'Cangjie Compiler: %s (%s)\nTarget: %s' \
  "$compiler_version" "$compiler_backend" "$compiler_target")
if [ "$compiler_output" != "$expected_compiler_output" ]; then
  printf 'Locked cjc reported an unexpected identity or target:\n%s\n' \
    "$compiler_output" >&2
  exit 1
fi
printf '%s  %s\n' "$compiler_sha256" "$staged_sdk_root/bin/cjc" \
  | sha256sum --check

canonical_lock="$install_staging/cangjie-toolchain.lock.canonical.json"
jq -cS -j . "$lock_file" >"$canonical_lock"
lock_sha256=$(sha256sum "$canonical_lock")
lock_sha256=${lock_sha256%% *}
rm -f -- "$canonical_lock"
printf '%s\n' "$lock_sha256" \
  >"$staged_sdk_root/.playground-cj-toolchain-lock.sha256"

if [ -n "$stdx_root" ]; then
  if ! command -v unzip >/dev/null 2>&1; then
    printf '%s\n' 'Required installer command is unavailable: unzip' >&2
    exit 1
  fi
  stdx_target="$stdx_root/linux_x86_64_cjnative"
  if [ -e "$stdx_target" ] || [ -L "$stdx_target" ]; then
    printf 'Refusing to merge locked stdx into existing path: %s\n' \
      "$stdx_target" >&2
    exit 1
  fi
  stdx_url=$(jq -er '.stdx.url' "$lock_file")
  stdx_release_page=$(jq -er '.stdx.releasePage' "$lock_file")
  stdx_sha256=$(jq -er '.stdx.sha256' "$lock_file")
  stdx_archive="$sdk_parent/cangjie-stdx.zip"
  if [ -e "$stdx_archive" ] || [ -L "$stdx_archive" ]; then
    if [ ! -f "$stdx_archive" ] || [ -L "$stdx_archive" ]; then
      printf 'stdx cache must be a regular, non-symlink file: %s\n' \
        "$stdx_archive" >&2
      exit 1
    fi
  else
    stdx_download=$(mktemp "$stdx_archive.download.XXXXXX")
    curl --proto '=https' --proto-redir '=https' \
      -A 'Mozilla/5.0' -e "$stdx_release_page" \
      --fail --location --retry 5 --retry-all-errors \
      --connect-timeout 30 --output "$stdx_download" "$stdx_url"
    printf '%s  %s\n' "$stdx_sha256" "$stdx_download" \
      | sha256sum --check
    mv -T --no-clobber -- "$stdx_download" "$stdx_archive"
    if [ -e "$stdx_download" ] || [ -L "$stdx_download" ]; then
      rm -f -- "$stdx_download"
    fi
    stdx_download=
  fi
  if [ ! -f "$stdx_archive" ] || [ -L "$stdx_archive" ]; then
    printf 'stdx cache must be a regular, non-symlink file: %s\n' \
      "$stdx_archive" >&2
    exit 1
  fi
  printf '%s  %s\n' "$stdx_sha256" "$stdx_archive" | sha256sum --check
  staged_stdx_root="$install_staging/stdx"
  mkdir "$staged_stdx_root"
  unzip -q "$stdx_archive" -d "$staged_stdx_root"
  if [ ! -d "$staged_stdx_root/linux_x86_64_cjnative/dynamic/stdx" ]; then
    printf '%s\n' 'Locked stdx archive has an unexpected layout' >&2
    exit 1
  fi
  mkdir -p "$stdx_root"
  mv -T --no-clobber -- \
    "$staged_stdx_root/linux_x86_64_cjnative" "$stdx_target"
  if [ -e "$staged_stdx_root/linux_x86_64_cjnative" ] \
    || [ -L "$staged_stdx_root/linux_x86_64_cjnative" ]; then
    printf 'Refusing to merge locked stdx into concurrently-created path: %s\n' \
      "$stdx_target" >&2
    exit 1
  fi
  installed_stdx_target=$stdx_target
fi

mv -T --no-clobber -- "$staged_sdk_root" "$sdk_root"
if [ -e "$staged_sdk_root" ] || [ -L "$staged_sdk_root" ]; then
  printf 'Refusing to merge a locked SDK into concurrently-created path: %s\n' \
    "$sdk_root" >&2
  exit 1
fi
installed_sdk_target=$sdk_root
rm -rf -- "$install_staging"
install_staging=
installed_stdx_target=
installed_sdk_target=
trap - 0 HUP INT TERM
