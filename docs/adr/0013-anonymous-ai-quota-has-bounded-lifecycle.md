# 0013: Anonymous AI quota has a bounded lifecycle

## Status

Accepted.

## Context

The public AI gateway isolates upstream quota by a trusted network identity.
Making those new-api tokens permanent lets a caller rotate proxy addresses and
grow the service user's token table without bound. A Redis cache TTL is not a
lifecycle policy because it does not delete the upstream row. One global token
would bound rows, but would also let one identity exhaust every learner's
quota despite per-identity request-rate admission.

## Decision

Each identity keeps a deterministic `pcj:s:` token and its isolated upstream
quota. New tokens expire after the next quota boundary plus a one-day
inactivity grace. Crossing a boundary while active resets quota and extends
that expiry.

Before any new row is created, the broker takes one deployment-wide Redis
lock, reads the complete managed-token inventory from new-api, deletes only
tokens whose expiry is at least one minute in the past, and rechecks a hard
capacity of 512 retained rows. The one-minute deletion delay exceeds the model
request deadline and protects requests admitted just before expiry. Inventory
paging, malformed data, Redis failure, cleanup failure, or capacity exhaustion
all fail closed.

The new-api access token belongs to a dedicated service user. Operators also
configure that user with an upstream token-count ceiling as defense in depth.

## Consequences

- Anonymous identities retain separate daily balances.
- Address rotation can occupy capacity for a bounded inactivity window, but
  cannot grow managed rows beyond the broker's hard limit.
- A full pool rejects new identities until expired rows are safely reclaimable;
  it never creates an untracked overflow credential.
- Legacy permanent `pcj:s:` rows count against capacity until an active
  boundary reset migrates them to finite expiry or an operator removes them.
