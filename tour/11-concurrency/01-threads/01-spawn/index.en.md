# Creating Threads (spawn)

Cangjie creates lightweight threads (coroutines) using the `spawn` keyword. `spawn` takes a code block and executes it in a new thread.

`spawn` returns a `Future` object. You can call `.get()` on it to wait for the thread to complete. If you don't call `.get()`, the main thread may exit before the spawned thread finishes.

Basic syntax:
```
let future = spawn {
    // code to execute in a new thread
}
future.get()  // wait for completion
```

Threads created by `spawn` are lightweight, with much less overhead than OS threads. You can easily create hundreds or thousands of them. The code on the right demonstrates creating and waiting for multiple threads.
