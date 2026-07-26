# Playground Drafts Use Revisioned CAS

AI-mode Playground drafts are one browser-local, multi-tab workspace. They are
stored in the `playground-cj-ai-playground-v2` IndexedDB database as a strict
schema-version-2 snapshot with a monotonically increasing revision. A write
commits in one read-write transaction only when the stored revision equals the
writer's expected revision. The previous unversioned
`teach:playground-session:v1` localStorage value is not read, migrated,
sanitized, deleted, or overwritten. Treating that unconstrained payload as a
trusted draft would silently preserve the very format this boundary replaces.

Every logical Playground tab has a stable random UUID. Its title and source
have independent UUID version tokens. A client records mutations rather than
blindly replacing the whole snapshot. After a revision conflict it reloads the
committed snapshot and reapplies a mutation only when the field version it
observed is still current. Concurrent additions and edits to different tabs
therefore merge through CAS retries. Concurrent source edits to the same tab,
or an edit whose tab was removed elsewhere, stop with an explicit conflict;
the local source remains visible and may either be retained as a new UUID tab
or discarded in favor of the committed version. It is never silently
last-writer-wins.

Two snapshots may each satisfy the bounds while their rebased union does not.
That is a recoverable `capacity` conflict, not evidence that the committed
snapshot is corrupt. The valid remote revision remains the durable base and the
blocked local tab plus later accepted mutations stay process-local. The learner
may use the remote revision, or release capacity (for example by closing a tab
or shortening source) and retry keeping the local tab as a new UUID. A failed
keep-copy attempt leaves the same recovery payload intact.

BroadcastChannel revision notifications ask other browser tabs to refresh
promptly. Notifications are advisory: correctness comes from IndexedDB CAS and
the reload/reapply rules, so a missing or delayed notification cannot authorize
a stale overwrite.

The v2 schema rejects unknown fields, duplicate or non-UUID identities,
non-monotonic revisions, more than 16 tabs, titles over 256 UTF-8 bytes, source
over 256 KiB per tab, and workspaces over 1 MiB. Runner output, in-flight run
ownership, Monaco handles, and navigation state remain process-local and are
never serialized.

The in-process mutation queue is also bounded at 64 entries. Repeated pending
source or title edits for one tab coalesce behind the currently owned write, so
normal typing retains the newest intent without building an unbounded backlog.

`PlaygroundEditorHost` explicitly acquires the persistence runtime and releases
it on teardown. Opaque owner tokens make repeated or stale releases
idempotent. The final release stops new mutations and attempts to drain every
accepted queued or in-flight mutation. It closes the BroadcastChannel,
IndexedDB handle, and global runtime only after that drain is clean. If a CAS
conflict or storage failure leaves accepted work unresolved, close is refused:
the bounded runtime, blocked draft, and pending queue remain alive so a later
mount can resolve or retry them without constructing a replacement runtime.

This retention is a same-page lifecycle guarantee, not a crash-recovery
journal. A page or browser-process loss after IndexedDB has rejected a write can
still lose the process-local unsaved recovery payload. The implementation does
not claim that such a payload was drained or durable. The editor is not mounted
until v2 hydration succeeds, so startup cannot overwrite a durable draft with
an unhydrated default buffer.
