main() {
    println("主线程: 开始")

    // 创建第一个 worker 线程
    let worker1 = spawn {
        println("worker 1: 你好")
    }

    // 创建第二个 worker 线程
    let worker2 = spawn {
        println("worker 2: 你好")
    }

    println("主线程: 等待子线程完成")

    // 等待两个 worker 线程完成
    worker1.get()
    worker2.get()

    println("主线程: 完成")
}