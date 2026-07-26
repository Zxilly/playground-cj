# AI Classroom Progress Is Derived From Learning Evidence

AI Classroom Concept Progress is derived from Review Exposure State and Learning Evidence across Learning Skills, not directly assigned by the model. The model may choose tutoring steps, write observations, summarize blockers, and create learner-facing explanations, but it must not award demonstrated, mastered, blocked, or stale progress by opinion alone.

This keeps progress explainable and prevents self-confirming loops where the same model teaches, judges, and records mastery without objective grounding. The rejected alternative was a direct `set_progress` style tool because it would make implementation faster but would blur the difference between exposure, aided success, repeated-form Practice Evidence, first-form Independent Evidence, an unverified learner claim, and mastery evidence. Learner claims are not persisted as a parallel evidence class; they may prompt a Placement Check whose observable Attempt supplies evidence.

For the same reason, the rebuilt Lesson Orchestrator should not keep a free-form `set_learning_notes` style learner memory. Learner-specific state should be represented as structured retained items, blocker summaries, personalization inputs, and evidence links so it can be explained, expired, removed, and tested.

Temporary Chat also cannot be the authority for declaring its own assistance. Before any learner-facing teacher-generated text is exposed, the runtime durably records the classroom's Teacher Exposure Epoch. Every later Attempt is therefore aided across task types, Exercise Instances, and Learning Tracks, even if the model describes its response as merely conceptual. The current product has no validated fresh-assessment boundary, so it cannot honestly restore independent or mastery eligibility after that epoch. This conservative boundary rejects both a prompt-required bookkeeping tool that a model could omit and a per-instance marker that would incorrectly treat a new exercise as fresh while the relevant Chat context remained untracked.

The runtime also does not emit Mastery Evidence at all. A client wall clock can be moved forward, and a new Exercise Instance can repeat the same immutable assessment. Those values cannot attest either delay or transfer. A first unaided Attempt on a genuinely distinct assessment contract may produce Independent Evidence and demonstrated progress. An unaided retry or repeated contract instead produces Practice Evidence, and applicable assistance produces Aided Evidence. Mastered remains unavailable until a separate trusted assessment-time and freshness protocol is designed. Treating local elapsed time plus a different instance ID as either fresh Independent Evidence or mastery was rejected as an attractive but false shortcut.

Assessment freshness is deliberately proof-based rather than similarity-based.
A different Template ID, prompt, starter, hint, Source Requirement, output
matcher, quiz distractor, or quiz `multiple` flag does not prove that an old
successful submission must change. For code-output tasks, the current evaluator
can certify freshness only when two exact-output contracts accept different
normalized outputs. For quizzes, the per-question accepted answer-index sets
must differ; recall forms from the finite authored pool remain repeated. A task
type change is distinct. Content Pack validation compares every Review Check
against every Practice and Placement form, and against the other Review Checks,
so a later duplicate cannot be hidden behind an intervening alternative.
Assistance and attempt history use the same conservative equivalence rules.

Concept Progress is also separate from Track Pacing Completion. Requiring demonstrated progress to move the Track would permanently deadlock every workspace after its non-resettable Teacher Exposure Epoch, because later successes are correctly Aided rather than Independent. The Track therefore advances when each key Learning Skill has current successful observable Evidence, including Aided or Practice Evidence, while the learner-facing Concept Progress remains practicing. Unconsumed Placement Evidence does not complete pacing. Evidence-backed Accelerate and Delay adjustments establish a durable derived pacing anchor rather than a one-call target exception, so the adjusted path can continue after its immediate target.

Track Adjustment capability is derived from the complete aggregate rather than reconstructed from bounded “recent” windows. The classroom projects exact Accelerate, Focused Catch-Up, Review, and Delay candidates; the model copies a candidate and the aggregate revalidates it. Delay cites exactly the latest three consecutive failures that establish the blocked threshold, not an unbounded failure history. This prevents old independent Placement Evidence, cross-Track failures, or content-only encounter IDs from becoming undiscoverable, and prevents 65 failures from making a schema-bounded tool permanently unable to express a valid Delay. Learning Tracks are explicitly bounded to 64 Concepts so the complete candidate projection and active-Track projection share one enforceable payload limit.

The persisted Track Adjustment explanation is also not model-authored. Each
validated adjustment type maps to a fixed decision code: Placement success,
Placement failure requiring Focused Catch-Up, a prior encounter selected for
Review, or a blocked frontier delayed to its exact next target. Learner-facing
wording is derived from that decision and its provenance. Accepting a free-form
`reason` alongside validated IDs was rejected because it let the model persist
a false narrative even when the structural basis was sound.

Skip Markers follow the same rule. The aggregate projects an exact, full-state
basis candidate only after a Concept is before the derived pacing frontier. A
successful-Evidence basis contains one deterministic, current-contract,
non-Placement success witness for every required Learning Skill and is absent
while the Concept is blocked. An adjustment basis is the current applicable
Accelerate or Delay decision: Accelerate may explain Concepts through its
target after pacing has moved beyond them, while Delay applies only to the
delayed Concept. The aggregate and historical
integrity check both rederive the candidate at the marker revision. This basis
is deliberately a narrow exception to ordinary mainline access so a Concept
that was truly passed by acceleration, delay, or prior-Track Evidence can still
receive a path explanation; the additional frontier-before constraint prevents
the marker from manufacturing an encounter with future content. The model
selects immutable block IDs and an exact basis, but cannot author the displayed
reason.
