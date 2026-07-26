# Teacher Exposure Is a Workspace Epoch

AI Classroom records one durable Teacher Exposure Epoch before it renders any learner-facing teacher-generated text. Once recorded, every later Exercise Attempt is classified as aided, regardless of task type, Exercise Instance, Concept, or Learning Track. Starting another Track, creating another exercise, reloading the page, or changing locale does not clear the epoch.

This is deliberately conservative. Temporary Chat is not retained as a complete, auditable assistance transcript, and the product has no validated fresh-assessment boundary that can prove a later task is isolated from earlier teacher help. A per-message or per-instance flag would therefore create false independent evidence simply by opening a new exercise. Asking the model to classify its own answer was also rejected because the model can omit or misclassify that bookkeeping step.

The write and reveal boundary is transactional. Chat text is buffered until the epoch commit succeeds. Teacher-authored Bridge Notes create the epoch in the same aggregate revision as their visible stream entry. Retained Clarifications and Remediations remain hidden behind a render gate until the epoch is durably committed. If persistence fails, teacher content is not rendered.

Skip Markers are different: they contain immutable Core Content block IDs, an
aggregate-validated Evidence or Track Adjustment basis, and only
system-derived display wording. They carry no teacher-authored prose and
therefore do not create the Teacher Exposure Epoch. If a Bridge Note is added
to explain the path in free-form language, that Bridge Note still commits the
epoch before it is revealed.

Hints remain concrete assistance records tied to the Exercise Instance where the learner requested them, and their effect is not reset by minting another instance ID. They apply to every later Exercise Instance that repeats the same assessment contract, including across Learning Tracks, reloads, and locale changes. A Code Suggestion is teacher-generated Chat text, so the workspace epoch records its assistance before reveal rather than trusting the model to emit a second bookkeeping event. An Attempt records both applicable same-contract hint IDs and the epoch ID that was already committed before the Attempt.

The product must visibly disclose the consequence once the epoch is active: later work can still produce useful Aided Evidence, but it cannot produce Independent Evidence. Mastery Evidence is unavailable even before exposure because the product also lacks trusted assessment-time and freshness attestation. A future reset may be introduced only with a separately designed and tested fresh-assessment boundary; no current command, new Track, storage reopen, or UI action pretends to reset it.

This is a breaking persisted-state invariant. Classroom Snapshot and IndexedDB storage advance from v4 to v5 with no implicit legacy migration. The later deterministic scaffolding policy advances them to v6; ADR 0006 owns that separate decision.
