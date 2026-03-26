import std.sync.*
import std.collection.ArrayList

// 计算平方值的函数
func square(n: Int64): Int64 {
    return n * n
}

main(): Int64 {
    // 定义任务列表
    let jobs = [2, 4, 6, 8, 10]
    
    // 共享数据结构
    let results = ArrayList<String>()
    let resultsLock = Mutex()
    let completed = AtomicInt64(0)
    
    // 存储所有 Future
    let futures = ArrayList<Future<Unit>>()
    
    // 为每个任务启动一个线程
    for (job in jobs) {
        let current = job
        let future = spawn {
            // 执行计算（无需同步）
            let value = square(current)
            
            // 将结果写入共享列表（需要 Mutex）
            synchronized(resultsLock) {
                results.add("${current}² = ${value}")
            }
            
            // 更新完成计数（使用原子操作）
            let _ = completed.fetchAdd(1)
        }
        futures.add(future)
    }
    
    // 等待所有线程完成
    for (future in futures) {
        future.get()
    }
    
    // 输出结果
    println("完成计数: ${completed.load()}")
    println("计算结果:")
    for (line in results) {
        println("  ${line}")
    }
    
    return 0
}