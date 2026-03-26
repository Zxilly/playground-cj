import std.sync.AtomicInt64
import std.collection.ArrayList

let counter = AtomicInt64(0)

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()
    
    // 创建 50 个并发线程，每个递增计数器
    for (_ in 0..50) {
        let future = spawn {
            let oldValue = counter.fetchAdd(1)
            println("递增前: ${oldValue}")
        }
        futures.add(future)
    }
    
    // 等待所有线程完成
    for (future in futures) {
        future.get()
    }
    
    println("最终计数: ${counter.load()}")
    return 0
}