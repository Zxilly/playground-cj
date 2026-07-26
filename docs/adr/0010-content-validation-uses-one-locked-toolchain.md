# Content Validation Uses One Locked Toolchain

## Decision

`cj-runner/cangjie-toolchain.lock.json` is the single reviewed authority for
the Linux x64 Cangjie SDK, compiler identity and target, extracted `cjc` bytes,
and stdx. CI and the runner Docker build use the same installer, which reads
that lock and verifies archives and extracted compiler bytes before use.
`cjpm.toml` remains declarative input for Cangjie itself, but an alignment test
requires its compatibility version to equal the lock.

Content Pack generation rejects a compiler whose self-report or executable
SHA-256 differs from the lock. Receipt schema v5 records the target, SDK archive
digest, compiler executable digest, and canonical lock digest. The current
receipt and publication-history head must be schema v5 and match the lock.

## Consequences

A same-version wrapper, developer build, stale CI SDK, or independently edited
Docker argument cannot produce an acceptable current receipt. Updating the
toolchain requires one lock change, independent verification of the new
archives and executable, regeneration with those exact bytes, and a new
immutable publication entry.

Genesis receipt schema v4 remains parseable only because publication history
is immutable evidence. It is not accepted for a new publication. The next
entry revalidates current and retained historical Content Pack bytes under the
locked schema-v5 toolchain without rewriting genesis.
