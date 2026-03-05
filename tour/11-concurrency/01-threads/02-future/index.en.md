# Thread Return Values (Future)

Threads created with `spawn` can return values. The last expression in the code block becomes the thread's return value, accessible through the `Future` object's `.get()` method.

`Future<T>` is a generic type where `T` is the type of the return value. Calling `.get()` blocks the current thread until the target thread completes and returns its result.

This pattern is ideal for parallel computation — you can launch multiple tasks simultaneously, then collect their results.

The code on the right demonstrates using `Future` to compute multiple values in parallel and combine the results.