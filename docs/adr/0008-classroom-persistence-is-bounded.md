# AI Classroom Persistence Is Bounded

AI Classroom persists one browser-local aggregate snapshot. That snapshot must
have a finite cost: every aggregate collection has an explicit maximum and the
canonical serialized snapshot may not exceed 8 MiB. The same schema validates
new candidates, memory storage, IndexedDB storage, and imported state, so an
oversized snapshot cannot enter through a less strict adapter.

Exercise Attempt runner diagnostics are not raw runner transcripts. The runner
reports whether it truncated each observed channel; truncated stdout fails
closed and cannot satisfy output evaluation. Persistence then retains at most
16 KiB of UTF-8-safe head/tail text for each of stdout, stderr, and compiler
output, together with the upstream-truncation flag, observed byte count, locally
omitted byte count, SHA-256 digest of the observed source, and a separate
SHA-256 digest of the retained head/tail preview. Snapshot open and cross-tab
reload re-hash each retained preview at the storage boundary; newly generated
summaries are trusted in-process, avoiding a history-wide re-hash on every
command. The persisted output-evaluation witness binds its decision to the
observed stdout digest and upstream-truncation flag, while the Attempt's
immutable Exercise Instance binds the exact evaluator contract. These hashes
make local provenance and retained-preview corruption visible; consistent with
ADR 0005, they do not turn browser-controlled evidence into an attestation.

Compaction is deliberately narrower than deletion by age. The aggregate keeps a
bounded tail of 64 resolved retention lifecycles and may remove older
Retention Markers and tombstones only when suppression has been explicitly
allowed and no Exercise Instance still names that artifact as a
Personalization Input. A resolved Remediation tombstone is compactable only
while its failed Attempt and Evidence lineage is still covered by an active
replacement Remediation. Active suppressions, active Review Artifacts,
Attempts, Learning Evidence, Exercise Instances, Track Adjustment provenance,
and Teacher Exposure are never silently discarded.

When no correctness-preserving compaction can bring a candidate under its
collection or byte budget, the command fails deterministically and the
previous committed revision remains intact. A future checkpoint design could
replace old immutable records with explicit derived indexes, but deleting
Evidence or assessment history merely to make a write fit is rejected.

This changes the persisted Attempt shape and advances Classroom Snapshot and
IndexedDB storage from v7 to v8. Runtime opens a new v8 database and does not
look up, reinterpret, or migrate v7 state.
