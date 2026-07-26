# Course Content Pack artifacts

These files are the only curriculum payload served by the AI Classroom API.
Request handling never reads the Static Tour or compiles MDX.

## Publication integrity records

`publication-history.json` is a repository-local integrity log. Each entry
points to a snapshot directory under `history/` containing the locale
artifacts, manifest, validation receipt, and repository review declaration for
that publication. The portable gate checks every digest and snapshot before it
reads the current candidate. This catches accidental deletion or mutation when
the existing repository log is preserved.

The first checked-in publication is the genesis: sequence `1`, snapshot
`0001`, and a null previous-entry digest. Every locale artifact contains one
current pack for each Concept and no development-only predecessor versions.
All Content Versions use `cv:sha256:<digest>` and all Learning Contract
Versions use `lc:sha256:<digest>`.

The log is not an append-only authority and is not externally anchored. A
repository writer can rewrite the log, its snapshots, and their hashes in one
change. Its hashes provide integrity and reproducibility checks only; neither
the log nor its self-asserted reviewer label grants runtime approval.

Receipt schema v5 records the exact compiler identity and target plus the
locked SDK archive, extracted compiler, and canonical lock digests. Protocol
`cjc-content-pack-executables-v3` compiles and runs both the reference solution
and authored starter with the same deterministic output matcher and Source
Requirements used for learner submissions. The reference must pass. The
starter may fail to compile or run; if it runs successfully, either its matched
output or its Source Requirements must fail so the authored task is not already
solved. Schema v4 remains readable only inside the immutable genesis snapshot.

Every Core Content code sample is explicitly classified as `program` or
`snippet`. The heavy gate compiles and runs every `program` in all current and
retained historical packs, and records one receipt entry per block identity
even when identical source execution can be deduplicated. Each entry binds
locale, Concept, Content Version, block id, source SHA-256, normalized stdout
SHA-256, and a successful compile/run result SHA-256. A `snippet` is
intentionally non-runnable. Missing, extra, reclassified, or changed program
entries fail the compiler-free gate.

Each template's validation-input SHA-256 binds its Concept and Template ids,
reference solution, starter code, task type, expected output, match mode, and
Source Requirements. Its result SHA-256 binds the required semantic verdict:
the reference passes and the starter does not.

## Publication workflow

1. `pnpm content-packs:generate` compiles and runs every reference solution and
   rebuilds the candidate from repository sources. With no publication
   metadata it creates the genesis candidate. Otherwise it first verifies the
   complete existing history and merges historical packs only from its
   integrity-checked head. The command writes locale artifacts,
   `manifest.json`, and `validation-receipt.json`; it never writes the review
   declaration or history records.
2. Repository review inspects the diff and records the exact artifact,
   manifest, and receipt SHA-256 values in
   `repository-review-declaration.json`. This file is explicitly self-asserted
   repository metadata with `externalTrustAnchor: false`; its reviewer label is
   descriptive, not a cryptographic identity or platform attestation.
3. `pnpm content-packs:publish` creates genesis snapshot `0001` when no
   publication metadata exists. Later reviewed files are copied into the next
   numbered snapshot and extend `publication-history.json`. Incomplete genesis
   metadata and edits or removals of verified earlier snapshots fail closed.
4. `pnpm content-packs:verify-published` is the compiler-free build/deploy gate.
   It validates every historical snapshot, the chain, current artifact bytes,
   source freshness, receipt result hashes, manifest, and review declaration.
5. `pnpm content-packs:verify` additionally compiles and runs all reference
   solutions, starters, and current/historical `program` code samples with the
   receipt-bound `cjc` version. A missing compiler, a different compiler
   identity, an invalid program or reference, a pre-solved starter, or a
   receipt mismatch fails the command.

The review declaration is not a signature, independent identity proof, or
external approval. This repository contains no signing key, transparency-log
root, or platform attestation that could establish those properties. The
schema therefore requires `externalTrustAnchor: false`, and this checked-in
state serves every pack as pending/read-only (zero Validated Concepts).

Deployment may grant approval only by supplying both
`CONTENT_PACK_EXTERNAL_REVIEW_ATTESTATION_JSON` and
`CONTENT_PACK_TRUSTED_EXTERNAL_REVIEW_KEYS_JSON`. The first is an Ed25519
attestation over the exact publication entry, manifest, receipt, artifact
digests, and exact approved current or historical pack identities. Each new
attestation must explicitly carry forward historical versions that should
remain approved; omission revokes that exact approval. The second maps its key
id to a PEM public key held outside this repository. Supplying neither keeps
content pending; supplying only one, invalid JSON, an unknown key, a bad
signature, a stale subject, or incomplete program receipt coverage fails
closed. Producing the human/external attestation remains outside the generator
and is never simulated by an agent label.

## CI toolchain

`cj-runner/cangjie-toolchain.lock.json` is the single toolchain authority for
CI, the production runner image, and Content Pack validation. The shared
installer verifies the SDK archive, the extracted `cjc` executable bytes, its
self-reported backend/target, and (for the runner) stdx before use.

The workflow runs the heavy gate without a skip or fallback. Local heavy
verification must use the exact locked Linux x64 `cjc`, supplied through
`CJC` or `CANGJIE_HOME`; a same-version wrapper or locally patched binary is
rejected by executable SHA-256. Schema-v5 validation receipts bind the SDK
archive, compiler executable, and canonical lock digest so publication and
learner execution cannot silently drift.
