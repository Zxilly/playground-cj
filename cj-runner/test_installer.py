"""Exercise the real installer with tiny local archives (requires Linux tools)."""

import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parent


class InstallerTests(unittest.TestCase):
    def test_archive_verification(self):
        for mode in ("download", "cache", "corrupt-cache", "collision", "corrupt-collision"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                lock = json.loads((ROOT / "cangjie-toolchain.lock.json").read_text())
                compiler = (
                    "#!/bin/sh\nprintf 'Cangjie Compiler: "
                    + lock["compiler"]["version"]
                    + " (cjnative)\\nTarget: x86_64-unknown-linux-gnu\\n'\n"
                ).encode()
                sdk = root / "sdk.tar.gz"
                with tarfile.open(sdk, "w:gz") as archive:
                    entry = tarfile.TarInfo("cangjie/bin/cjc")
                    entry.mode = 0o755
                    entry.size = len(compiler)
                    archive.addfile(entry, io.BytesIO(compiler))
                stdx = root / "stdx.zip"
                with zipfile.ZipFile(stdx, "w") as archive:
                    archive.writestr("linux_x86_64_cjnative/dynamic/stdx/fixture", "test")
                lock["compiler"]["executableSha256"] = hashlib.sha256(compiler).hexdigest()
                lock["sdk"]["sha256"] = hashlib.sha256(sdk.read_bytes()).hexdigest()
                lock["stdx"]["sha256"] = hashlib.sha256(stdx.read_bytes()).hexdigest()
                lock_path = root / "lock.json"
                lock_path.write_text(json.dumps(lock))
                parent = root / "installed"
                parent.mkdir()
                cached_sdk = parent / "sdk.tar.gz"
                if "cache" in mode:
                    cached_sdk.write_bytes(b"corrupt" if mode == "corrupt-cache" else sdk.read_bytes())
                    (parent / "cangjie-stdx.zip").write_bytes(stdx.read_bytes())
                bin_dir = root / "bin"
                bin_dir.mkdir()
                # Only transport is mocked; extraction, hashes, compiler probing,
                # no-clobber publication and the installer itself are real.
                curl = bin_dir / "curl"
                curl.write_text("""#!/bin/sh
while [ "$#" -gt 0 ]; do
  case "$1" in --output) output=$2; shift 2;; *) url=$1; shift;; esac
done
case "$url" in *.zip) source=$TEST_STDX;; *) source=$TEST_SDK;; esac
cp "$source" "$output"
case "$TEST_MODE" in
  collision) cp "$source" "${output%.download.*}";;
  corrupt-collision) printf corrupt > "${output%.download.*}";;
esac
""")
                sha = bin_dir / "sha256sum"
                sha.write_text("""#!/bin/sh
if [ "$1" = --check ]; then
  input=$(cat)
  printf '%s\\n' "$input" >> "$TEST_HASH_LOG"
  printf '%s\\n' "$input" | /usr/bin/sha256sum --check
else
  exec /usr/bin/sha256sum "$@"
fi
""")
                curl.chmod(0o755)
                sha.chmod(0o755)
                log = root / "hashes.log"
                result = subprocess.run(
                    ["sh", str(ROOT / "install-cangjie-toolchain.sh"),
                     "--lock", str(lock_path), "--sdk-parent", str(parent),
                     "--archive", str(cached_sdk), "--stdx-root", str(root / "stdx")],
                    env={**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}",
                         "TEST_SDK": str(sdk), "TEST_STDX": str(stdx),
                         "TEST_MODE": mode, "TEST_HASH_LOG": str(log)},
                    capture_output=True, text=True,
                )
                if mode.startswith("corrupt"):
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse((parent / "cangjie").exists())
                else:
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertTrue((parent / "cangjie/bin/cjc").exists())
                    # SDK + stdx + compiler exactly once. A no-clobber collision
                    # must additionally check the two files actually published.
                    self.assertEqual(len(log.read_text().splitlines()), 5 if mode == "collision" else 3)


if __name__ == "__main__":
    unittest.main()
