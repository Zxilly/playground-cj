# Thread Sleep

Sometimes you need to pause a thread's execution for a period of time. Cangjie provides the `sleep` function to suspend the current thread.

Using `sleep` requires importing `std.time.*`. The `Duration` type represents time intervals and provides convenient constructors like `Duration.second`, `Duration.millisecond`, etc.

`sleep` is useful for:
- Simulating delayed operations
- Periodic polling
- Rate limiting

The code on the right demonstrates using `sleep` to create a simple countdown program.
