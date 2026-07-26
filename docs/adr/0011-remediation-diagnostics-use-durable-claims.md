# Remediation Diagnostics Use Durable Claims

Automatic Remediation diagnosis is a distributed browser job. Multiple tabs
may observe the same pending Review Artifact, and a tab-local flag or Web Lock
cannot establish ownership: Web Locks may be unavailable, and neither primitive
survives a crashed tab. Before any model call, the coordinator therefore
submits a domain command that acquires a claim through the AI Classroom's
revisioned compare-and-swap storage boundary.

The stable job identity is the tuple of Remediation Artifact id, failed Attempt
id, and next diagnostic-attempt number. A claim adds a cryptographically random
owner nonce, acquisition time, and an `expiresAt` field retained for persisted
v8 compatibility. Despite that historical field name, the value is only a
fixed 45-second stale-warning threshold. It is not a lease and never revokes
ownership. There is at most one claim on each already-bounded Review Artifact,
so ownership cannot create an unbounded job or audit collection. Every
persisted claim excludes every other automatic owner until the exact owner
settles and releases it.

This stronger rule is required because deployments may use arbitrary direct
OpenAI-compatible or Anthropic providers. A timeout or AbortSignal cannot prove
that such a provider stopped processing, and those providers cannot be assumed
to honor an idempotency key. Replacing an old claim automatically could
therefore overlap model calls and duplicate cost. The coordinator neither
polls an existing claim nor schedules a wakeup at `expiresAt`.

Retaining a generated Remediation and recording a diagnostic failure both carry
the exact claim authority. The aggregate accepts them only while that job and
owner still hold the persisted claim, and completion clears the claim in the
same revision. Release is likewise owner-checked: a delayed process cannot
release or complete work after a replacement owner has taken over. Commands
without claim authority remain valid only when no claim is active, preserving
explicit learner/domain operations without allowing them to override a running
automatic job.

Success, failure, abort, and component disposal all attempt an owner-checked
release. The coordinator retains both its local guard and durable claim until
the raw provider promise settles. A provider that ignores its abort signal
therefore cannot trigger an automatic replacement at any elapsed time.

This safety choice means a crashed owner can leave a claim behind. Liveness is
restored only through an explicit learner action in Review. After the
stale-warning threshold, Review explains that the previous provider call may
still be running and that recovery can cause a duplicate call and duplicate
charges. The learner must open that warning and confirm the risk. The resulting
`recover_potentially_abandoned_remediation_diagnostic_claim` command carries
`acknowledgePotentialDuplicateProviderCall: true`; the aggregate clears the
claim only after the threshold and through the same CAS boundary. The threshold
only decides when this hazardous control is offered. It does not assert that
the old call ended. The ordinary diagnostic retry command rejects while any
claim remains, so it cannot silently become a takeover path.

Web Locks remain an optional contention optimization around acquisition, never
a correctness dependency. Claim-only revisions are excluded from the React
worker's job-schedule identity so acquiring its own claim does not abort the
winner before the model call starts. After an explicit recovery, normal CAS
acquisition grants at most one new automatic owner. A late completion from the
old owner is fenced because its authority no longer matches the persisted
claim.

The claim field defaults to `null` when an existing v8 snapshot is parsed. This
is a bounded, backward-compatible extension of the v8 artifact shape; the next
successful aggregate write persists the explicit field.
