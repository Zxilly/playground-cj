# Atomic Operations

For simple numeric operations, using a mutex can be overkill. Cangjie provides **atomic types** that guarantee atomicity without locks.

`AtomicInt64` is the most commonly used atomic type, imported with `import std.sync.*`. It provides these common methods:

- `load()` — atomically read the current value
- `store(value)` — atomically store a new value
- `fetchAdd(delta)` — atomically add delta and return the old value
- `fetchSub(delta)` — atomically subtract delta and return the old value

Atomic operations are more lightweight than mutexes and are ideal for simple counters and flags. The code on the right uses an atomic counter for thread-safe accumulation.