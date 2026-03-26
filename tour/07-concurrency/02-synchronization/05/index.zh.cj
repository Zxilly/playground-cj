import std.sync.Mutex
import std.collection.ArrayList

var counter: Int64 = 0
let mu = Mutex()

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()
    
    // 启动 10 个线程，每个递增 100 次
    for (_ in 0..10) {
        let future = spawn {
            for (_ in 0..100) {
                // TODO: 在这里添加同步代码
                // 提示: 使用 synchronized(mu) 保护 counter++
                counter++
            }
        }
        futures.add(future)
    }
    
    // 等待所有线程完成
    for (future in futures) {
        future.get()
    }
    
    println("最终计数: ${counter}")
    println("预期值: 1000")
    
    return 0
}