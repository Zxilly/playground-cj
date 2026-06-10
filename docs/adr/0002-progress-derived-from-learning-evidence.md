# AI Classroom Progress Is Derived From Learning Evidence

AI Classroom Concept Progress is derived from Review Exposure State and Learning Evidence across Learning Skills, not directly assigned by the model. The model may choose tutoring steps, write observations, summarize blockers, and create learner-facing explanations, but it must not award demonstrated, mastered, blocked, or stale progress by opinion alone.

This keeps progress explainable and prevents self-confirming loops where the same model teaches, judges, and records mastery without objective grounding. The rejected alternative was a direct `set_progress` style tool because it would make implementation faster but would blur the difference between exposure, aided success, independent success, self-report, and mastery evidence.

For the same reason, the rebuilt Lesson Orchestrator should not keep a free-form `set_learning_notes` style learner memory. Learner-specific state should be represented as structured retained items, blocker summaries, personalization inputs, and evidence links so it can be explained, expired, removed, and tested.
