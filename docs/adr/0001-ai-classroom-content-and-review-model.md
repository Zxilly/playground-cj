# AI Classroom Uses Reusable Course Content With Personalized Review Artifacts

AI Classroom is a continuous tutoring experience, but the continuous Classroom Stream is not the canonical review material. We decided to keep reusable Core Content in versioned Course Content Packs, put only Core Content References, Exercise Instances, Bridge Notes, and Retention Markers into the Live View, and organize later study through a concept-based Review View made from Core Content plus retained Clarifications and Remediations.

Course Content Packs are derived from the existing Static Tour rather than authored as a separate second course, so the static reading experience and AI Classroom do not drift apart. Core Content Blocks are prepared offline or at build time, not extracted by the runtime model, so block identity, source references, and content versions remain stable.

Validated code exercises must also preserve an unsolved assessment boundary. Offline generation compiles and runs both the authored reference solution and starter code under the same deterministic output matcher and Source Requirements used for learner submissions. The reference solution must pass that evaluator, while the starter must not; a starter compile or run failure is acceptable, but a successfully run starter must fail either output matching or a Source Requirement. The repository validation receipt binds the starter, reference, match mode, expected output, and Source Requirements so a later curriculum edit cannot reuse an unrelated validation result.

Core Content code samples have a separate executable boundary. Every sample is
classified as either a standalone `program` or a non-runnable `snippet`.
Offline heavy validation compiles and runs every program in each fully
classified current or retained historical pack with `cjc`;
the receipt binds locale, Concept, Content Version, block id, source hash,
normalized-output hash, and successful result. Snippets are skipped only
because their explicit classification says that they depend on surrounding
code. A pack without a runnable program cannot become Validated Content.

Repository publication records are integrity evidence, not editorial
authority. The checked-in review declaration is explicitly self-asserted and
has `externalTrustAnchor: false`; it can never set a pack to approved. Runtime
approval requires an Ed25519 external review attestation over the exact
publication head, manifest, receipt, artifact digests, and approved current
or historical pack identities. Approval is exact and non-sticky: a new
attestation must explicitly carry forward every historical Concept Version
that should remain approved, while omission intentionally revokes that
version. Its public key must be injected from an independently trusted
deployment boundary rather than stored with the artifacts it approves. In the
absence of both attestation and trusted key, the gate fails closed and all
packs remain pending/read-only.

Any Content Pack accepted by the schema must be fully readable through one
teacher tool result. Publication limits the number of blocks, skills, and
templates and the total learner-visible payload; runtime reads never truncate a
valid pack and then authorize mutations from the partial result. Catalog
discovery is separately paged, and every page carries an explicit continuation
offset rather than silently hiding later Concepts.

Validated availability also includes the complete current prerequisite graph.
A Concept is downgraded to read-only when its prerequisite is missing,
read-only, or cyclic, even if its own pack passes editorial checks. A Learning
Track is bounded to the same complete projection size and rejects an oversized
selection instead of silently truncating the curriculum.

This avoids regenerating or duplicating the same tutorial for every learner while preserving personalization where it matters: local track adjustments, exercise instances, chat-retained clarifications, and failure-driven remediations. The rejected alternatives were chapter-scoped AI pages, copying generated lesson text into each learner stream, maintaining a separate AI-only course, runtime extraction of reusable content, letting the model freely invent exercises, and using the raw chronological stream as the review experience; those options either fragmented learner state, made reuse and versioning hard, duplicated editorial work, made references unstable, or turned review into a noisy transcript replay.

We will implement this as a complete AI Mode rebuild rather than a phased migration. The rebuild should introduce Course Content Packs, validated Core Content Blocks, Core Content References, Exercise Templates, Exercise Instances, skill-level Learning Evidence, retained Review Artifacts, Review View, and derived Concept Progress together so the data model and runtime behavior are internally consistent from the first release of the new model.

The current AI Mode's continuous stream, concept graph, persistence, practice flow, and failure diagnostics are useful reference points, but the feature is still in development and has not been merged to mainline, so we will not preserve old persisted sessions or the old agent-authored lesson generation path as a compatibility mode. The rebuilt mainline should require validated content references and template-backed exercises throughout.

Lesson-generation tools should be rebuilt around orchestration rather than authoring. Tools that let the model write Core Content directly, such as appending arbitrary paragraphs, code examples, concept cards, or ad hoc exercises, should be replaced by narrower tools for appending content reference groups, bridge notes, exercise instances, retention markers, clarifications, and remediations.

Clarification identity is version-exact: Concept, Content Version, and normalized misconception theme form the active grouping and retention-suppression scope. A same-theme explanation for a different Content Version is a separate artifact rather than an in-place update, so historical Retention Markers keep stable provenance.

Review Artifact lifecycle and causal authorization use aggregate revisions, not wall-clock timestamps. Active artifacts record creation and update revisions; removed tombstones additionally record removal and optional retention-allow revisions. Timestamps remain presentation and diagnostic-scheduling metadata.

Allowing a removed Remediation again is a real aggregate transition, not a
suppression-flag no-op: the immutable failed Attempt and Evidence provenance
creates a new pending Remediation shell and Retention Marker, and the bounded
background coordinator diagnoses it again. Deleted explanatory text is never
restored. Allowing a Clarification again only permits a future version-exact
retention because its deleted prose cannot be reconstructed.

The rebuilt data model should support multiple Learning Tracks, but the first UI can expose only the default track. Explicit learner goal changes can be captured as track intent even before a full track picker exists.
