// Migration remains intentionally empty. The persisted-record codec owns the
// policy that legacy v2 sessions are discarded instead of upgraded to v3.
export function migrateClassroomRecord(raw: unknown): unknown {
  return raw
}
