# Mutex

When multiple threads need to access shared resources, you must ensure only one thread can modify the data at a time. A **Mutex** (mutual exclusion lock) is the tool for this.

Cangjie provides `ReentrantMutex`, imported with `import std.sync.*`. Basic usage pattern:

```
let mutex = ReentrantMutex()
mutex.lock()
// critical section: safely access shared data
mutex.unlock()
```

`lock()` acquires the lock, `unlock()` releases it. If the lock is held by another thread, `lock()` blocks until the lock is released. "Reentrant" means the same thread can acquire the same lock multiple times without deadlocking.

The code on the right demonstrates using a mutex to protect a shared counter.
