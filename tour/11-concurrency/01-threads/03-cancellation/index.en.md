# Thread Cancellation

In some scenarios, you may need to cancel a running thread. Cangjie's `Future` provides a `cancel()` method to request thread cancellation.

Thread cancellation is **cooperative** — calling `cancel()` only sends a cancellation request. The thread must actively check for the cancellation status and respond. You can use `Thread.currentThread.hasPendingCancellation` to check for pending cancellation requests.

This design avoids resource leaks and data inconsistency issues that could arise from forcefully terminating a thread.

The code on the right shows how a thread can respond to a cancellation request and exit gracefully.