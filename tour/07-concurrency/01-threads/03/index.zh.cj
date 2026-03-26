import std.sync.SyncCounter

main() {
    // 创建一个计数器作为"门"，初始值为 1
    let gate = SyncCounter(1)

    // 创建 worker 线程
    let worker = spawn {
        println("worker: 等待门打开")
        gate.waitUntilZero()  // 阻塞直到计数器归零

        // 检查是否有取消请求
        if (Thread.currentThread.hasPendingCancellation) {
            println("worker: 收到取消请求，提前退出")
            return
        }

        println("worker: 继续执行任务")
    }

    // 先发送取消请求
    println("主线程: 发送取消请求")
    worker.cancel()

    // 然后打开门（计数器减 1）
    println("主线程: 打开门")
    gate.dec()

    // 等待 worker 线程结束
    worker.get()
    println("主线程: 完成")
}