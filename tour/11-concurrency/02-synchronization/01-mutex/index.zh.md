# 互斥锁（Mutex）

当多个线程需要访问共享资源时，必须确保同一时间只有一个线程能修改数据。**互斥锁**（Mutex）就是解决这个问题的工具。

仓颉提供了 `ReentrantMutex`，使用 `import std.sync.*` 导入。基本使用模式：

```
let mutex = ReentrantMutex()
mutex.lock()
// 临界区：安全地访问共享数据
mutex.unlock()
```

`lock()` 获取锁，`unlock()` 释放锁。如果锁已被其他线程持有，`lock()` 会阻塞直到锁被释放。"Reentrant"表示同一线程可以多次获取同一把锁而不会死锁。

右侧的代码展示了如何使用互斥锁保护共享计数器。