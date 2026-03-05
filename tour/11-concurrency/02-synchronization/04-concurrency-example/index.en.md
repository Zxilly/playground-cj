# Concurrency Example

Let's use a comprehensive example to showcase the various concurrency features in Cangjie. This example simulates a simple parallel task processing system.

The program creates multiple worker threads, each performing a different computation. An atomic counter tracks completed tasks, while a mutex protects the shared results list.

This example combines:
- `spawn` to create threads
- `Future` to get return values
- `AtomicInt64` for atomic counting
- `ReentrantMutex` to protect shared data

Through this example, you can see how Cangjie's concurrency primitives work together.
