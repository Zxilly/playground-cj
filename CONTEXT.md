# AI Classroom

AI Classroom is the personalized tutoring context for the Cangjie Tour. It separates reusable course material from a learner's chronological learning experience so AI guidance can be both stable and personal.

## Language

**Course Content Pack**:
A reusable, versioned set of instructional material for a concept or learning track. It is not owned by a single learner and should remain stable enough to be reused across many classroom sessions; its editorial source is the Static Tour, not a separately maintained second course.
_Avoid_: Generated tutorial, one-off lesson, AI-written course.

**Content Pack Validation**:
The quality gate a Course Content Pack must pass before AI Classroom can use it at runtime. Validation checks stable block identity, concept and skill links, Source References, content shape, runnable examples, and review status.
_Avoid_: Automatic publish, runtime extraction.

**Validated Content**:
Course Content Pack material that has passed Content Pack Validation and can be used for mainline AI Classroom tutoring. Unvalidated content may support Chat or link back to Static Tour, but it should not drive mainline tutoring progress.
_Avoid_: Draft content, unchecked generated lesson.

**Out-of-Pack Help**:
Chat help for a topic that is not covered by Validated Content. It can answer learner questions and point to authoritative sources, but it does not create Core Content, mainline Exercise Instances, Concept Progress, or retained items for unvalidated concepts.
_Avoid_: Mainline tutoring, generated Core Content.

**Content Version**:
The specific version of Course Content Pack material a learner encountered. Live View stays faithful to the Content Version used at the time, while Review View may show newer content with a visible note about the learner's original version.
_Avoid_: Always-latest content, mutable learning record.

**Stale Evidence**:
Evidence that remains part of the learner's history but may no longer fully prove current understanding because the related Course Content Pack, Exercise Template, or learning target changed. Stale Evidence can prompt review or retesting instead of being silently deleted.
_Avoid_: Invalid evidence, deleted progress.

**Chapter**:
A content organization unit in the Cangjie Tour. A Chapter can help filter or navigate review material, but it does not own learner progress or retained review items.
_Avoid_: Learning state boundary, review owner.

**Static Tour**:
The chapter-based Cangjie Tour experience used for ordinary reading and as the editorial source for reusable Core Content. Static Tour content can be transformed into Course Content Packs for AI Classroom use.
_Avoid_: AI Classroom, generated lesson.

**Classroom Stream**:
The chronological record of one learner's AI classroom experience. It is a process record, not the only shape used for later review.
_Avoid_: Tutorial, chapter page, static course page.

**Chat**:
The learner's temporary conversational help channel inside AI Classroom. Chat answers ordinary clarification questions without changing the Classroom Stream unless the exchange reveals material that should be retained for future review; raw Chat history does not participate in long-term personalization unless a Retention Decision turns part of it into structured state. In Review View, Chat is scoped to the active reviewed Concept rather than the full Live View timeline.
_Avoid_: Classroom Stream, Core Content.

**Code Suggestion**:
A Chat-proposed code change that the learner can choose to apply. A Code Suggestion is assistance, not Learning Evidence, unless the learner applies it and produces an observable attempt such as a run or submission.
_Avoid_: User solution, mastery proof.

**Core Content**:
The standard explanation, example, or exercise material that introduces a concept for the first time. Core Content belongs to a Course Content Pack and can appear in many Classroom Streams.
_Avoid_: Personalized explanation, remediation.

**Core Content Block**:
The smallest reusable unit of Core Content that can be referenced from a Classroom Stream or Review View. Course Content Packs are organized by Concept but expose Core Content Blocks for selective reuse; blocks are prepared offline or at build time, use the AI Classroom content shape, retain their Static Tour source, and are not rewritten by runtime AI.
_Avoid_: Whole chapter copy, generated paragraph.

**Source Reference**:
A trace from a Course Content Pack item back to its Static Tour source. Source References preserve editorial provenance without making Static Tour pages the runtime review shape.
_Avoid_: Runtime citation, duplicated source text.

**Core Content Reference**:
A Classroom Stream entry that points to Core Content in a Course Content Pack instead of duplicating the full instructional text. It records which reusable content the learner encountered.
_Avoid_: Copied lesson text, generated duplicate.

**Content Reference Group**:
An ordered set of Core Content References added to the Classroom Stream for one Tutoring Step. Its default order comes from the Course Content Pack; the Lesson Orchestrator may select a subset but should not reorder Core Content arbitrarily. Bridge Notes may appear around the group but are not part of the Core Content References.
_Avoid_: Single block as lesson step, copied content group.

**Concept**:
A stable learning unit in the Cangjie curriculum. Concepts organize Core Content and Review View material, but they are not themselves the smallest unit of evidence.
_Avoid_: Chapter, Learning Skill.

**Validated Concept**:
A Concept that has validated Course Content, Learning Skills, Exercise Templates, and Source References. Only Validated Concepts can drive mainline tutoring, retained Clarifications, and Concept Progress.
_Avoid_: Draft concept, inferred topic.

**Read-Only Concept**:
A Concept with validated explanatory content but without the validated Learning Skills and Exercise Templates needed for an evidence loop. It can be explained, referenced, or reviewed as Core Content, but it does not drive mainline progress or Exercise Instances.
_Avoid_: Validated Concept, progress target.

**Learning Track**:
A stable curriculum path that orders Concepts and Learning Skills for a learner. The AI may adapt locally within a Learning Track, but it should not freely reorder the whole curriculum on each decision; a new Learning Track requires an explicit learner goal change.
_Avoid_: Ad hoc next topic, chapter list.

**Learning Skill**:
A concrete ability a learner can demonstrate while learning a concept. A Concept describes what is being learned; a Learning Skill describes what the learner can do as evidence of that learning.
_Avoid_: Concept, chapter objective.

**Track Adjustment**:
A local adaptation inside a Learning Track, such as accelerating, inserting Focused Catch-Up, delaying a blocked Learning Skill, reviewing a related Concept, or honoring a learner-requested topic. A Track Adjustment is not a new Learning Track.
_Avoid_: Free curriculum rewrite, random topic jump.

**Topic Entry**:
A learner entry into AI Classroom from a specific Concept or Chapter. A Topic Entry is treated as a Track Adjustment by default, not as a new Learning Track, unless the learner explicitly starts a new path from that topic.
_Avoid_: Track switch, reset.

**Lesson Orchestrator**:
The AI Classroom role that chooses Core Content References, creates Bridge Notes, selects Exercise Templates, creates Exercise Instances, and handles Remediations. It does not author or rewrite Core Content.
_Avoid_: Lesson writer, tutorial generator.

**Tutoring Step**:
The internal unit used to decide what the AI should do next. A Tutoring Step targets a Learning Skill, while learner-facing progress remains organized around Concepts.
_Avoid_: Chapter step, visible lesson section.

**Learning Evidence**:
A record that the learner attempted or demonstrated a Learning Skill. Learning Evidence must be grounded in observable activity such as an Exercise Instance, run result, retained Remediation, or other explicit learner action.
_Avoid_: Model opinion, raw chat transcript.

**Aided Evidence**:
Learning Evidence produced after meaningful assistance such as a Code Suggestion, hint, or guided correction. Aided Evidence can show progress, but it is weaker than an independent attempt and should not by itself prove mastery.
_Avoid_: Independent success, mastered.

**Self-Report Evidence**:
A weak form of Learning Evidence created when the learner says they understand or already know something. Self-Report Evidence may influence pacing or trigger a check, but it does not directly prove a Learning Skill.
_Avoid_: Mastery proof, direct progress update.

**Concept Progress**:
The learner's derived state for a Concept, aggregated from Review Exposure State and Learning Evidence across its Learning Skills. Concept Progress may be unseen, seen, practicing, demonstrated, mastered, blocked, or stale; the model may write observations, but it does not directly assign final Concept Progress.
_Avoid_: Model-assigned mastery, self-report only, introduced.

**Mastery Evidence**:
Independent Learning Evidence that proves transfer or retention, such as an unaided new Exercise Instance or a delayed check across the Concept's key Learning Skills. A single same-context success does not create Mastery Evidence.
_Avoid_: Aided Evidence, first exercise success.

**Blocked State**:
A Concept Progress state triggered by repeated observable failure on required Learning Skills. The model may summarize the blocker, but it does not assign Blocked State by opinion alone.
_Avoid_: Model frustration, subjective difficulty.

**Exercise Template**:
A reusable practice pattern bound primarily to a Learning Skill and secondarily associated with one or more concepts. It defines the learning target and expected evidence shape; every Exercise Instance must trace back to a selected Exercise Template.
_Avoid_: Generated ad hoc exercise, user attempt.

**Exercise Instance**:
A concrete practice task created for one learner from an Exercise Template. It appears in the Classroom Stream as part of the learner's actual learning process, anchors attempts and evidence, and must remain explainable by tracing back to its template, version, and personalization inputs.
_Avoid_: Exercise Template, generic practice item.

**Personalization Inputs**:
The bounded learner-specific facts used to create an Exercise Instance or decide the next tutoring step. Personalization Inputs may include concept progress, recent error patterns, retained Remediation summaries, declared language background, template difficulty targets, and recent relevant code summaries; they do not include full chat transcripts or inferred learning styles.
_Avoid_: Full learner history, learning style profile.

**Declared Background**:
Learner-provided background information such as known programming languages or stated experience. Declared Background may personalize pacing, examples, and initial difficulty, but it must be explicit and removable rather than inferred silently from Chat, and it does not replace Placement Checks or Learning Evidence.
_Avoid_: Inferred profile, hidden trait.

**Placement Check**:
A short check used when a learner claims prior knowledge or wants to skip ahead. It can validate pacing decisions, but it is still an Exercise Instance or explicit question with evidence attached.
_Avoid_: Trust-only skip, full lesson.

**Review Check**:
A Review View exercise used to retest stale, weak, or blocked Learning Skills. A Review Check is an Exercise Instance and can create Learning Evidence, including Mastery Evidence when it is independent and transfer-oriented; completing it updates evidence and progress but does not automatically leave Review View.
_Avoid_: Passive review, raw exercise.

**Focused Catch-Up**:
A compressed learning path used after a failed Placement Check. It revisits only the missing Core Content and Learning Skills instead of replaying the full lesson.
_Avoid_: Full restart, complete tutorial replay.

**Bridge Note**:
A short learner-specific note that explains why the Classroom Stream is revisiting or connecting Core Content. Bridge Notes may appear in Live View, but they should not replace Core Content, become a long generated lesson, or enter Review View unless they are upgraded into a Clarification.
_Avoid_: Generated tutorial, duplicated Core Content.

**Skipped Core Content**:
Core Content that remains available in Review View but is not shown in Live View because learner evidence or pacing makes it unnecessary for the current Tutoring Step. A Bridge Note may explain the skip when the omission affects learner orientation.
_Avoid_: Deleted content, hidden prerequisite.

**Skip Marker**:
A lightweight Live View entry that records why important Core Content was skipped. Skip Markers are used only when the skip affects the learner's path explanation, not for every omitted block.
_Avoid_: Full skipped content, omission log.

**Clarification**:
A short learner-specific explanation created when the learner says a concept is unclear or asks for a personalized re-explanation. A Clarification belongs to the relevant concept and should supplement Core Content rather than restate the whole concept.
_Avoid_: Re-teaching, duplicate lesson.

**Read-Only Clarification**:
A Clarification attached to a Read-Only Concept. It can appear in Review View and help Chat answer future questions, but it does not contribute to Concept Progress or mainline tutoring decisions.
_Avoid_: Learning Evidence, progress update.

**Pending Personalization**:
A retained learner-specific item that may become useful for mainline tutoring after its concept gains a validated evidence loop, but must be confirmed before it influences progress or exercise generation.
_Avoid_: Automatic progress input, silent upgrade.

**Remediation Content**:
The generated explanatory content inside a Remediation. A learner may remove or hide Remediation Content without deleting the underlying failed attempt or Learning Evidence.
_Avoid_: Failed attempt, Learning Evidence.

**Retention Decision**:
A decision that a Chat exchange contains learner-specific material worth keeping for later review. The decision may be made during Chat, but the retained item must still be represented as a Clarification or Remediation rather than as raw chat history; in Review View, retained items default to the active reviewed Concept.
_Avoid_: Save every chat, transcript replay.

**Retained Item Control**:
The learner's ability to remove or undo automatically retained Review Artifacts. Retention can be model-initiated, but retained Clarifications and Remediations remain learner-visible and removable; removing a retained item removes its review content and personalization index, not unrelated Learning Evidence.
_Avoid_: Hidden memory, irreversible retention.

**Remediation**:
A targeted diagnostic response created after a learner attempt reveals a mistake or misconception. A Remediation belongs to the relevant concept and the failed attempt; Remediations from real practice or run failures are retained by default.
_Avoid_: New lesson, replacement exercise.

**Live View**:
The time-ordered view of the Classroom Stream, used to show what happened during learning.
_Avoid_: Review mode.

**Review View**:
The concept-organized view used for later study inside the same AI Classroom experience as Live View. It presents Core Content first, then learner-specific Clarifications and Remediations as supporting material; Chapters may filter or navigate it but do not own its items.
_Avoid_: Timeline replay.

**Review Exposure State**:
The Review View status of Core Content for a learner: seen when it appeared in Live View, skipped when it was intentionally omitted from Live View but remains available, and unseen when it has not entered the learner's path. Exposure can guide review recommendations, but it does not directly determine Concept Progress.
_Avoid_: Mastery status, Concept Progress.

**Review Artifact**:
A retained learner-specific study item shown in the Review View. It stores the full Clarification or Remediation content, while the learner profile stores only summaries, concept links, and evidence links.
_Avoid_: Learner profile entry, chat transcript.

**Review Artifact Group**:
A concept-level grouping of retained Review Artifacts for later study. Clarifications are merged by concept and misconception theme, while Remediations preserve links to failed attempts but are displayed as an aggregated pattern by default.
_Avoid_: Duplicate saved explanations, raw attempt list.

**Retention Marker**:
A lightweight Live View entry that tells the learner a Clarification or Remediation was saved for review. It is not the retained explanation itself.
_Avoid_: Full saved explanation, chat transcript.

## Flagged Ambiguities

**Tutorial**:
This word is ambiguous and should not be used as a canonical domain term. Use Course Content Pack for reusable instructional material, Classroom Stream for the learner's time-ordered experience, and Review View for later study.

## Example Dialogue

Dev: "If the learner does not understand immutable bindings, should the AI generate the tutorial again?"

Domain expert: "No. The immutable binding explanation is Core Content from the Course Content Pack. The AI should add a Clarification to the Classroom Stream and associate it with that concept."

Dev: "When the learner reviews immutable bindings next week, do they see the same explanation twice?"

Domain expert: "Not in the Review View. They see the Core Content once, with their Clarification and any Remediation folded under it as personal notes."

Dev: "If the learner asks a quick wording question, does that become part of the Classroom Stream?"

Domain expert: "No. That stays in Chat unless it reveals a reusable Clarification or Remediation worth retaining for review."

Dev: "If Chat suggests a correct code change, does that prove the learner mastered the skill?"

Domain expert: "No. A Code Suggestion is assistance. It becomes evidence only if the learner applies it and produces an observable attempt."

Dev: "If the learner applies a Code Suggestion and then submits successfully, is that independent mastery?"

Domain expert: "No. That is Aided Evidence. It can show progress, but mastery requires an independent attempt or later transfer."

Dev: "Who decides whether a Chat exchange is worth retaining?"

Domain expert: "Chat can make the Retention Decision, but it keeps only a structured Clarification or Remediation, not the whole chat transcript."

Dev: "Does the learner have to confirm every Clarification before it is saved?"

Domain expert: "No. Chat can save it automatically when warranted, but Retained Item Control lets the learner remove it later."

Dev: "If the learner removes a retained explanation, should the system also delete the failed attempt it came from?"

Domain expert: "No. Removing a retained item removes the Review Artifact and personalization index. Learning Evidence from a real attempt remains part of the learner's history."

Dev: "Can the learner remove Remediation the same way they remove a Clarification?"

Domain expert: "They can remove or hide the Remediation Content, but the failed attempt and its Learning Evidence remain unless the learner uses a separate learning-history deletion flow."

Dev: "When a Clarification is retained, should the full explanation appear in the time-ordered classroom?"

Domain expert: "No. The Live View may show a Retention Marker, while the full retained item belongs in the Review View."

Dev: "If an exercise submission fails and the AI explains the mistake, is that explanation temporary Chat?"

Domain expert: "No. A real failed attempt produces a Remediation, and that Remediation is retained for later review."

Dev: "Should retained explanations live inside the learner profile?"

Domain expert: "No. Full retained explanations are Review Artifacts. The learner profile only keeps the summaries and links needed for future tutoring decisions."

Dev: "Should Review View be grouped by chapter or by concept?"

Domain expert: "By concept. Chapters can filter or navigate review material, but retained Clarifications and Remediations belong to concepts."

Dev: "If the learner asks about the same confusion five times, do we keep five Clarifications?"

Domain expert: "No. Clarifications are merged by concept and misconception theme. Remediations keep evidence links for each real failed attempt, but Review View shows the repeated pattern first."

Dev: "When standard material appears in a learner's Classroom Stream, do we copy the full text?"

Domain expert: "No. The Classroom Stream keeps a Core Content Reference so the reusable Course Content Pack remains the source of Core Content."

Dev: "Should each referenced block become its own Classroom Stream item?"

Domain expert: "No. One Tutoring Step can add a Content Reference Group containing the ordered Core Content References needed for that step."

Dev: "Can a Content Reference Group include a personalized note?"

Domain expert: "It can display Bridge Notes before or after the group, but those notes remain separate from the Core Content References."

Dev: "Who decides the order of Core Content References inside a group?"

Domain expert: "The Course Content Pack provides the default order. The Lesson Orchestrator may select a subset, but arbitrary reorderings need to be treated as a Track Adjustment."

Dev: "If learner evidence says the learner already knows a Core Content Block, should Live View still show it?"

Domain expert: "No. It can become Skipped Core Content in Live View while remaining available in Review View, with a Bridge Note if the skip needs explanation."

Dev: "Should every skipped block create a Classroom Stream entry?"

Domain expert: "No. Use a Skip Marker only when skipping important Core Content affects the explanation of the learner's path."

Dev: "In Review View, should skipped content look the same as content the learner actually saw?"

Domain expert: "No. Review View should show Review Exposure State: seen, skipped, or unseen. Exposure is separate from mastery."

Dev: "Should AI Classroom maintain a separate copy of the tutorial text?"

Domain expert: "No. Static Tour is the editorial source. AI Classroom consumes transformed Course Content Packs so the two experiences do not drift apart."

Dev: "Can an automatically extracted Course Content Pack be used by AI Classroom immediately?"

Domain expert: "No. It must pass Content Pack Validation before runtime use."

Dev: "Can AI Classroom teach a concept as mainline progress if its content pack has not passed validation?"

Domain expert: "No. Only Validated Content drives mainline tutoring. Unvalidated content can support Chat or send the learner back to Static Tour."

Dev: "What makes a concept safe for mainline tutoring?"

Domain expert: "It must be a Validated Concept with validated content, skills, exercise templates, and source references."

Dev: "If a concept has validated explanation but no validated exercise template, can it be considered validated?"

Domain expert: "No. That is a Read-Only Concept. It can be explained, but it cannot anchor mainline progress or Exercise Instances."

Dev: "Can a Read-Only Concept appear in Review View?"

Domain expert: "Yes, as Core Content for review, but it does not produce Concept Progress because there is no validated evidence loop."

Dev: "Can the learner save a personalized explanation for a Read-Only Concept?"

Domain expert: "Yes, as a Read-Only Clarification. It helps review and Chat continuity, but it does not count as progress evidence."

Dev: "If that Read-Only Concept later becomes a Validated Concept, can the old clarification immediately personalize exercises?"

Domain expert: "No. It becomes Pending Personalization until the learner or model confirms it is still relevant."

Dev: "If the learner asks about a topic outside the validated content pack, can Chat still help?"

Domain expert: "Yes, as Out-of-Pack Help. It can answer cautiously and point to authoritative sources, but it does not create Core Content, mainline exercises, or Concept Progress."

Dev: "Can Out-of-Pack Help be saved for later review?"

Domain expert: "Only if it belongs to an existing validated Concept. Otherwise it stays in Chat and does not become a retained Review Artifact."

Dev: "At what granularity should AI Classroom reuse Static Tour content?"

Domain expert: "Course Content Packs are organized by Concept, and the smallest reusable unit is a Core Content Block."

Dev: "Should Core Content Blocks keep the original MDX shape from Static Tour?"

Domain expert: "No. They use the AI Classroom content shape, but keep Source References back to Static Tour."

Dev: "Should AI Classroom ask the model to extract Core Content Blocks at runtime?"

Domain expert: "No. Core Content Blocks are prepared offline or at build time. Runtime AI selects and combines them, then generates only learner-specific Bridge Notes, Clarifications, or Remediations."

Dev: "Can the runtime model rewrite a Core Content Block to personalize it?"

Domain expert: "No. Core Content Blocks remain stable. Personalization happens around them through Bridge Notes, Clarifications, Remediations, and Exercise Instances."

Dev: "If a concept has no Course Content Pack yet, can AI Classroom keep generating mainline lesson blocks as before?"

Domain expert: "No. Missing content packs should fall back to non-mainline help rather than creating generated mainline lessons."

Dev: "If the learner asks for a Python analogy, is that just a Bridge Note?"

Domain expert: "No. A personalized re-explanation is a Clarification, because it can help the learner review the concept later."

Dev: "Should practice questions be generated from scratch for every learner?"

Domain expert: "No. The reusable part is an Exercise Template. A learner receives an Exercise Instance that can be personalized while still tracing back to the stable template."

Dev: "Should an Exercise Template be owned by a concept or by a skill?"

Domain expert: "By a Learning Skill. Concepts organize what is being learned, while skills define what the learner can demonstrate."

Dev: "Should the learner see progress by skill or by concept?"

Domain expert: "By concept. Internally, the next Tutoring Step targets a Learning Skill, but learner-facing progress stays at the Concept level."

Dev: "Can the AI freely pick any ready concept as the next topic?"

Domain expert: "No. It follows a Learning Track and makes only local Track Adjustments unless the learner explicitly starts a different track."

Dev: "Does the AI still write the lesson after Course Content Packs exist?"

Domain expert: "No. The Lesson Orchestrator selects reusable content and creates learner-specific notes, exercises, and remediations, but it does not author Core Content."

Dev: "If the learner enters AI Classroom from a specific tutorial topic, does that switch their whole learning path?"

Domain expert: "No. That is a Topic Entry, so it becomes a local Track Adjustment unless the learner explicitly starts a new Learning Track."

Dev: "When should AI Classroom create a new Learning Track?"

Domain expert: "Only when the learner explicitly changes goals, such as starting from zero, focusing only on a domain like concurrency, following a background-specific route, or resetting from a topic."

Dev: "Can the model mark a concept as demonstrated because the answer sounded confident?"

Domain expert: "No. Concept Progress is derived from Learning Evidence across Learning Skills. The model can write an observation, but it cannot directly award mastery."

Dev: "If the learner says they already understand a concept, is that enough to mark it demonstrated?"

Domain expert: "No. That is Self-Report Evidence. It can change pacing or trigger a check, but it does not directly prove the related Learning Skills."

Dev: "What should happen when the learner says they already know a prerequisite?"

Domain expert: "Use a Placement Check. If they pass, pacing can accelerate; if not, keep the prerequisite in the learning path."

Dev: "If the Placement Check fails, should the learner replay the full lesson?"

Domain expert: "No. Use Focused Catch-Up: revisit only the missing Core Content and Learning Skills, then practice that gap."

Dev: "Does Focused Catch-Up appear in the learner's Live View?"

Domain expert: "Yes, but mostly as Core Content References plus a short Bridge Note explaining why this gap is being revisited."

Dev: "Should Bridge Notes appear in Review View?"

Domain expert: "Not by default. A Bridge Note stays in Live View unless it captures a stable misconception or reusable personal explanation, in which case it becomes a Clarification."

Dev: "Can the model create an Exercise Instance without choosing a template first?"

Domain expert: "No. The model may select, parameterize, or adapt an Exercise Template, but it cannot bypass the template and invent an untraceable practice task."

Dev: "Does an Exercise Instance belong in the Classroom Stream?"

Domain expert: "Yes. It is the concrete task this learner actually worked on, so it anchors attempts, evidence, and any Remediation."

Dev: "Does an Exercise Instance need to be reproducible later?"

Domain expert: "Yes. It should be explainable from its Exercise Template, template version, personalization inputs, generated task, and creation time."

Dev: "What can be used to personalize a generated practice task?"

Domain expert: "Only bounded Personalization Inputs: concept progress, recent error patterns, retained remediation summaries, declared language background, difficulty target, and recent relevant code summaries. Do not use raw chat history or guessed learning styles."

Dev: "If the Course Content Pack changes later, should the learner's history silently change too?"

Domain expert: "No. Live View remains tied to the Content Version the learner saw. Review View can show the current version, but it should disclose that the learner originally studied an earlier version."

Dev: "If a content update fixes a mistake, does the learner's old evidence disappear?"

Domain expert: "No. The evidence stays in history, but it can become Stale Evidence and trigger a focused review or retest."
