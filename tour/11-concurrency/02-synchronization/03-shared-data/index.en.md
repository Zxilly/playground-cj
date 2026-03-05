# Shared Data Safety

In concurrent programming, multiple threads reading and writing shared data is the most common source of bugs. Cangjie provides several tools to ensure shared data safety:

- **Mutex**: Protects complex data structure access
- **Atomic types**: Protects simple numeric access
- **Immutable data**: Variables declared with `let` are naturally thread-safe

Best practices:
1. Minimize use of shared data
2. Prefer immutable data
3. When sharing is necessary, use appropriate synchronization
4. Keep critical sections small to minimize lock holding time

The code on the right demonstrates safely maintaining a shared list using a mutex.
