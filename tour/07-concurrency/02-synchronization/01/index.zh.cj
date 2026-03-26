import std.sync.Mutex
import std.collection.ArrayList

var count: Int64 = 0
let mtx = Mutex()

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()
    
    // 创建 20 个并发线程
    for (_ in 0..20) {
        let future = spawn {
            synchronized(mtx) {
                count += 1
            }
        }
        futures.add(future)
    }
    
    // 等待所有线程完成
    for (future in futures) {
        future.get()
    }
    
    println("最终计数: ${count}")
    return 0
}