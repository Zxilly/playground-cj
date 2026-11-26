package playground

// 示例场景：使用多线程（spawn / Future）并行执行蒙特卡洛算法估算圆周率
// 涉及特性：轻量级线程 spawn、Future、ArrayList、常量与循环
import std.collection.*
import std.random.*
import std.math.*

const M = 200000
const N = 16

func task(): Int64 {
    var n: Int64 = 0
    let random = Random()
    for (_ in 0..M) {
        let x = random.nextFloat64()
        let y = random.nextFloat64()
        if ((x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.25) {
            n++
        }
    }
    return n
}

main() {
    let futures = ArrayList<Future<Int64>>()
    for (_ in 0..N) {
        let future = spawn {task()}
        futures.add(future)
    }
    var n = 0
    for (future in futures) {
        n += future.get()
    }
    let pi = Float64(n) / Float64(M * N) * 4.0
    println("π ≈ ${pi}")
    println("误差：${abs(Float64.getPI() - pi)}")
}
