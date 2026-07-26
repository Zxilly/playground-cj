# Content Revisions Are Explicit Content Addresses

Course Content Pack identity is not release-order SemVer. New generated
artifacts use `cv:sha256:<64 lowercase hex>` for the exact locale-specific
Content Version and `lc:sha256:<64 lowercase hex>` for the locale-neutral
Learning Contract Version. Exercise Template versions copy their containing
Content Version. The full value is persisted and exchanged by every protocol;
the UI may show a short digest label only when the complete identity remains
available as the control value and accessible title.

The previous generator converted a SHA-256 digest to one enormous decimal
integer and placed it in the patch component of `1.0.<integer>`. That looked
like SemVer without providing SemVer ordering or compatibility meaning, made
ordinary version UI overflow, and coupled a content identity to numeric parser
limits. It was an encoding workaround rather than a domain version.

The decimal-encoded iterations never entered repository history, so they do
not create a compatibility contract. The first checked-in publication is the
genesis: one current pack per Concept and locale, all using the namespaced
SHA-256 identities above, with publication sequence `1`, snapshot `0001`, and
no previous entry. Runtime, artifact, manifest, receipt, and attestation schemas
reject numeric triples instead of carrying an unshipped migration branch.

Every code sample is classified as `program` or `snippet` in that same genesis.
The field is required by the Course Content Pack schema; there is no
pre-classification artifact shape or receipt protocol in repository history.
Artifact schema v2 and receipt schema v4 were the genesis shapes. Receipt
schema v5 later adds exact toolchain provenance under ADR 0010; schema v4 stays
readable only for integrity verification of the immutable genesis snapshot and
is not accepted as a new publication candidate.

External approval is bound to the full Content Version identity, not merely a
Concept's current pointer. A new attestation may approve current and historical
versions together, provided each runnable program has exact receipt evidence.
Every later attestation must list historical approvals it intends to carry
forward; omission downgrades that exact version to pending and may make a Track
pinned to it unavailable until a trusted reviewer approves it again.
