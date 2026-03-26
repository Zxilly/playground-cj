import std.sync.Mutex
import std.collection.ArrayList

let messages = ArrayList<String>()
let messagesLock = Mutex()

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()
    
    // 启动 5 个 worker 线程
    for (workerId in 1..=5) {
        let current = workerId
        let future = spawn {
            // 在临界区外进行耗时计算
            let message = "Worker ${current} 完成任务"
            
            // 模拟一些计算工作
            var sum = 0
            for (i in 0..1000) {
                sum += i
            }
            
            // 只在访问共享数据时持有锁
            synchronized(messagesLock) {
                messages.add(message)
            }
        }
        futures.add(future)
    }
    
    // 等待所有线程完成
    for (future in futures) {
        future.get()
    }
    
    // 打印所有消息
    println("收到 ${messages.size} 条消息:")
    for (message in messages) {
        println("  - ${message}")
    }
    
    return 0
}